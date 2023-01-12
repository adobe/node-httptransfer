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
const DRange = require("drange");
const { IllegalArgumentError } = require("../../lib/error");
const { ReadRangeFilter } = require("../../lib/functions/readrangefilter");

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

describe.only("readrangefilter", () => {
    describe("constructor", () => {
        it("invalid streamOffset type", () => {
            assert.throws(() => {
                new ReadRangeFilter("str", new DRange(0, 0));
            }, new IllegalArgumentError("streamOffset must be 0 or higher", "str"));
        });
        it("invalid streamOffset value", () => {
            assert.throws(() => {
                new ReadRangeFilter(-1, new DRange(0, 0));
            }, new IllegalArgumentError("streamOffset must be 0 or higher", -1));
        });
        it("invalid readStart type", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, new DRange("str", 0));
            }, new IllegalArgumentError("readStart must be 0 or higher", "str"));
        });
        it("invalid readStart value", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, new DRange(-1, 0));
            }, new IllegalArgumentError("readStart must be 0 or higher", -1));
        });
        it("invalid readEnd type", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, new DRange(0, "str"));
            }, new IllegalArgumentError("readEnd must be 0 or higher", "str"));
        });
        it("invalid readEnd value", () => {
            assert.throws(() => {
                new ReadRangeFilter(0, new DRange(0, -1));
            }, new IllegalArgumentError("readEnd must be 0 or higher", -1));
        });
    });
    describe("single chunk", () => {
        describe("first", () => {
            it("whole chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 0, 4);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "abcd");
            });
            it("first part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 0, 2);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "ab");
            });
            it("last part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 2, 4);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "cd");
            });
            it("middle part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 1, 3);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "bc");
            });
        });
        describe("skip", () => {
            it("whole chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8"),
                    Buffer.from("efgh", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 4, 8);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "efgh");
            });
            it("first part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8"),
                    Buffer.from("efgh", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 4, 6);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "ef");
            });
            it("last part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8"),
                    Buffer.from("efgh", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 6, 8);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "gh");
            });
            it("middle part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8"),
                    Buffer.from("efgh", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 5, 7);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "fg");
            });
        });
        describe("streamOffset !== 0", () => {
            it("whole chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(4, 4, 8);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "abcd");
            });
            it("first part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(4, 4, 6);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "ab");
            });
            it("last part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(4, 6, 8);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "cd");
            });
            it("middle part of chunk", async () => {
                const input = [
                    Buffer.from("abcd", "utf8")
                ];
                const filter = new ReadRangeFilter(4, 5, 7);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "bc");
            });
        });
    });
    describe("span", () => {
        describe("span 2 chunks", () => {
            it("whole span", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 0, 4);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 2);
                assert.strictEqual(result[0].toString("utf-8"), "ab");
                assert.strictEqual(result[1].toString("utf-8"), "cd");
            });
            it("middle first chunk", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 1, 4);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 2);
                assert.strictEqual(result[0].toString("utf-8"), "b");
                assert.strictEqual(result[1].toString("utf-8"), "cd");
            });
            it("middle last chunk", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 0, 3);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 2);
                assert.strictEqual(result[0].toString("utf-8"), "ab");
                assert.strictEqual(result[1].toString("utf-8"), "c");
            });
            it("middle first and last chunk", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 1, 3);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 2);
                assert.strictEqual(result[0].toString("utf-8"), "b");
                assert.strictEqual(result[1].toString("utf-8"), "c");
            });
        });
        describe("span 3 chunks", () => {
            it("whole span", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8"),
                    Buffer.from("ef", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 0, 6);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 3);
                assert.strictEqual(result[0].toString("utf-8"), "ab");
                assert.strictEqual(result[1].toString("utf-8"), "cd");
                assert.strictEqual(result[2].toString("utf-8"), "ef");
            });
            it("middle first chunk", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8"),
                    Buffer.from("ef", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 1, 6);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 3);
                assert.strictEqual(result[0].toString("utf-8"), "b");
                assert.strictEqual(result[1].toString("utf-8"), "cd");
                assert.strictEqual(result[2].toString("utf-8"), "ef");
            });
            it("middle last chunk", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8"),
                    Buffer.from("ef", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 0, 5);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 3);
                assert.strictEqual(result[0].toString("utf-8"), "ab");
                assert.strictEqual(result[1].toString("utf-8"), "cd");
                assert.strictEqual(result[2].toString("utf-8"), "e");
            });
            it("middle first and last chunk", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8"),
                    Buffer.from("ef", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 1, 5);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 3);
                assert.strictEqual(result[0].toString("utf-8"), "b");
                assert.strictEqual(result[1].toString("utf-8"), "cd");
                assert.strictEqual(result[2].toString("utf-8"), "e");
            });
            it("second chunk", async () => {
                const input = [
                    Buffer.from("ab", "utf8"),
                    Buffer.from("cd", "utf8"),
                    Buffer.from("ef", "utf8")
                ];
                const filter = new ReadRangeFilter(0, 2, 4);
                const result = await toArray(filter.execute(input));
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].toString("utf-8"), "cd");
            });
        });
    });
    describe("empty range", () => {
        it("offset, end 0", async () => {
            const input = [
                Buffer.from("ab", "utf8")
            ];
            const filter = new ReadRangeFilter(0, 0, 0);
            const result = await toArray(filter.execute(input));
            assert.strictEqual(result.length, 0);
        });
        it("offset, end - middle chunk", async () => {
            const input = [
                Buffer.from("ab", "utf8")
            ];
            const filter = new ReadRangeFilter(0, 1, 1);
            const result = await toArray(filter.execute(input));
            assert.strictEqual(result.length, 0);
        });
        it("offset, end - end chunk", async () => {
            const input = [
                Buffer.from("ab", "utf8")
            ];
            const filter = new ReadRangeFilter(0, 2, 2);
            const result = await toArray(filter.execute(input));
            assert.strictEqual(result.length, 0);
        });
        it("offset, end - after chunk", async () => {
            const input = [
                Buffer.from("ab", "utf8")
            ];
            const filter = new ReadRangeFilter(0, 3, 3);
            const result = await toArray(filter.execute(input));
            assert.strictEqual(result.length, 0);
        });
        it("offset, end - after chunk - not empty range", async () => {
            const input = [
                Buffer.from("ab", "utf8")
            ];
            const filter = new ReadRangeFilter(0, 3, 4);
            const result = await toArray(filter.execute(input));
            assert.strictEqual(result.length, 0);
        });
        it("offset, end - second chunk", async () => {
            const input = [
                Buffer.from("ab", "utf8"),
                Buffer.from("cd", "utf8")
            ];
            const filter = new ReadRangeFilter(0, 3, 3);
            const result = await toArray(filter.execute(input));
            assert.strictEqual(result.length, 0);
        });
    });
});
