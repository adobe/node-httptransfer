/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

"use strict";

const { AccumulateBuffers } = require("./accumulatebuffers");
const { IllegalArgumentError, HttpStreamError } = require("../error");
const { Readable } = require("stream");
const { Queue } = require("./queue");
const logger = require("../logger");

const State = {
    READ: "read",
    SEEK: "seek",
    QUEUE_FULL: "queueFull",
    ERROR: "error",
    COMPLETE: "complete"
};

const DEFAULT_PART_SIZE = 10*1024*1024; // 10MB
let streamId = 0; // counter to identify stream reader instances

/**
 * @typedef {Object} StreamReaderOptions
 * @property {Number} [streamOffset=0] Current stream offset, defaults to 0
 * @property {Number} [partSize=10MB] Part size
 * @property {Number} [cacheSize=1] Size of the cache
 * @property {String} [name] Name to identify the reader
 */
/**
 * StreamReader
 */
class StreamReaderReadable {
    /**
     * Construct stream reader that uses readable event
     * 
     * @param {Readable} stream Stream to read
     * @param {Number} readStart Offset where to start reading
     * @param {Number} readEnd Offset where to stop reading
     * @Param {StreamReaderOptions} [options] Options
     */
    constructor(stream, readStart, readEnd, options) {
        this.streamId = streamId++;
        if (options && options.name) {
            this.name = `${options && options.name}-${this.streamId}`;
        } else {
            this.name = `stream-${this.streamId}`;
        }

        if (!(stream instanceof Readable)) {
            throw new IllegalArgumentError(`[${this.name}] stream must be of type Readable`, stream);
        }
        const streamOffset = (options && options.streamOffset) || 0;
        if (!Number.isFinite(streamOffset) || streamOffset < 0) {
            throw new IllegalArgumentError(`[${this.name}] streamOffset must be 0 or higher`, streamOffset);
        }
        if (!Number.isFinite(readStart) || readStart < streamOffset) {
            throw new IllegalArgumentError(`[${this.name}] readStart must be ${streamOffset} or higher`, readStart);
        }
        if (!Number.isFinite(readEnd) || readEnd < readStart) {
            throw new IllegalArgumentError(`[${this.name}] readEnd must be ${readStart} or higher`, readEnd);
        }
        const partSize = (options && options.partSize) || DEFAULT_PART_SIZE;
        if (!Number.isFinite(partSize) || partSize < 1) {
            throw new IllegalArgumentError(`[${this.name}] partSize must be 1 or higher`, partSize);
        }
        const cacheSize = (options && options.cacheSize) || 1;
        if (!Number.isFinite(cacheSize) || cacheSize < 1) {
            throw new IllegalArgumentError(`[${this.name}] cacheSize must be 1 or higher`, cacheSize);
        }

        this.stream = stream;
        this.queue = new Queue(cacheSize);
        this.accumulateBuffers = new AccumulateBuffers(this.queue, partSize);
        this.streamOffset = streamOffset;
        this.readStart = readStart;
        this.readEnd = readEnd;

        if (streamOffset === readStart) {
            this.state = State.READ;
        } else {
            this.state = State.SEEK;
        }

        this.streamCloseListener = () => this.onStreamClose();
        this.streamErrorListener = error => this.onStreamError(error);
        this.streamReadableListener = () => this.onStreamReadable();
        this.queueDrainListener = () => this.onQueueDrain();
        this.stream.on("close", this.streamCloseListener);
        this.stream.on("error", this.streamErrorListener);
        this.stream.on("readable", this.streamReadableListener);
        this.queue.on("drain", this.queueDrainListener);
    }

    /**
     * Iterate over the parts in the stream.
     * 
     * @yields {Buffer|Error} Item in the queue
     */
    async* [Symbol.asyncIterator]() {
        yield* this.queue;
    }

    /**
     * Stream ended
     */
    onStreamClose() {
        if (this.state === State.ERROR) {
            logger.debug(`[${this.name}] Failed stream ended`);
        } else if (this.state === State.COMPLETE) {
            logger.debug(`[${this.name}] Stream ended`);
        } else {
            this.queue.push(new HttpStreamError());
        }
    }

