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

'use strict';

const assert = require('assert');
const { AssetMultipart } = require('../../lib/asset/assetmultipart');

describe("AssetMultipart", () => {
    describe("valid", () => {
        it("required", () => {
            const multipart = new AssetMultipart(
                [ new URL("http://host/path/to/target") ], 
                100, 
                1000
            );
            assert.deepStrictEqual(multipart.targetUrls, [ new URL("http://host/path/to/target") ]);
            assert.strictEqual(multipart.minPartSize, 100);
            assert.strictEqual(multipart.maxPartSize, 1000);
            assert.deepStrictEqual(multipart.headers, undefined);
            assert.deepStrictEqual(multipart.completeUrl, undefined);
            assert.strictEqual(multipart.uploadToken, undefined);
        });
        it("headers", () => {
            const multipart = new AssetMultipart(
                [ new URL("http://host/path/to/target") ], 
                100, 
                1000, 
                { header1: "value1" }
            );
            assert.deepStrictEqual(multipart.targetUrls, [ new URL("http://host/path/to/target") ]);
            assert.strictEqual(multipart.minPartSize, 100);
            assert.strictEqual(multipart.maxPartSize, 1000);
            assert.deepStrictEqual(multipart.headers, { header1: "value1" });
            assert.deepStrictEqual(multipart.completeUrl, undefined);
            assert.strictEqual(multipart.uploadToken, undefined);
        });
        it("completeUrl", () => {
            const multipart = new AssetMultipart(
                [ new URL("http://host/path/to/target") ], 
                100, 
                1000, 
                undefined, 
                "http://host/path/to/completeUrl"
            );
            assert.deepStrictEqual(multipart.targetUrls, [ new URL("http://host/path/to/target") ]);
            assert.strictEqual(multipart.minPartSize, 100);
            assert.strictEqual(multipart.maxPartSize, 1000);
            assert.deepStrictEqual(multipart.headers, undefined);
            assert.deepStrictEqual(multipart.completeUrl, new URL("http://host/path/to/completeUrl"));
            assert.strictEqual(multipart.uploadToken, undefined);
        });
        it("uploadToken", () => {
            const multipart = new AssetMultipart(
                [ new URL("http://host/path/to/target") ], 
                100, 
                1000, 
                undefined, 
                undefined, 
                "uploadToken"
            );
            assert.deepStrictEqual(multipart.targetUrls, [ new URL("http://host/path/to/target") ]);
            assert.strictEqual(multipart.minPartSize, 100);
            assert.strictEqual(multipart.maxPartSize, 1000);
            assert.deepStrictEqual(multipart.headers, undefined);
            assert.deepStrictEqual(multipart.completeUrl, undefined);
            assert.strictEqual(multipart.uploadToken, "uploadToken");
        });
        it("all", () => {
            const multipart = new AssetMultipart(
                [ new URL("http://host/path/to/target") ], 
                100, 
                1000, 
                { header1: "value1" }, 
                "http://host/path/to/completeUrl", 
                "uploadToken"
            );
            assert.deepStrictEqual(multipart.targetUrls, [ new URL("http://host/path/to/target") ]);
            assert.strictEqual(multipart.minPartSize, 100);
            assert.strictEqual(multipart.maxPartSize, 1000);
            assert.deepStrictEqual(multipart.headers, {
                header1: "value1"
            });
            assert.deepStrictEqual(multipart.completeUrl, new URL("http://host/path/to/completeUrl"));
            assert.strictEqual(multipart.uploadToken, "uploadToken");
        });
    });
    describe("targetUrls", () => {
        it("wrong type", () => {
            assert.strict.throws(() => {
                new AssetMultipart("url", 100, 1000);
            }, Error("'targetUrls' must be a non-empty array: url (string)"));
        });
        it("empty array", () => {
            assert.strict.throws(() => {
                new AssetMultipart([], 100, 1000);
            }, Error("'targetUrls' must be a non-empty array: length=0 (array)"));
        });
        
    });
    describe("minPartSize", () => {
        it("wrong type", () => {
            assert.strict.throws(() => {
                new AssetMultipart([ new URL("http://host/path/to/target") ], "100", 1000);
            }, Error("'minPartSize' must be a positive number: 100 (string)"));
        });
        it("negative", () => {
            assert.strict.throws(() => {
                new AssetMultipart([ new URL("http://host/path/to/target") ], -1, 1000);
            }, Error("'minPartSize' must be a positive number: -1 (number)"));
        });
        it("zero", () => {
            assert.strict.throws(() => {
                new AssetMultipart([ new URL("http://host/path/to/target") ], 0, 1000);
            }, Error("'minPartSize' must be a positive number: 0 (number)"));
        });
    });
    describe("maxPartSize", () => {
        it("wrong type", () => {
            assert.strict.throws(() => {
                new AssetMultipart([ new URL("http://host/path/to/target") ], 100, "1000");
            }, Error("'maxPartSize' must be larger or equal to 'minPartSize' (minPartSize=100): 1000 (string)"));
        });
        it("too small", () => {
            assert.strict.throws(() => {
                new AssetMultipart([ new URL("http://host/path/to/target") ], 100, 99);
            }, Error("'maxPartSize' must be larger or equal to 'minPartSize' (minPartSize=100): 99 (number)"));
        });
        it("equal", () => {
            new AssetMultipart([ new URL("http://host/path/to/target") ], 100, 100);
        });
    });
    describe("completUrl", () => {
        it("invalid", () => {
            assert.strict.throws(() => {
                new AssetMultipart([ new URL("http://host/path/to/target") ], 100, 1000, undefined, "invalid-url");
            }, Error("'completeUrl' must be a http/https url: invalid-url (string)"));
        });
    });
});