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

/* eslint-env mocha */

"use strict";

const assert = require("assert");
const DRange = require("drange");
const { IllegalArgumentError } = require("../lib/error");
const { Range } = require("../lib/range");

describe.only('range', () => {
    describe("construct", () => {
        it("invalid start type", () => {
            assert.throws(() => {
                new Range("start", 0);
            }, new IllegalArgumentError("start must be a number", "start"));
        });
        it("invalid end type", () => {
            assert.throws(() => {
                new Range(0, "end");
            }, new IllegalArgumentError("end must be 0 or higher", "end"));
        });
        it("invalid end value", () => {
            assert.throws(() => {
                new Range(0, -1);
            }, new IllegalArgumentError("end must be 0 or higher", -1));
        });
        it("length 0", () => {
            const range = new Range(0, 0);
            assert.strictEqual(range.empty, true);
            assert.strictEqual(range.length, 0);
            assert.strictEqual(range.start, 0);
            assert.strictEqual(range.end, 0);
        });
        it("length 1", () => {
            const range = new Range(0, 1);
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 1);
            assert.strictEqual(range.start, 0);
            assert.strictEqual(range.end, 1);
        });       
    });
    describe("modify", () => {
        it("invalid length type", () => {
            assert.throws(() => {
                const range = new Range(0, 0);
                range.length = "length";    
            }, new IllegalArgumentError("length must be 0 or higher", "length"));
        });
        it("length = -1", () => {
            assert.throws(() => {
                const range = new Range(0, 0);
                range.length = -1;
            }, new IllegalArgumentError("length must be 0 or higher", -1));
        });
        it("length = 0", () => {
            const range = new Range(5, 10);
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 5);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 10);
    
            range.length = 0;
    
            assert.strictEqual(range.empty, true);
            assert.strictEqual(range.length, 0);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 5);
        });
        it("length = 1", () => {
            const range = new Range(5, 10);
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 5);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 10);
    
            range.length = 1;
            
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 1);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 6);
        });
        it("invalid start type", () => {
            assert.throws(() => {
                const range = new Range(0, 0);
                range.start = "start";    
            }, new IllegalArgumentError("start must not be beyond the end 0", "start"));
        });
        it("start > end", () => {
            assert.throws(() => {
                const range = new Range(0, 0);
                range.start = 1;    
            }, new IllegalArgumentError("start must not be beyond the end 0", 1));
        });
        it("start = end", () => {
            const range = new Range(5, 10);
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 5);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 10);
    
            range.start = range.end;
            
            assert.strictEqual(range.empty, true);
            assert.strictEqual(range.length, 0);
            assert.strictEqual(range.start, 10);
            assert.strictEqual(range.end, 10);
        });
        it("start < end", () => {
            const range = new Range(5, 10);
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 5);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 10);
    
            range.start = range.end - 1;
            
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 1);
            assert.strictEqual(range.start, 9);
            assert.strictEqual(range.end, 10);
        });
        it("invalid end type", () => {
            assert.throws(() => {
                const range = new Range(0, 0);
                range.end = "end";    
            }, new IllegalArgumentError("end must not be before the start 0", "end"));
        });
        it("end < start", () => {
            assert.throws(() => {
                const range = new Range(0, 0);
                range.end = -1;    
            }, new IllegalArgumentError("end must not be before the start 0", -1));
        });
        it("end = start", () => {
            const range = new Range(5, 10);
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 5);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 10);
    
            range.end = range.start;
            
            assert.strictEqual(range.empty, true);
            assert.strictEqual(range.length, 0);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 5);
        });
        it("end > start", () => {
            const range = new Range(5, 10);
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 5);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 10);
    
            range.end = range.start + 1;
            
            assert.strictEqual(range.empty, false);
            assert.strictEqual(range.length, 1);
            assert.strictEqual(range.start, 5);
            assert.strictEqual(range.end, 6);
        });
    });
    it("clone", () => {
        const range1 = new Range(5, 10);
        const range2 = range1.clone();
        range2.start = 6;

        assert.strictEqual(range1.empty, false);
        assert.strictEqual(range1.length, 5);
        assert.strictEqual(range1.start, 5);
        assert.strictEqual(range1.end, 10);
        
        assert.strictEqual(range2.empty, false);
        assert.strictEqual(range2.length, 4);
        assert.strictEqual(range2.start, 6);
        assert.strictEqual(range2.end, 10);
    });
    it("drange", () => {
        const range = new Range(5, 10);
        assert.deepStrictEqual(range.drange(), new DRange(5, 9));
    });
    describe("includes", () => {
        it("before", () => {
            const range1 = new Range(5, 10);
            const range2 = new Range(10, 15);
            assert.strictEqual(range1.includes(range2), false);
        });
        it("intersects before", () => {
            const range1 = new Range(5, 10);
            const range2 = new Range(7, 15);
            assert.strictEqual(range1.includes(range2), false);
        });
        it("after", () => {
            const range1 = new Range(10, 15);
            const range2 = new Range(5, 10);
            assert.strictEqual(range1.includes(range2), false);
        });
        it("intersects after", () => {
            const range1 = new Range(7, 15);
            const range2 = new Range(5, 10);
            assert.strictEqual(range1.includes(range2), false);   
        });
        it("includes, same range", () => {
            const range1 = new Range(5, 10);
            const range2 = new Range(5, 10);
            assert.strictEqual(range1.includes(range2), true);
        });
        it("smaller range start", () => {
            const range1 = new Range(5, 10);
            const range2 = new Range(5, 6);
            assert.strictEqual(range1.includes(range2), true);   
        });
        it("smaller range middle", () => {
            const range1 = new Range(5, 10);
            const range2 = new Range(7, 8);
            assert.strictEqual(range1.includes(range2), true);
        });
        it("smaller range end", () => {
            const range1 = new Range(5, 10);
            const range2 = new Range(9, 10);
            assert.strictEqual(range1.includes(range2), true);
        });
    });
});
