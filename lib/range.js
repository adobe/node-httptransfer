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

const DRange = require("drange");
const { IllegalArgumentError } = require("./error");

const PRIVATE = Symbol("PRIVATE");

class Range {
    /**
     * Construct a half-open integer interval [start, end)
     * 
     * @param {Number} start Start offset
     * @param {Number} end End offset
     */
    constructor(start, end) {
        if (!Number.isFinite(start)) {
            throw new IllegalArgumentError(`start must be a number`, start);
        }
        if (!Number.isFinite(end) || end < start) {
            throw new IllegalArgumentError(`end must be ${start} or higher`, end);
        }
        this[PRIVATE] = {
            start,
            end
        };
    }

    /**
     * Check if the interval is empty
     */
    get empty() {
        return (this[PRIVATE].end - this[PRIVATE].start) === 0;
    }

    /**
     * Length of the interval 
     */
    get length() {
        return this[PRIVATE].end - this[PRIVATE].start;
    }

    /**
     * Adjust the length of the interval
     */
    set length(value) {
        if (!Number.isFinite(value) || value < 0) {
            throw new IllegalArgumentError(`length must be 0 or higher`, value);
        }
        this[PRIVATE].end = this[PRIVATE].start + value;
    }

    /**
     * Start of the interval
     * 
     * @returns {Number} Start offset
     */
    get start() {
        return this[PRIVATE].start;        
    }

    /**
     * Adjust the start of the interval, must not be beyond the end
     * 
     * @property {Number} value New starting offset of the interval
     */
    set start(value) {
        const end = this[PRIVATE].end;
        if (!Number.isFinite(value) || value > end) {
            throw new IllegalArgumentError(`start must not be beyond the end ${end}`, value);
        }
        this[PRIVATE].start = value;
    }

    /**
     * End of the interval
     * 
     * @returns {Number} End offset
     */
    get end() {
        return this[PRIVATE].end;        
    }

    /**
     * Adjust the end of the interval, must not be before the start
     * 
     * @property {Number} value New end offset of the interval
     */
    set end(value) {
        const start = this[PRIVATE].start;
        if (!Number.isFinite(value) || value < start) {
            throw new IllegalArgumentError(`end must not be before the start ${start}`, value);
        }
        this[PRIVATE].end = value;
    }

    /**
     * Clone range
     * 
     * @returns {Range} Cloned range
     */
    clone() {
        return new Range(this[PRIVATE].start, this[PRIVATE].end);
    }

    /**
     * Construct a DRange instance of the interval
     * 
     * @returns {DRange} DRange instance of the interval
     */
    drange() {
        return new DRange(this[PRIVATE].start, this[PRIVATE].end - 1);
    }

    /**
     * Check if the given range is included in this range
     * 
     * @param {Range} range Range
     * @returns {Boolean} True if range is included in this range
     */
    includes(range) {
        if (!(range instanceof Range)) {
            throw new IllegalArgumentError("range must be of type Range", range);
        }
        return (range.start >= this[PRIVATE].start) && 
            (range.end <= this[PRIVATE].end);
    }
}

module.exports = {
    Range
};