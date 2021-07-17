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
const { AggregateBuffers } = require("../../lib/functions/aggregatebuffers");
const { IllegalArgumentError } = require("../../lib/error");

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

async function* toAsyncIterator(items) {
    for await (const item of items) {
        yield item;
    }
}

describe("AggregateBuffers", () => {
    describe("partSize", () => {
        it("invalid-partsize-type", () => {
            assert.throws(() => {
                new AggregateBuffers("1");
            }, new IllegalArgumentError("partSize must be 1 or larger", "1"));
        });
        it("invalid-partsize-value", () => {
            assert.throws(() => {
                new AggregateBuffers(0);
            }, new IllegalArgumentError("partSize must be 1 or larger", 0));
        });
        it("valid-partsize-value", () => {
            new AggregateBuffers(1);
        });
    });
    describe("invalid chunk", () => {
        it("invalid-chunk-type", async () => {
            try {
                const input = ["abc"];
                const aggregateBuffers = new AggregateBuffers(2);
                await toArray(aggregateBuffers.execute(input));
                assert.fail("expected to throw");
            } catch (e) {
                assert.strictEqual(e.message, "chunk must be of type Buffer: abc (string)");
            }
        });
    });
    describe("single chunk", () => {
        it("small", async () => {
            const input = [Buffer.alloc(1, "a", "utf-8")];
            const aggregateBuffers = new AggregateBuffers(2);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "a");
        });
        it("exact", async () => {
            const input = [Buffer.alloc(2, "a", "utf-8")];
            const aggregateBuffers = new AggregateBuffers(2);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "aa");
        });
        it("large", async () => {
            const input = [Buffer.alloc(3, "a", "utf-8")];
            const aggregateBuffers = new AggregateBuffers(2);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "aa");
            assert.strictEqual(result[1].toString("utf-8"), "a");
        });
    });
    describe("aggregate", () => {
        it("small", async () => {
            const input = [
                Buffer.alloc(1, "a", "utf-8"),
                Buffer.alloc(1, "b", "utf-8"),
                Buffer.alloc(1, "c", "utf-8")
            ];
            const aggregateBuffers = new AggregateBuffers(4);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abc");
        });
        it("exact", async () => {
            const input = [
                Buffer.alloc(1, "a", "utf-8"),
                Buffer.alloc(1, "b", "utf-8"),
                Buffer.alloc(1, "c", "utf-8"),
                Buffer.alloc(1, "d", "utf-8")
            ];
            const aggregateBuffers = new AggregateBuffers(4);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
        });
        it("large", async () => {
            const input = [
                Buffer.alloc(1, "a", "utf-8"),
                Buffer.alloc(1, "b", "utf-8"),
                Buffer.alloc(1, "c", "utf-8"),
                Buffer.alloc(1, "d", "utf-8"),
                Buffer.alloc(1, "e", "utf-8")
            ];
            const aggregateBuffers = new AggregateBuffers(4);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
            assert.strictEqual(result[1].toString("utf-8"), "e");
        });
    });
    describe("async-iterator", () => {
        it("small", async () => {
            const input = toAsyncIterator([
                Buffer.alloc(1, "a", "utf-8"),
                Buffer.alloc(1, "b", "utf-8"),
                Buffer.alloc(1, "c", "utf-8")
            ]);
            const aggregateBuffers = new AggregateBuffers(4);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abc");
        });
        it("exact", async () => {
            const input = toAsyncIterator([
                Buffer.alloc(1, "a", "utf-8"),
                Buffer.alloc(1, "b", "utf-8"),
                Buffer.alloc(1, "c", "utf-8"),
                Buffer.alloc(1, "d", "utf-8")
            ]);
            const aggregateBuffers = new AggregateBuffers(4);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
        });
        it("large", async () => {
            const input = toAsyncIterator([
                Buffer.alloc(1, "a", "utf-8"),
                Buffer.alloc(1, "b", "utf-8"),
                Buffer.alloc(1, "c", "utf-8"),
                Buffer.alloc(1, "d", "utf-8"),
                Buffer.alloc(1, "e", "utf-8")
            ]);
            const aggregateBuffers = new AggregateBuffers(4);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
            assert.strictEqual(result[1].toString("utf-8"), "e");
        });
    });
    describe("slice", () => {
        it("small", async () => {
            // slices smaller than buffer
            const buffer = Buffer.from("Hello World", "utf-8");
            const input = [];
            for (let i = 0; i < buffer.length; ++i) {
                input.push(buffer.slice(i, i+1));
            }
            const aggregateBuffers = new AggregateBuffers(6);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "Hello ");
            assert.strictEqual(result[1].toString("utf-8"), "World");
        });
        it("exact", async () => {
            // slices exact as buffer
            const buffer = Buffer.from("Hello World", "utf-8");
            const input = [
                buffer.slice(0, 6),
                buffer.slice(6)
            ];
            const aggregateBuffers = new AggregateBuffers(6);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "Hello ");
            assert.strictEqual(result[1].toString("utf-8"), "World");
        });
        it("large", async () => {
            // slices larger than buffer
            const buffer = Buffer.from("Hello World", "utf-8");
            const input = [
                buffer.slice(0, 6),
                buffer.slice(6)
            ];
            const aggregateBuffers = new AggregateBuffers(3);
            const result = await toArray(aggregateBuffers.execute(input));
            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].toString("utf-8"), "Hel");
            assert.strictEqual(result[1].toString("utf-8"), "lo ");
            assert.strictEqual(result[2].toString("utf-8"), "Wor");
            assert.strictEqual(result[3].toString("utf-8"), "ld");
        });
    });
});
