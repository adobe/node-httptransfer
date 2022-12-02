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

const DRange = require("drange");
const fileUrl = require("file-url");
const assert = require("assert");
const { Blob } = require("blob-polyfill");

const { TransferPart } = require("../../lib/asset/transferpart");
const { TransferAsset } = require("../../lib/asset/transferasset");
const { Asset } = require("../../lib/asset/asset");
const { AssetMetadata } = require("../../lib/asset/assetmetadata");

describe("Transfer Part", function () {
    function createPart() {
        const assetName = "asset.jpg";
        const targetUrl = new URL(`http://sometestdomainthatreallydoesnotexist.com/content/dam/${assetName}`);
        const source = new Asset(fileUrl("/test/source.jpg"));
        const target = new Asset(fileUrl("/test/target.jpg"));
        const transferAsset = new TransferAsset(source, target, {
            metadata: new AssetMetadata(assetName, "image/jpeg", 1024)
        });
        return new TransferPart(transferAsset, [targetUrl], new DRange(0, 1024));
    }

    it("test create transfer part http body", function () {
        const part = createPart();
        assert.strictEqual(part.createPartHttpBody({ partData: "Hello World!" }), "Hello World!");
    });

    it("test create transfer part http headers with buffer", function () {
        const part = createPart();
        assert.deepStrictEqual(part.createPartHttpHeaders({
            httpBody: Buffer.from("Hello World!")
        }), {
            "content-length": 12,
            "content-type": "image/jpeg"
        });
    });

    it("test create transfer part http headers with blob", function () {
        const part = createPart();
        assert.deepStrictEqual(part.createPartHttpHeaders({
            httpBody: new Blob(['hello world 123'])
        }), {
            "content-length": 15,
            "content-type": "image/jpeg"
        });
    });
});