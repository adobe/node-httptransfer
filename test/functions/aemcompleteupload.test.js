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
const nock = require('nock');
const { Asset } = require('../../lib/asset/asset');
const { AssetMetadata } = require('../../lib/asset/assetmetadata');
const { AssetMultipart } = require('../../lib/asset/assetmultipart');
const { NameConflictPolicy } = require('../../lib/asset/nameconflictpolicy');
const { TransferAsset } = require('../../lib/asset/transferasset');
const { AEMCompleteUpload } = require("../../lib/functions/aemcompleteupload");

class ControllerMock {
    constructor() {
        this.emittedEvents = [];
    }
    emit(event, ...args) {
        this.emittedEvents.push({
            event,
            args
        });
    }
}

/**
 * @typedef {Object} CreateTransferAssetOptions
 * @property {NameConflictPolicy} nameConflictPolicy Name conflict policy
 */
/**
 * Create a transfer asset with a custom name conflict policy
 * @property {CreateTransferAssetOptions} [options] Options
 * @returns {TransferAsset} Transfer asset
 */
function createTransferAsset(options) {
    const source = new Asset("file:///path/to/source.png");
    const target = new Asset("http://host/path/to/target.png");
    const metadata = new AssetMetadata(undefined, "image/png", 1234);
    const multipartTarget = new AssetMultipart(
        [ "http://host/path/to/target-block-1.png" ], 
        1000, 
        10000, 
        undefined, 
        "http://host/path/to.completeUpload.json", 
        "upload-token"
    );

    return new TransferAsset(source, target, {
        metadata,
        multipartTarget,
        nameConflictPolicy: options && options.nameConflictPolicy
    });
}

describe("AEMCompleteUpload", () => {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });
    describe("name conflict policy", () => {
        it("default", async () => {
            const transferAsset = createTransferAsset();
    
            nock('http://host')
                .post(
                    "/path/to.completeUpload.json", 
                    "fileName=target.png&fileSize=1234&mimeType=image%2Fpng&createVersion=false&replace=false&uploadToken=upload-token"
                )
                .reply(200, '{}', {
                    "content-type": "application/json"
                });
    
            const controller = new ControllerMock();
            const completeUpload = new AEMCompleteUpload(controller, {
                retryEnabled: false
            });
            for await (const asset of completeUpload.execute([ transferAsset ])) {
                assert.deepStrictEqual(asset, transferAsset);
            }

            assert.deepStrictEqual(controller.emittedEvents, [{
                event: "beforecompleteupload",
                args: [{ transferAsset }]
            }, {
                event: "aftercompleteupload",
                args: [{ transferAsset }]
            }]);
        });
        it("replace asset", async () => {
            const transferAsset = createTransferAsset({
                nameConflictPolicy: NameConflictPolicy.replaceAssetPolicy()
            });
    
            nock('http://host')
                .post(
                    "/path/to.completeUpload.json", 
                    "fileName=target.png&fileSize=1234&mimeType=image%2Fpng&createVersion=false&replace=true&uploadToken=upload-token"
                )
                .reply(200, '{}', {
                    "content-type": "application/json"
                });
    
            const controller = new ControllerMock();
            const completeUpload = new AEMCompleteUpload(controller, {
                retryEnabled: false
            });
            for await (const asset of completeUpload.execute([ transferAsset ])) {
                assert.deepStrictEqual(asset, transferAsset);
            }

            assert.deepStrictEqual(controller.emittedEvents, [{
                event: "beforecompleteupload",
                args: [{ transferAsset }]
            }, {
                event: "aftercompleteupload",
                args: [{ transferAsset }]
            }]);
        });
        it("create version", async () => {
            const transferAsset = createTransferAsset({
                nameConflictPolicy: NameConflictPolicy.createVersionPolicy()
            });
    
            nock('http://host')
                .post(
                    "/path/to.completeUpload.json", 
                    "fileName=target.png&fileSize=1234&mimeType=image%2Fpng&createVersion=true&replace=false&uploadToken=upload-token"
                )
                .reply(200, '{}', {
                    "content-type": "application/json"
                });
    
            const controller = new ControllerMock();
            const completeUpload = new AEMCompleteUpload(controller, {
                retryEnabled: false
            });
            for await (const asset of completeUpload.execute([ transferAsset ])) {
                assert.deepStrictEqual(asset, transferAsset);
            }

            assert.deepStrictEqual(controller.emittedEvents, [{
                event: "beforecompleteupload",
                args: [{ transferAsset }]
            }, {
                event: "aftercompleteupload",
                args: [{ transferAsset }]
            }]);
        });
        it("create version - label", async () => {
            const transferAsset = createTransferAsset({
                nameConflictPolicy: NameConflictPolicy.createVersionPolicy("version-label")
            });
    
            nock('http://host')
                .post(
                    "/path/to.completeUpload.json", 
                    "fileName=target.png&fileSize=1234&mimeType=image%2Fpng&createVersion=true&versionLabel=version-label&replace=false&uploadToken=upload-token"
                )
                .reply(200, '{}', {
                    "content-type": "application/json"
                });
    
            const controller = new ControllerMock();
            const completeUpload = new AEMCompleteUpload(controller, {
                retryEnabled: false
            });
            for await (const asset of completeUpload.execute([ transferAsset ])) {
                assert.deepStrictEqual(asset, transferAsset);
            }

            assert.deepStrictEqual(controller.emittedEvents, [{
                event: "beforecompleteupload",
                args: [{ transferAsset }]
            }, {
                event: "aftercompleteupload",
                args: [{ transferAsset }]
            }]);
        });
        it("create version - comment", async () => {
            const transferAsset = createTransferAsset({
                nameConflictPolicy: NameConflictPolicy.createVersionPolicy(undefined, "version-comment")
            });
    
            nock('http://host')
                .post(
                    "/path/to.completeUpload.json", 
                    "fileName=target.png&fileSize=1234&mimeType=image%2Fpng&createVersion=true&versionComment=version-comment&replace=false&uploadToken=upload-token"
                )
                .reply(200, '{}', {
                    "content-type": "application/json"
                });
    
            const controller = new ControllerMock();
            const completeUpload = new AEMCompleteUpload(controller, {
                retryEnabled: false
            });
            for await (const asset of completeUpload.execute([ transferAsset ])) {
                assert.deepStrictEqual(asset, transferAsset);
            }

            assert.deepStrictEqual(controller.emittedEvents, [{
                event: "beforecompleteupload",
                args: [{ transferAsset }]
            }, {
                event: "aftercompleteupload",
                args: [{ transferAsset }]
            }]);
        });
        it("create version - label and comment", async () => {
            const transferAsset = createTransferAsset({
                nameConflictPolicy: NameConflictPolicy.createVersionPolicy("version-label", "version-comment")
            });
    
            nock('http://host')
                .post(
                    "/path/to.completeUpload.json", 
                    "fileName=target.png&fileSize=1234&mimeType=image%2Fpng&createVersion=true&versionLabel=version-label&versionComment=version-comment&replace=false&uploadToken=upload-token"
                )
                .reply(200, '{}', {
                    "content-type": "application/json"
                });
    
            const controller = new ControllerMock();
            const completeUpload = new AEMCompleteUpload(controller, {
                retryEnabled: false
            });
            for await (const asset of completeUpload.execute([ transferAsset ])) {
                assert.deepStrictEqual(asset, transferAsset);
            }

            assert.deepStrictEqual(controller.emittedEvents, [{
                event: "beforecompleteupload",
                args: [{ transferAsset }]
            }, {
                event: "aftercompleteupload",
                args: [{ transferAsset }]
            }]);
        });
    });
    
});
