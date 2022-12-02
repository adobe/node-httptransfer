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
const { CreateAssetServletPart } = require("../../lib/asset/createassetservletpart");
const { TransferAsset } = require("../../lib/asset/transferasset");
const { Asset } = require("../../lib/asset/asset");
const { AssetMetadata } = require("../../lib/asset/assetmetadata");

describe("Create Asset Servlet Part", function () {
    function createPart(contentRange) {
        const assetName = "asset.jpg";
        const targetUrl = new URL(`http://sometestdomainthatreallydoesnotexist.com/content/dam/${assetName}`);
        const source = new Asset(fileUrl("/test/source.jpg"));
        const target = new Asset(fileUrl("/test/target.jpg"));
        const transferAsset = new TransferAsset(source, target, {
            metadata: new AssetMetadata(assetName, "image/jpeg", 1024)
        });
        return new CreateAssetServletPart(transferAsset, [targetUrl], contentRange);
    }

    it("test create part http entities not chunked", function () {
        const fullContentRange = new DRange(0, 1023);
        const contentRange = fullContentRange.subranges()[0];
        const part = createPart(fullContentRange);
        assert.ok(!part.isChunked(contentRange));
        assert.strictEqual(part.totalSize, 1024);
        assert.strictEqual(part.contentType, "image/jpeg");

        const httpBody = part.createPartHttpBody({
            partData: 'testing',
            contentRange
        });
        assert.ok(httpBody);

        const httpHeaders = part.createPartHttpHeaders({
            httpBody,
            contentRange
        });
        assert.ok(String(httpHeaders["content-type"]).includes("form-data"));
        assert.ok(!httpHeaders["x-chunked-content-type"]);
        assert.ok(!httpHeaders["x-chunked-total-size"]);
    });


    it("test create part http entities chunked", function () {
        const fullContentRange = new DRange(0, 512);
        const contentRange = fullContentRange.subranges()[0];
        const part = createPart(fullContentRange);
        assert.ok(part.isChunked(contentRange));
        const httpBody = part.createPartHttpBody({
            partData: 'testing',
            contentRange
        });
        assert.ok(httpBody);

        const httpHeaders = part.createPartHttpHeaders({
            httpBody,
            contentRange
        });
        assert.ok(String(httpHeaders["content-type"]).includes("form-data"));
        assert.strictEqual(httpHeaders["x-chunked-content-type"], "image/jpeg");
        assert.strictEqual(httpHeaders["x-chunked-total-size"], 1024);
    });
});
