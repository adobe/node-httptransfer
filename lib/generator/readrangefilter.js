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

/**
 * @typedef {Object} ReadRangeFilterResult
 * @property {ReadRangeFilter.State} state State
 * @property {Buffer} [chunk] Sliced chunk to be read when state === "read"
 */

/**
 * Filter to determine which parts of the buffer chunks should be skipped, read, and
 * when the entire range has been read.
 */
class ReadRangeFilter {
    /**
     * Construct seek filter
     * 
     * @param {Number} streamOffset Starting stream offset (min: 0)
     * @param {Number} readStart Offset where to start reading (min: streamOffset)
     * @param {Number} readEnd Offset where to stop reading (min: readStart)
     */
    constructor(streamOffset, readStart, readEnd) {
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
     * Filter a chunk to see if it should be skipped, read, or if the
     * entire range has been read.
     * 
     * @param {Buffer} chunk Chunk to filter
     * @returns {ReadRangeFilterResult}
     */
    filter(chunk) {
        const chunkOffset = this.streamOffset;
        this.streamOffset += chunk.length;       
        if (chunkOffset >= this.readEnd) {
            return {
                state: ReadRangeFilter.State.COMPLETE,
            };
        } else if (this.streamOffset <= this.readStart) {
            return {
                state: ReadRangeFilter.State.SKIP
            };
        } else {
            const start = Math.max(0, this.readStart - chunkOffset);
            const end = Math.min(chunk.length, this.readEnd - chunkOffset);
            return {
                state: ReadRangeFilter.State.READ,
                chunk: chunk.slice(start, end)
            };
        }
    }
}

ReadRangeFilter.State = Object.freeze({
    READ: "read",
    SKIP: "skip",
    COMPLETE: "complete"
});

module.exports = {
    ReadRangeFilter
};