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

const { IllegalArgumentError } = require("../error");
const { Queue } = require("./queue");

/**
 * Splits and aggregates buffers in fixed size parts.
 */
class AggregateBuffers {
    /**
     * Construct an async buffer queue
     * 
     * @param {Queue} queue Queue where parts are added to
     * @param {Number} partSize Part size of the queues buffers
     */
    constructor(queue, partSize) {
        if (!(queue instanceof Queue) || !Array.isArray(queue)) {
            throw new IllegalArgumentError("queue must be of type Queue or Array", queue);
        }
        if (!Number.isFinite(partSize) || (partSize < 1)) {
            throw new IllegalArgumentError("partSize must be 1 or larger", partSize);
        }

        this.queue = queue;
        this.partSize = partSize;
        this.buffer = Buffer.allocUnsafe(partSize);
        this.bufferOffset = 0;
    }

    /**
     * Add chunk to the queue
     * 
     * @param {Buffer} chunk Chunk to add to the queue 
     * @return {Number} Length of the queue
     */
    push(chunk) {
        if (!(chunk instanceof Buffer)) {
            throw new IllegalArgumentError("chunk must be of type Buffer", chunk);
        }

        let result;
        let chunkOffset = 0;
        let chunkRemainder = chunk.length;
        while (chunkRemainder > 0) {
            let bufferRemainder = this.buffer.length - this.bufferOffset;
            const size = Math.min(chunkRemainder, bufferRemainder);
            chunk.copy(this.buffer, this.bufferOffset, chunkOffset, chunkOffset + size);

            chunkOffset += size;
            chunkRemainder -= size;
            this.bufferOffset += size;
            bufferRemainder -= size;

            if (bufferRemainder === 0) {
                result = this.queue.push(this.buffer);
                this.buffer = Buffer.allocUnsafe(this.partSize);
                this.bufferOffset = 0;
            }
        }

        return result;
    }

    /**
     * Flush the remainder of the buffer on the queue
     *
     * @return {Number} Length of the queue
     */
    flush() {
        if (this.bufferOffset > 0) {
            const remainder = this.buffer.slice(0, this.bufferOffset);
            return this.queue.push(remainder);
        } else {
            return this.queue.length;
        }
    }
}

module.exports = {
    AggregateBuffers
};
