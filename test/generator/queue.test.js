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
const { Queue } = require("../../lib/generator/queue");

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

describe("queue", () => {
    describe("failure testing", () => {
        it("invalid capacity, zero", () => {
            assert.throws(
                () => new Queue(0),
                new IllegalArgumentError("capacity must be 1 or larger", 0)
            );   
        });
        it("invalid capacity, undefined", () => {
            assert.throws(
                () => new Queue(),
                new IllegalArgumentError("capacity must be 1 or larger", undefined)
            );   
        });
        it("fail, add after complete", async () => {
            assert.throws(() => {
                const queue = new Queue(1);
                queue.complete();
                queue.push(1);
            }, Error("Queue has been completed, rejecting new item: 1"));
        }); 
    });
    describe("add", () => {
        it("immediate complete", async () => {
            const queue = new Queue(1);
    
            let drained = 0;
            queue.on("drain", () => {
                ++drained;
            });
    
            const queueFull = !queue.push(1);
            queue.complete();
            assert.strictEqual(queue.length, 1);
            assert.strictEqual(queueFull, true);
            assert.strictEqual(drained, 0);
    
            const items = await toArray(queue);
            assert.deepStrictEqual(items, [ 1 ]);
            assert.strictEqual(drained, 1);
        });
        it("single item, exact capacity", async () => {
            const queue = new Queue(1);
    
            let drained = 0;
            queue.on("drain", () => {
                ++drained;
            });
    
            const queueFull = !queue.push(1);
            queue.complete();
            assert.strictEqual(queueFull, true);
            assert.strictEqual(queue.length, 1);
            assert.strictEqual(drained, 0);
    
            const items = await toArray(queue);
            assert.deepStrictEqual(items, [ 1 ]);
            assert.strictEqual(drained, 1);
        });
        it("two items, exact capacity", async () => {
            const queue = new Queue(2);
    
            let drained = 0;
            queue.on("drain", () => {
                ++drained;
            });
    
            let queueFull = !queue.push(1);
            assert.strictEqual(queue.length, 1);
            assert.strictEqual(queueFull, false);
            queueFull = !queue.push(2);
            assert.strictEqual(queue.length, 2);
            assert.strictEqual(queueFull, true);
            queue.complete();
            assert.strictEqual(drained, 0);
    
            const items = await toArray(queue);
            assert.deepStrictEqual(items, [ 1, 2 ]);
            assert.strictEqual(drained, 2); 
        });
        it("two items, over capacity", async () => {
            const queue = new Queue(1);
    
            let drained = 0;
            queue.on("drain", () => {
                ++drained;
            });
    
            let queueFull = !queue.push(1);
            assert.strictEqual(queue.length, 1);
            assert.strictEqual(queueFull, true);
            queueFull = !queue.push(2);
            assert.strictEqual(queue.length, 2);
            assert.strictEqual(queueFull, true);
            queue.complete();
            assert.strictEqual(drained, 0);
    
            const items = await toArray(queue);
            assert.deepStrictEqual(items, [ 1, 2 ]);
            assert.strictEqual(drained, 1); // drained only when we reached under our capacity of 1
        });
    });
    describe("asyncIterator", () => {
        it("complete", async () => {
            const queue = new Queue(2);
            const asyncIter = queue[Symbol.asyncIterator]();
            queue.complete();
            const item = await asyncIter.next();
            assert.deepStrictEqual(item, { done: true, value: undefined });
        });
        it("add, complete, steps", async () => {
            const queue = new Queue(2);
            const asyncIter = queue[Symbol.asyncIterator]();
            queue.push(1);
            let item = await asyncIter.next();
            assert.deepStrictEqual(item, { done: false, value: 1 });
            queue.push(2);
            item = await asyncIter.next();
            assert.deepStrictEqual(item, { done: false, value: 2 });
            queue.complete();
            item = await asyncIter.next();
            assert.deepStrictEqual(item, { done: true, value: undefined });
        });
    });
});