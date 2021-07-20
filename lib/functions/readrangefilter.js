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
 * Filter to determine which parts of the buffer chunks should be skipped, read, and
 * when the entire range has been read.
 */
class ReadRangeFilter extends AsyncGeneratorFunction {
    /**
     * Construct seek filter
     * 
     * @param {Number} streamOffset Starting stream offset (min: 0)
     * @param {Number} readStart Offset where to start reading (min: streamOffset)
     * @param {Number} readEnd Offset where to stop reading (min: readStart)
     */
    constructor(streamOffset, readStart, readEnd) {
        super();
        if (!Number.isFinite(streamOffset) || streamOffset < 0) {
            throw new IllegalArgumentError("streamOffset must be 0 or higher", streamOffset);
        }
        if (!Number.isFinite(readStart) || readStart < streamOffset) {
            throw new IllegalArgumentError(`readStart must be ${streamOffset} or higher`, readStart);
        }
        if (!Number.isFinite(readEnd) || readEnd < readStart) {
            throw new IllegalArgumentError(`readEnd must be ${readStart} or higher`, readEnd);
        }
        this.streamOffset = streamOffset;
        this.readStart = readStart;
        this.readEnd = readEnd;
    }

    /**
     * Track progress and completion
     * 
     * @generator
     * @param {Buffer[]|AsyncGenerator} chunks Buffers of varying sizes
     * @yields {Buffer} Fixed size buffers 
     */
    async* execute(chunks) {
        let chunkOffset = this.streamOffset;
        for await (const chunk of chunks) {
            if (!(chunk instanceof Buffer)) {
                throw new IllegalArgumentError("chunk must be of type Buffer", chunk);
            }

            this.streamOffset += chunk.length;
            if (chunkOffset >= this.readEnd) {
                return;
            } else if (this.streamOffset > this.readStart) {
                const start = Math.max(0, this.readStart - chunkOffset);
                const end = Math.min(chunk.length, this.readEnd - chunkOffset);
                if (end > start) {
                    yield chunk.slice(start, end);
                }
                if (this.streamOffset >= this.readEnd) {
                    return;
                }
            }
            chunkOffset = this.streamOffset;
        }
    }
}

module.exports = {
    ReadRangeFilter
};
