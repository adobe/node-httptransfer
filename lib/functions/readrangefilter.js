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
const { Range } = require("../asset/interval");
const logger = require("../logger");

/**
 * Filter to determine which parts of the buffer chunks should be skipped, read, and
 * when the entire range has been read.
 */
class ReadRangeFilter extends AsyncGeneratorFunction {
    /**
     * Construct seek filter
     * 
     * @param {Number} streamOffset Starting stream offset (min: 0)
     * @param {Range} range Range to read
     */
    constructor(streamOffset, range) {
        super();
        
        if (!Number.isFinite(streamOffset) || streamOffset < 0) {
            throw new IllegalArgumentError("streamOffset must be 0 or higher", streamOffset);
        }
        this.streamOffset = streamOffset;

        if (!(range instanceof Range) || (range.start < streamOffset)) {
            throw new IllegalArgumentError(`range must be a Range starting at or after ${streamOffset}`, range);
        }
        this.range = range;
    }

    /**
     * Track progress and completion
     * 
     * @generator
     * @param {Buffer[]|AsyncGenerator} chunks Buffers of varying sizes
     * @yields {Buffer} Fixed size buffers 
     */
    async* execute(chunks) {
        let streamOffset = this.streamOffset;
        for await (const chunk of chunks) {
            if (!(chunk instanceof Buffer)) {
                throw new IllegalArgumentError("chunk must be of type Buffer", chunk);
            }

            const intersect = this.range.intersect(streamOffset, chunk.length);
            if (!intersect.empty) {
                yield chunk.slice(intersect.start, intersect.end);
            } else {
                logger.info(`Skipped over ${streamOffset}-${streamOffset+chunk.length}`);
            }

            streamOffset += chunk.length;
        }
    }
}

module.exports = {
    ReadRangeFilter
};
