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
const { Asset } = require('../../lib/asset/asset');
const { TransferAsset } = require('../../lib/asset/transferasset');

// eslint-disable-next-line mocha/no-exclusive-tests
describe("TransferAsset", function() {
    it("c-tor no-arg fail", () => {
        assert.strict.throws(() => {
            new TransferAsset;
        }, Error("source is required to be of type Asset: undefined"));
    });
    it("c-tor download", () => {
        const source = new Asset("http://host/path/to/source.png");
        const target = new Asset("file:///path/to/target.png");
        const transferAsset = new TransferAsset(source, target);
        assert.deepStrictEqual(transferAsset.source, source);
        assert.deepStrictEqual(transferAsset.target, target);
        assert.deepStrictEqual(transferAsset.metadata, undefined);
        assert.strictEqual(transferAsset.acceptRanges, false);
        assert.deepStrictEqual(transferAsset.version, undefined);
        assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
        assert.deepStrictEqual(transferAsset.nameConflictPolicy, undefined);
        assert.deepStrictEqual(transferAsset.eventData, {
            fileName: "target.png",
            fileSize: undefined,
            targetFile: "/path/to/target.png",
            targetFolder: "/path/to"
        });
    });
    it("c-tor upload", () => {
        const source = new Asset("file:///path/to/source.png");
        const target = new Asset("http://host/path/to/target.png");
        const transferAsset = new TransferAsset(source, target);
        assert.deepStrictEqual(transferAsset.source, source);
        assert.deepStrictEqual(transferAsset.target, target);
        assert.deepStrictEqual(transferAsset.metadata, undefined);
        assert.strictEqual(transferAsset.acceptRanges, false);
        assert.deepStrictEqual(transferAsset.version, undefined);
        assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
        assert.deepStrictEqual(transferAsset.nameConflictPolicy, undefined);
        assert.deepStrictEqual(transferAsset.eventData, {
            fileName: "target.png",
            fileSize: undefined,
            targetFile: "/path/to/target.png",
            targetFolder: "/path/to"
        });
    });
    it("c-tor invalid source", () => {

    });
    
});
