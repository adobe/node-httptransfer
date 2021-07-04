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

/* eslint-env mocha */

"use strict";

const assert = require("assert");
const { IllegalArgumentError } = require("../../lib/error");
// const { IllegalArgumentError } = require("../../lib/error");
const { ReadRangeFilter } = require("../../lib/generator/readrangefilter");
// const { StringReadable } = require("../streams");

describe.only("readrangefilter", () => {
    describe("constructor", () => {
        it("invalid streamOffset type", () => {
            assert.throws(() => {
                new ReadRangeFilter("str", 0, 1);
            }, new IllegalArgumentError("streamOffset must be 0 or higher", "str"));
        });
        it("invalid streamOffset value", () => {
            assert.throws(() => {
                new ReadRangeFilter(-1, 0, 1);
            }, new IllegalArgumentError("streamOffset must be 0 or higher", -1));
        });
        it("invalid readStart type", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, "str", 1);
            }, new IllegalArgumentError("readStart must be 0 or higher", "str"));
        });
        it("invalid readStart value", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, -1, 1);
            }, new IllegalArgumentError("readStart must be 0 or higher", -1));
        });
        it("invalid readEnd type", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, 0, "str");
            }, new IllegalArgumentError("readEnd must be 0 or higher", "str"));
        });
        it("invalid readEnd value", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, 0, -1);
            }, new IllegalArgumentError("readEnd must be 0 or higher", -1));
        });
    });
    describe("single chunk", () => {
        describe("first", () => {
            it("whole chunk", () => {
                const filter = new ReadRangeFilter(0, 0, 4);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "abcd");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
            it("first part of chunk", () => {
                const filter = new ReadRangeFilter(0, 0, 2);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ab");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
            it("last part of chunk", () => {
                const filter = new ReadRangeFilter(0, 2, 4);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
            it("middle part of chunk", () => {
                const filter = new ReadRangeFilter(0, 1, 3);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "bc");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
        });
        describe("skip", () => {
            it("whole chunk", () => {
                const filter = new ReadRangeFilter(0, 4, 8);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "skip");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);

                result = filter.filter(Buffer.from("efgh", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "efgh");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
            it("first part of chunk", () => {
                const filter = new ReadRangeFilter(0, 4, 6);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "skip");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);

                result = filter.filter(Buffer.from("efgh", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ef");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
            it("last part of chunk", () => {
                const filter = new ReadRangeFilter(0, 6, 8);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "skip");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
                
                result = filter.filter(Buffer.from("efgh", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "gh");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
            it("middle part of chunk", () => {
                const filter = new ReadRangeFilter(0, 5, 7);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "skip");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);

                result = filter.filter(Buffer.from("efgh", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "fg");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
        });
        describe("streamOffset !== 0", () => {
            it("whole chunk", () => {
                const filter = new ReadRangeFilter(4, 4, 8);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "abcd");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
            it("first part of chunk", () => {
                const filter = new ReadRangeFilter(4, 4, 6);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ab");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
            it("last part of chunk", () => {
                const filter = new ReadRangeFilter(4, 6, 8);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
            it("middle part of chunk", () => {
                const filter = new ReadRangeFilter(4, 5, 7);
                let result = filter.filter(Buffer.from("abcd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "bc");
                assert.strictEqual(filter.streamOffset, 8);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 8);
            });
        });
    });
    describe("span", () => {
        describe("span 2 chunks", () => {
            it("whole span", () => {
                const filter = new ReadRangeFilter(0, 0, 4);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ab");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
            it("middle first chunk", () => {
                const filter = new ReadRangeFilter(0, 1, 4);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "b");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
            it("middle last chunk", () => {
                const filter = new ReadRangeFilter(0, 0, 3);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ab");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "c");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
            it("middle first and last chunk", () => {
                const filter = new ReadRangeFilter(0, 1, 3);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "b");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "c");
                assert.strictEqual(filter.streamOffset, 4);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 4);
            });
        });
        describe("span 3 chunks", () => {
            it("whole span", () => {
                const filter = new ReadRangeFilter(0, 0, 6);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ab");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 4);

                result = filter.filter(Buffer.from("ef", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ef");
                assert.strictEqual(filter.streamOffset, 6);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 6);
            });
            it("middle first chunk", () => {
                const filter = new ReadRangeFilter(0, 1, 6);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "b");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 4);

                result = filter.filter(Buffer.from("ef", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ef");
                assert.strictEqual(filter.streamOffset, 6);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 6);
            });
            it("middle last chunk", () => {
                const filter = new ReadRangeFilter(0, 0, 5);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "ab");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 4);

                result = filter.filter(Buffer.from("ef", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "e");
                assert.strictEqual(filter.streamOffset, 6);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 6);
            });
            it("middle first and last chunk", () => {
                const filter = new ReadRangeFilter(0, 1, 5);
                let result = filter.filter(Buffer.from("ab", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "b");
                assert.strictEqual(filter.streamOffset, 2);

                result = filter.filter(Buffer.from("cd", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "cd");
                assert.strictEqual(filter.streamOffset, 4);

                result = filter.filter(Buffer.from("ef", "utf8"));
                assert.strictEqual(result.state, "read");
                assert.strictEqual(result.chunk.toString("utf8"), "e");
                assert.strictEqual(filter.streamOffset, 6);
    
                result = filter.filter(Buffer.alloc(0));
                assert.strictEqual(result.state, "complete");
                assert.strictEqual(result.chunk, undefined);
                assert.strictEqual(filter.streamOffset, 6);
            });
        });
    });
});
