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
const { AssetMetadata } = require('../../lib/asset/assetmetadata');

describe("AssetMetadata", () => {
    describe("contentLength", () => {
        it("contentLength wrong type", () => {
            assert.strict.throws(() => {
                new AssetMetadata(undefined, undefined, "100");
            }, Error("'contentLength' must be a non-negative number: 100 (string)"));
        });
        it("contentLength negative", () => {
            assert.strict.throws(() => {
                new AssetMetadata(undefined, undefined, -1);
            }, Error("'contentLength' must be a non-negative number: -1 (number)"));
        });
        it("contentLength Infinity", () => {
            assert.strict.throws(() => {
                new AssetMetadata(undefined, undefined, Infinity);
            }, Error("'contentLength' must be a non-negative number: Infinity (number)"));
        });
        it("contentLength -Infinity", () => {
            assert.strict.throws(() => {
                new AssetMetadata(undefined, undefined, -Infinity);
            }, Error("'contentLength' must be a non-negative number: -Infinity (number)"));
        });
        it("contentLength 0", () => {
            const metadata = new AssetMetadata(undefined, undefined, 0);
            assert.strictEqual(metadata.filename, undefined);
            assert.strictEqual(metadata.contentType, undefined);
            assert.strictEqual(metadata.contentLength, 0);
        });
        it("contentLength 1", () => {
            const metadata = new AssetMetadata(undefined, undefined, 1);
            assert.strictEqual(metadata.filename, undefined);
            assert.strictEqual(metadata.contentType, undefined);
            assert.strictEqual(metadata.contentLength, 1);
        });
    });
    describe("contentType", () => {
        it("contentType wrong type", () => {
            assert.strict.throws(() => {
                new AssetMetadata(undefined, 123, 100);
            }, Error("'contentType' must be a string: 123 (number)"));
        });
        it("contentType image/png", () => {
            const metadata = new AssetMetadata(undefined, "image/png", 100);
            assert.strictEqual(metadata.filename, undefined);
            assert.strictEqual(metadata.contentType, "image/png");
            assert.strictEqual(metadata.contentLength, 100);
        });
    });
    describe("filename", () => {
        it("filename wrong type", () => {
            assert.strict.throws(() => {
                new AssetMetadata(123, "image/png", 100);
            }, Error("'filename' must be a string: 123 (number)"));
        });
        it("filename asset.png", () => {
            const metadata = new AssetMetadata("asset.png", "image/png", 100);
            assert.strictEqual(metadata.filename, "asset.png");
            assert.strictEqual(metadata.contentType, "image/png");
            assert.strictEqual(metadata.contentLength, 100);
        });
    });
});