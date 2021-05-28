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
const { AssetVersion } = require('../../lib/asset/assetversion');

describe("AssetVersion", () => {
    describe("lastModified", () => {
        it("invalid type", () => {
            assert.strict.throws(() => {
                new AssetVersion("123");
            }, Error("'lastModified' must be a number: 123 (string)"));
        });
        it("date.now", () => {
            const now = Date.now();
            const version = new AssetVersion(now);
            assert.strictEqual(version.lastModified, now);
            assert.strictEqual(version.etag, undefined);
        });
    });
    describe("etag", () => {
        it("invalid type", () => {
            assert.strict.throws(() => {
                new AssetVersion(undefined, 123);
            }, Error("'etag' must be a string: 123 (number)"));
        });
        it("string", () => {
            const version = new AssetVersion(undefined, "etag");
            assert.strictEqual(version.lastModified, undefined);
            assert.strictEqual(version.etag, "etag");
        });
    });
});