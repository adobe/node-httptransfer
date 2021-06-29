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
const { AggregateBuffers } = require("../../lib/generator/aggregatebuffers");
const { IllegalArgumentError } = require("../../lib/error");
const { Queue } = require("../../lib/generator/queue");

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

describe("aggregatebuffers", () => {
    describe("failure", () => {
        it("invalid-queue-param", () => {
            assert.throws(() => {
                new AggregateBuffers("abc", 1);
            }, new IllegalArgumentError("queue must be of type Queue or Array", "abc"));
        });
        it("invalid-partsize-type", () => {
            assert.throws(() => {
                new AggregateBuffers([], "1");
            }, new IllegalArgumentError("partSize must be 1 or larger", "1"));
        });
        it("invalid-partsize-value", () => {
            assert.throws(() => {
                new AggregateBuffers([], 0);
            }, new IllegalArgumentError("partSize must be 1 or larger", 0));
        });
        it("invalid-push-chunk-type", () => {
            assert.throws(() => {
                new AggregateBuffers([], 1).push("abc");
            }, new IllegalArgumentError("chunk must be of type Buffer", "abc"));
        });
    });
    describe("single chunk", () => {
        it("small", () => {
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 2);
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "a", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "a");
        });
        it("exact", () => {
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 2);
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(2, "a", "utf-8"));
            assert.strictEqual(result.length, 1);
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "aa");
        });
        it("large", () => {
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 2);
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(3, "a", "utf-8"));
            assert.strictEqual(result.length, 1);
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "aa");
            assert.strictEqual(result[1].toString("utf-8"), "a");
        });
    });
    describe("accumulate", () => {
        it("small", () => {
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 4);
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "a", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "b", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "c", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abc");
        });
        it("exact", () => {
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 4);
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "a", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "b", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "c", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "d", "utf-8"));
            assert.strictEqual(result.length, 1);
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
        });
        it("large", () => {
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 4);
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "a", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "b", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "c", "utf-8"));
            assert.strictEqual(result.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "d", "utf-8"));
            assert.strictEqual(result.length, 1);
            aggregateBuffers.push(Buffer.alloc(1, "e", "utf-8"));
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
            assert.strictEqual(result[1].toString("utf-8"), "e");
        });
    });
    describe("queue", () => {
        it("small", async () => {
            const queue = new Queue(1);
            const aggregateBuffers = new AggregateBuffers(queue, 4);
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "a", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "b", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "c", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.flush();
            queue.complete();
            assert.strictEqual(queue.length, 1);
            const result = await toArray(queue);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abc");
        });
        it("exact", async () => {
            const queue = new Queue(1);
            const aggregateBuffers = new AggregateBuffers(queue, 4);
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "a", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "b", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "c", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "d", "utf-8"));
            assert.strictEqual(queue.length, 1);
            aggregateBuffers.flush();
            queue.complete();
            assert.strictEqual(queue.length, 1);
            const result = await toArray(queue);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
        });
        it("large", async () => {
            const queue = new Queue(1);
            const aggregateBuffers = new AggregateBuffers(queue, 4);
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "a", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "b", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "c", "utf-8"));
            assert.strictEqual(queue.length, 0);
            aggregateBuffers.push(Buffer.alloc(1, "d", "utf-8"));
            assert.strictEqual(queue.length, 1);
            aggregateBuffers.push(Buffer.alloc(1, "e", "utf-8"));
            aggregateBuffers.flush();
            queue.complete();
            assert.strictEqual(queue.length, 2);
            const result = await toArray(queue);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "abcd");
            assert.strictEqual(result[1].toString("utf-8"), "e");
        });
    });
    describe("slice", () => {
        it("small", () => {
            // slices smaller than buffer
            const buffer = Buffer.from("Hello World", "utf-8");
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 6);
            for (let i = 0; i < buffer.length; ++i) {
                aggregateBuffers.push(buffer.slice(i, i+1));
            }
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "Hello ");
            assert.strictEqual(result[1].toString("utf-8"), "World");
        });
        it("exact", () => {
            // slices exact as buffer
            const buffer = Buffer.from("Hello World", "utf-8");
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 6);
            aggregateBuffers.push(buffer.slice(0, 6));
            aggregateBuffers.push(buffer.slice(6));
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "Hello ");
            assert.strictEqual(result[1].toString("utf-8"), "World");
        });
        it("large", () => {
            // slices larger than buffer
            const buffer = Buffer.from("Hello World", "utf-8");
            const result = [];
            const aggregateBuffers = new AggregateBuffers(result, 3);
            aggregateBuffers.push(buffer.slice(0, 6));
            aggregateBuffers.push(buffer.slice(6));
            aggregateBuffers.flush();
            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].toString("utf-8"), "Hel");
            assert.strictEqual(result[1].toString("utf-8"), "lo ");
            assert.strictEqual(result[2].toString("utf-8"), "Wor");
            assert.strictEqual(result[3].toString("utf-8"), "ld");
        });
    });
});