    /**
     * Stream failed
     * 
     * @param {Error} error 
     */
    onStreamError(error) {
        if (this.state === State.ERROR) {
            logger.error(`[${this.name}] Stream already failed, ignoring error`, error);
        } else if (this.state === State.COMPLETE) {
            logger.warn(`[${this.name}] Requested data range already read, ignoring error`, error);
        } else {
            logger.error(`[${this.name}] Stream failed, flushing buffers and notify`, error);
            this.accumulateBuffers.flush();
            this.queue.push(error);
            this.queue.complete();  
            this.state = State.ERROR;
        }
    }

    /**
     * Data available to read
     */
    onStreamReadable() {
        logger.debug(`[${this.name}] readable event from stream`);

        // ignore readable event when we received a failure
        if (this.state === State.ERROR) {
            logger.error(`[${this.name}] Stream already failed, ignoring readable event`);
            return;
        }

        // continue to seek if we are in a seek state
        if (this.state === State.SEEK) {
            this.seek();
        }

        // if state is read, or seek found the first part and more data is available
        // read until queue is full or buffer is empty
        if (this.state === State.READ) {
            this.read();
        }

        // all states possible here:
        // - seek may have not found the first part
        // - read may have not found the end part
        // - read all data that we are interested in
        // - queue could be full
    }

    /**
     * Queue drained, read more data from the stream
     */
    onQueueDrain() {
        logger.debug(`[${this.name}] drain event from queue`);
        if (this.state === State.QUEUE_FULL) {
            logger.debug(`[${this.name}] continue reading from stream`);
            this.state = State.READ;
            this.read();
        }
    }

    /**
     * Seek until the first chunk that should be read
     */
    seek() {
        while (this.state === State.SEEK) {
            const chunk = this.stream.read();
            if (!chunk) {
                // no more data available
                logger.debug(`[${this.name}] seek, no data available`);
                break;
            } else if ((this.streamOffset + chunk.length) > this.readStart) {
                // first chunk (part) that should be read
                const chunkStart = this.readStart - this.streamOffset;
                if ((this.streamOffset + chunk.length) >= this.readEnd) {
                    // readStart and readEnd are in a single chunk
                    logger.debug(`[${this.name}] seek, read last chunk from stream ${chunk.length} bytes`);
                    const chunkEnd = this.readEnd - this.streamOffset;
                    const part = chunk.slice(chunkStart, chunkEnd);
                    this.accumulateBuffers.push(part);
                    this.accumulateBuffers.flush();
                    this.queue.complete();
                    this.stream.destroy();
                    this.state = State.COMPLETE;
                } else {
                    // readEnd not reached yet
                    logger.debug(`[${this.name}] seek, read chunk from stream ${chunk.length} bytes`);
                    const part = chunk.slice(chunkStart);
                    this.accumulateBuffers.push(part);
                    if (this.queue.full) {
                        logger.debug(`[${this.name}] seek, queue is full`);
                        this.state = State.QUEUE_FULL;
                    } else {
                        this.state = State.READ;
                    }
                }
            }
            this.streamOffset += chunk.length;
        }
    }

    /**
     * Read until the queue is full, or buffer is empty
     */
    read() {
        while (this.state === State.READ) {
            const chunk = this.stream.read();
            if (!chunk) {
                // no more data available
                logger.debug(`[${this.name}] read, no data available`);
                break;
            } else if ((this.streamOffset + chunk.length) >= this.readEnd) {
                // readEnd in this chunk
                logger.debug(`[${this.name}] read, last chunk from stream ${chunk.length} bytes`);
                const chunkEnd = this.readEnd - this.streamOffset;
                logger.debug(chunkEnd, chunk.length);
                const part = chunk.slice(0, chunkEnd);
                this.accumulateBuffers.push(part);
                this.accumulateBuffers.flush();
                this.queue.complete();
                this.stream.destroy();
                this.state = State.COMPLETE;
            } else {
                logger.debug(`[${this.name}] read, from stream ${chunk.length} bytes`);
                this.accumulateBuffers.push(chunk);
                if (this.queue.full) {
                    logger.debug(`[${this.name}] read, queue is full`);
                    this.state = State.QUEUE_FULL;
                }
            }
            logger.debug(this.streamOffset);
            this.streamOffset += chunk.length;
        }
    }
}

module.exports = {
    StreamReaderReadable
};
