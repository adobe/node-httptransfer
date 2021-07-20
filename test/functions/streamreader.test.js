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
const { StreamReader } = require("../../lib/functions/streamreader");
const { StringReadable, createErrorReadable } = require("../streams");

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

describe("streamreader", () => {
    describe("constructor", () => {
        it("invalid partSize type", () => {
            assert.throws(() => {
                new StreamReader({
                    partSize: "str"
                });
            }, new IllegalArgumentError("partSize must be 1 or higher", "str"));
        });
        it("invalid partSize value", () => {
            assert.throws(() => {
                new StreamReader({
                    partSize: -1
                });
            }, new IllegalArgumentError("partSize must be 1 or higher", -1));
        });
        it("partSize default, no value", () => {
            const streamReader = new StreamReader();
            assert.strictEqual(streamReader.partSize, 10485760);
        });
        it("partSize default, value 0", () => {
            const streamReader = new StreamReader({
                partSize: 0
            });
            assert.strictEqual(streamReader.partSize, 10485760);
        });
        it("invalid queueCapacity type", () => {
            assert.throws(() => {
                new StreamReader({
                    queueCapacity: "str"
                });
            }, new IllegalArgumentError("queueCapacity must be 1 or higher", "str"));
        });
        it("invalid queueCapacity value", () => {
            assert.throws(() => {
                new StreamReader({
                    queueCapacity: -1
                });
            }, new IllegalArgumentError("queueCapacity must be 1 or higher", -1));
        });
        it("queueCapacity default, no value", () => {
            const streamReader = new StreamReader();
            assert.strictEqual(streamReader.queueCapacity, 1);
        });
        it("queueCapacity default, value 0", () => {
            const streamReader = new StreamReader({
                queueCapacity: 0
            });
            assert.strictEqual(streamReader.queueCapacity, 1);
        });
    });
    describe("execute", () => {
        it("invalid type", async () => {
            try {
                const reader = new StreamReader({ partSize: 10 });
                const generator = reader.execute(["str"]);
                await toArray(generator);
                assert.fail("test expected to fail");
            } catch (e) {
                assert.strictEqual(e.message, "[stream-0] stream must be of type Readable: str (string)");
            }
        });
        it("partSize < length", async () => {
            const stream = new StringReadable("hello world");
            const reader = new StreamReader({ partSize: 10 });
            const generator = reader.execute([stream]);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].toString("utf-8"), "hello worl");
            assert.strictEqual(result[1].toString("utf-8"), "d");
        });
        it("partSize = length", async () => {
            const stream = new StringReadable("hello world");
            const reader = new StreamReader({ partSize: 11 });
            const generator = reader.execute([stream]);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "hello world");
        });
        it("partSize > length", async () => {
            const stream = new StringReadable("hello world");
            const reader = new StreamReader({ partSize: 12 });
            const generator = reader.execute([stream]);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "hello world");
        });
        it("partSize = 1", async () => {
            const stream = new StringReadable("hello world");
            const reader = new StreamReader({ partSize: 1 });
            const generator = reader.execute([stream]);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 11);
            assert.strictEqual(result[0].toString("utf-8"), "h");
            assert.strictEqual(result[1].toString("utf-8"), "e");
            assert.strictEqual(result[2].toString("utf-8"), "l");
            assert.strictEqual(result[3].toString("utf-8"), "l");
            assert.strictEqual(result[4].toString("utf-8"), "o");
            assert.strictEqual(result[5].toString("utf-8"), " ");
            assert.strictEqual(result[6].toString("utf-8"), "w");
            assert.strictEqual(result[7].toString("utf-8"), "o");
            assert.strictEqual(result[8].toString("utf-8"), "r");
            assert.strictEqual(result[9].toString("utf-8"), "l");
            assert.strictEqual(result[10].toString("utf-8"), "d");
        });
        it("1 part, no queue full", async () => {
            const stream = new StringReadable("hello world");
            const reader = new StreamReader({ partSize: 11, queueCapacity: 2 });
            const generator = reader.execute([stream]);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "hello world");
        });
        it("partSize = 1, queueSize = 4", async () => {
            const stream = new StringReadable("hello world");
            const reader = new StreamReader({ partSize: 1, queueCapacity: 4 });
            const generator = reader.execute([stream]);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 11);
            assert.strictEqual(result[0].toString("utf-8"), "h");
            assert.strictEqual(result[1].toString("utf-8"), "e");
            assert.strictEqual(result[2].toString("utf-8"), "l");
            assert.strictEqual(result[3].toString("utf-8"), "l");
            assert.strictEqual(result[4].toString("utf-8"), "o");
            assert.strictEqual(result[5].toString("utf-8"), " ");
            assert.strictEqual(result[6].toString("utf-8"), "w");
            assert.strictEqual(result[7].toString("utf-8"), "o");
            assert.strictEqual(result[8].toString("utf-8"), "r");
            assert.strictEqual(result[9].toString("utf-8"), "l");
            assert.strictEqual(result[10].toString("utf-8"), "d");
        });
    });
    describe("stream error", () => {
        it("immediate", async () => {
            const expectedError = Error("failure");
            const stream = createErrorReadable(expectedError);
            const reader = new StreamReader({ partSize: 1 });
            let actualError;
            const controller = {
                setError: e => {
                    actualError = e;
                }
            };
            const generator = reader.execute([stream], controller);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 0);
            assert.deepStrictEqual(actualError, expectedError);
        });
        it("mid stream", async () => {
            const expectedError = Error("failure");
            const stream = new StringReadable("hello world", expectedError);
            const reader = new StreamReader({ partSize: 5 });
            let actualError;
            const controller = {
                setError: e => {
                    actualError = e;
                }
            };
            const generator = reader.execute([stream], controller);
            const result = await toArray(generator);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toString("utf-8"), "hello world");
            assert.deepStrictEqual(actualError, expectedError);
        });
    });
});
