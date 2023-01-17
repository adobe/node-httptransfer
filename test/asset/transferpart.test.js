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
const DRange = require("drange");
const fileUrl = require("file-url");
const { TransferPart } = require("../../lib/asset/transferpart");
const { TransferAsset } = require("../../lib/asset/transferasset");
const { Asset } = require("../../lib/asset/asset");
const { AssetMetadata } = require("../../lib/asset/assetmetadata");

function createPart() {
    const assetName = "asset.jpg";
    const targetUrl = new URL(`http://sometestdomainthatreallydoesnotexist.com/content/dam/${assetName}`);
    const source = new Asset(fileUrl("/test/source.jpg"));
    const target = new Asset(fileUrl("/test/target.jpg"));
    const transferAsset = new TransferAsset(source, target, {
        metadata: new AssetMetadata(assetName, "image/jpeg", 1024)
    });
    return new TransferPart(transferAsset, [targetUrl], new DRange(0, 1023));
}

describe("TransferPart", function () {
    it("test total size", function () {
        const part = createPart();
        assert.strictEqual(part.totalSize, 1024);
    });

    it("test content type", function () {
        const part = createPart();
        assert.strictEqual(part.contentType, "image/jpeg");
    });

    it("test target name", function () {
        const part = createPart();
        assert.strictEqual(part.targetName, "target.jpg");
    });
});