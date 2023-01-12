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
const { IllegalArgumentError } = require("../error");

const PRIVATE = Symbol("PRIVATE");

class Interval {
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
        return (this.end - this.start) === 0;
    }

    /**
     * Length of the interval 
     */
    get length() {
        return this.end - this.start;
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
     * End of the interval
     * 
     * @returns {Number} End offset
     */
    get end() {
        return this[PRIVATE].end;        
    }

    /**
     * Construct a DRange instance of the interval
     * 
     * @returns {DRange} DRange instance of the interval
     */
    get drange() {
        // TODO: empty interval?
        return new DRange(this.start, this.end - 1);
    }

    /**
     * Check if the given range is included in this range
     * 
     * @param {Interval} interval Interval
     * @returns {Boolean} True if range is included in this range
     */
    includes(interval) {
        if (!(interval instanceof Interval)) {
            throw new IllegalArgumentError("interval must be of type Interval", interval);
        }
        return (interval.start >= this.start) && 
            (interval.end <= this.end);
    }

    /**
     * Return the intersection between this and the provided interval
     * 
     * @param {Interval} interval Interval
     * @returns {Interval} intersection between intervals
     */    
    intersect(interval) {
        if (!(interval instanceof Interval)) {
            throw new IllegalArgumentError("interval must be of type Interval", interval);
        }

        const start = Math.max(this.start, interval.start);
        const end = Math.min(this.end, interval.end);
        if (start <= end) {
            return new Interval(start, end);
        } else {
            return new Interval(this.end, this.end);
        }
    }
    
    /**
     * String representation of interval
     * 
     * @returns {String} "[start, end)""
     */
    toString() {
        return `[${this.start}, ${this.end})`;
    }
}

module.exports = {
    Interval
};