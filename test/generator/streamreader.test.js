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
const { StreamReaderReadable } = require("../../lib/generator/streamreader");
const { StringReadable } = require("../streams");

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

describe.only("streamreader", () => {
    describe("string", () => {
        it("exact", async () => {
            const stream = new StringReadable("hello world");
            const iter = new StreamReaderReadable(stream, 0, 11);
            const result = await toArray(iter);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "hello world");
        });
        it("beginning", async () => {
            const stream = new StringReadable("hello world");
            const iter = new StreamReaderReadable(stream, 0, 5);
            const result = await toArray(iter);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "hello");
        });
        it("ending", async () => {
            const stream = new StringReadable("hello world");
            const iter = new StreamReaderReadable(stream, 6, 11);
            const result = await toArray(iter);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "world");
        });
        it("middle", async () => {
            const stream = new StringReadable("hello world");
            const iter = new StreamReaderReadable(stream, 3, 8);
            const result = await toArray(iter);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "lo wo");
        });
    });
});
