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
const { AsyncGeneratorFunction } = require("../generator/function");

/**
 * Aggregate "chunks" in to buffers of size `partSize`.
 */
class AggregateBuffers extends AsyncGeneratorFunction {
    /**
     * Construct a buffer aggregator.
     *
     * @param {Number} partSize Part size of the queues buffers
     */
    constructor(partSize) {
        super();
        if (!Number.isFinite(partSize) || (partSize < 1)) {
            throw new IllegalArgumentError("partSize must be 1 or larger", partSize);
        }
        this.partSize = partSize;
    }

    /**
     * Track progress and completion
     * 
     * @generator
     * @param {Buffer[]|AsyncGenerator} chunks Buffers of varying sizes
     * @yields {Buffer} Fixed size buffers 
     */
    async* execute(chunks) {
        let buffer = Buffer.allocUnsafe(this.partSize);
        let bufferOffset = 0;

        for await (const chunk of chunks) {
            if (!(chunk instanceof Buffer)) {
                throw new IllegalArgumentError("chunk must be of type Buffer", chunk);
            }
    
            let chunkOffset = 0;
            let chunkRemainder = chunk.length;
            while (chunkRemainder > 0) {
                let bufferRemainder = buffer.length - bufferOffset;
                const size = Math.min(chunkRemainder, bufferRemainder);
                chunk.copy(buffer, bufferOffset, chunkOffset, chunkOffset + size);
    
                chunkOffset += size;
                chunkRemainder -= size;
                bufferOffset += size;
                bufferRemainder -= size;
    
                if (bufferRemainder === 0) {
                    yield buffer;
                    buffer = Buffer.allocUnsafe(this.partSize);
                    bufferOffset = 0;
                }
            }   
        }

        if (bufferOffset > 0) {
            yield buffer.slice(0, bufferOffset);
        }
    }
}

module.exports = {
    AggregateBuffers
};
