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

const { AsyncGeneratorFunction } = require("../generator/function");
const { IllegalArgumentError } = require("../error");
const { Readable } = require("stream");
const { Queue } = require("../generator/queue");
const logger = require("../logger");

const DEFAULT_PART_SIZE = 10*1024*1024; // 10MB
let streamId = 0; // counter to identify stream reader instances

const State = {
    READ: "read",
    ERROR: "error",
    QUEUE_FULL: "queueFull"
};

/**
 * @typedef {Object} StreamReaderOptions
 * @property {Number} [partSize=10MB] Part size
 * @property {Number} [queueCapacity=1] Queue capacity
 */
/**
 * StreamReader
 */
class StreamReader extends AsyncGeneratorFunction {
    /**
     * Construct stream reader that uses readable event
     * 
     * @Param {StreamReaderOptions} [options] Options
     */
    constructor(options) {
        super();

        const partSize = (options && options.partSize) || DEFAULT_PART_SIZE;
        if (!Number.isFinite(partSize) || partSize < 1) {
            throw new IllegalArgumentError(`partSize must be 1 or higher`, partSize);
        }
        const queueCapacity = (options && options.queueCapacity) || 1;
        if (!Number.isFinite(queueCapacity) || queueCapacity < 1) {
            throw new IllegalArgumentError(`queueCapacity must be 1 or higher`, queueCapacity);
        }

        this.partSize = partSize;
        this.queueCapacity = queueCapacity;
    }

    /**
     * Execute the generator, yields the same number of results as input items
     * 
     * @generator
     * @param {Readable[]|Generator||AsyncGenerator} items Items to process
     * @param {Object[]} [...args] Additional arguments
     * @yields {Buffer} Read buffer
     */
    async* execute(streams, controller) {
        for await (const stream of streams) {         
            const name = `stream-${streamId++}`;

            if (!(stream instanceof Readable)) {
                throw new IllegalArgumentError(`[${name}] stream must be of type Readable`, stream);
            }

            const queue = new Queue(this.queueCapacity);
            let state = State.READ;
          
            const readStream = () => {
                while (state === State.READ) {
                    logger.debug(`[${name}] request ${this.partSize} bytes, highWaterMark: ${stream.readableHighWaterMark}, readableLength: ${stream.readableLength}`);
                    const chunk = stream.read(this.partSize);
                    if (chunk) {
                        logger.debug(`[${name}] read ${chunk.length} byte chunk, highWaterMark: ${stream.readableHighWaterMark}, readableLength: ${stream.readableLength}`);
                        if (!queue.push(chunk)) {
                            state = State.QUEUE_FULL;
                            logger.debug(`[${name}] queue is full`);
                        }
                    } else {
                        logger.debug(`[${name}] no data available, highWaterMark: ${stream.readableHighWaterMark}, readableLength: ${stream.readableLength}`);
                        break;
                    }            
                }
            };

            stream.on("end", () => {
                logger.debug(`[${name}] stream end event`);
                queue.complete();
            });

            stream.on("error", error => {
                logger.error(`[${name}] stream error event, highWaterMark: ${stream.readableHighWaterMark}, readableLength: ${stream.readableLength}.`, error);

                // acquire the data that's in the read buffer
                const chunk = stream.read();
                if (chunk) {
                    logger.debug(`[${name}] failed, read last ${chunk.length} byte chunk, highWaterMark: ${stream.readableHighWaterMark}, readableLength: ${stream.readableLength}`);
                    queue.push(chunk);
                }

                state = State.ERROR;
                controller.setError(error);
                queue.complete();
            });

            stream.on("readable", () => {
                if (state === State.READ) {
                    logger.debug(`[${name}] stream readable event, highWaterMark: ${stream.readableHighWaterMark}, readableLength: ${stream.readableLength}`);
                    readStream();
                } else {
                    logger.debug(`[${name}] stream readable event (ignored), highWaterMark: ${stream.readableHighWaterMark}, readableLength: ${stream.readableLength}`);
                }
            });

            queue.on("drain", () => {
                if (state === State.QUEUE_FULL) {
                    logger.debug(`[${name}] queue drain event, continue reading from stream`);
                    state = State.READ;
                    readStream();
                } else if (state === State.ERROR) {
                    logger.debug(`[${name}] queue drain event, ignored since stream failed`);
                }
            });

            yield* queue;
        }
    }
}

module.exports = {
    StreamReader
};
