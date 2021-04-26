/*
 * Copyright 2020 Adobe. All rights reserved.
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

function isValidNumber(value) {
    return (typeof value === "number" && !isNaN(value));
}

class Range {
    /**
     * Create a range from [start, end)
     * 
     * @param {Number} start Starting point of the range 
     * @param {Number} end End point of the range
     */
    constructor(start, end) {
        if (!isValidNumber(start) || !isValidNumber(end) || (start > end)) {
            throw Error(`Invalid range: ${start}..${end}`);
        }
        /**
         * Starting point of the range
         * @type {Number}
         */
        this.start = start;
        /**
         * Ending point of the range
         * @type {Number}
         */
        this.end = end;
    }

    /**
     * Length of the range
     * 
     * @returns {Number} Length of the range
     */
    get length() {
        return (this.end - this.start);
    }

    /**
     * Check if this range is empty 
     * 
     * @returns {Boolean} True if the range is empty
     */
    get empty() {
        return this.length <= 0;
    }

    /**
     * Check if two ranges are sequential
     * 
     * @param {*} range 
     * @returns {Boolean} True if the given range is right before or after this range
     */
    sequential(range) {
        return (this.start === range.end || this.end === range.start);
    }

    /**
     * Union of two ranges
     * 
     * @param {Range} range
     * @returns {Range} Union of the 2 ranges
     */
    union(range) {
        return new Range(
            Math.min(this.start, range.start),
            Math.max(this.end, range.end)
        );
    }

    /**
     * Returns the intersection with the given rnage
     * 
     * @param {Range} range 
     */
    intersection(range) {

    }

    /**
     * 
     * @param {Range} range 
     */
    difference(range) {

    }

    slice(start, end) {

    }

    *subRanges(length) {

    }
}

module.exports = {
    Range
};
