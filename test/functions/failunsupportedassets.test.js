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
const { Asset } = require("../../lib/asset/asset");
const { AssetMetadata } = require("../../lib/asset/assetmetadata");
const { TransferAsset } = require("../../lib/asset/transferasset");
const { FailUnsupportedAssets } = require("../../lib/functions/failunsupportedassets");
const { ControllerMock } = require("./controllermock");

describe("FailUnsupportedAssets", () => {
    it("empty", async function() {
        const failUnsupportedAssets = new FailUnsupportedAssets;
        const controller = new ControllerMock;
        for await (const transferAsset of failUnsupportedAssets.execute([], controller)) {
            assert.fail(`no asset expected: ${transferAsset}`);
        }
    });
    it("supported", async function() {
        const source = new Asset("file://path/to/file.png");
        const target = new Asset("https://host/path/to/upload.png");
        const inputAsset = new TransferAsset(source, target, {
            metadata: new AssetMetadata(undefined, "image/png", 1)
        });
        const failUnsupportedAssets = new FailUnsupportedAssets;
        const controller = new ControllerMock;
        for await (const transferAsset of failUnsupportedAssets.execute([ inputAsset ], controller)) {
            assert.deepStrictEqual(transferAsset, inputAsset);
        }
        assert.deepStrictEqual(controller.notifications, []);
    });
    it("unsupported-empty-file", async function() {
        const source = new Asset("file://path/to/file.png");
        const target = new Asset("https://host/path/to/upload.png");
        const inputAsset = new TransferAsset(source, target, {
            metadata: new AssetMetadata(undefined, "image/png", 0)
        });
        const failUnsupportedAssets = new FailUnsupportedAssets;
        const controller = new ControllerMock;
        for await (const transferAsset of failUnsupportedAssets.execute([ inputAsset ], controller)) {
            assert.deepStrictEqual(transferAsset, inputAsset);
        }
        assert.deepStrictEqual(controller.notifications, [{
            eventName: "error",
            functionName: "FailUnsupportedAssets",
            props: undefined,
            transferItem: inputAsset,
            error: "File cannot be uploaded: Empty file"
        }]);
    });
    it("supported-parenthesis", async function() {
        const source = new Asset("file://path/to/file.png");
        const target = new Asset("https://host/path/to/(upload).png");
        const inputAsset = new TransferAsset(source, target, {
            metadata: new AssetMetadata(undefined, "image/png", 1)
        });
        const failUnsupportedAssets = new FailUnsupportedAssets;
        const controller = new ControllerMock;
        for await (const transferAsset of failUnsupportedAssets.execute([ inputAsset ], controller)) {
            assert.deepStrictEqual(transferAsset, inputAsset);
        }
        assert.deepStrictEqual(controller.notifications, []);
    });
});
