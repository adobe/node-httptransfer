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
const { TransferAsset } = require('../../lib/asset/transferasset');
const { AEMInitiateUpload } = require("../../lib/functions/aeminitiateupload");

class ControllerMock {
    constructor() {
        this.notifications = [];
    }
    notifyBefore(functionName, transferItem, props) {
        this.notifications.push({
            event: "before",
            functionName,
            transferItem,
            props
        });
    }
    notifyAfter(functionName, transferItem, props) {
        this.notifications.push({
            event: "after",
            functionName,
            transferItem,
            props
        });
    }
    notifyYield(functionName, transferItem, props) {
        this.notifications.push({
            event: "yield",
            functionName,
            transferItem,
            props
        });
    }
    notifyFailure(functionName, error, transferItem, props) {
        this.notifications.push({
            event: "failure",
            functionName,
            error: error.message,
            transferItem,
            props
        });
    }
}

async function tryInvalidInitiateUploadResponse(response, expectedErrorMessage) {
    const source = new Asset("file:///path/to/source.png");
    const target = new Asset("http://host/path/to/target.png");

    nock('http://host')
        .post(
            "/path/to.initiateUpload.json", 
            "fileName=target.png&fileSize=1234"
        )
        .reply(200, JSON.stringify(response), {
            "content-type": "application/json"
        });
        
    const controller = new ControllerMock();
    const initiateUpload = new AEMInitiateUpload({
        retryEnabled: false
    });
    const transferAsset = new TransferAsset(source, target, {
        metadata: new AssetMetadata(undefined, "image/png", 1234)
    });
    const generator = initiateUpload.execute([transferAsset], controller);

    await generator.next();

    assert.deepStrictEqual(controller.notifications, [{
        event: "before",
        functionName: "AEMInitiateUpload",
        props: undefined,
        transferItem: transferAsset
    }, {
        event: "failure",
        functionName: "AEMInitiateUpload",
        props: undefined,
        transferItem: transferAsset,
        error: expectedErrorMessage
    }]);
}

describe("AEMInitiateUpload", () => {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });
    describe("checkAddBatch", () => {
        it("same folder", () => {
            const transferAsset1 = new TransferAsset(
                new Asset("file:///path/to/source1.png"),
                new Asset("http://host/path/to/target1.png")
            );
            const transferAsset2 = new TransferAsset(
                new Asset("file:///path/to/source2.png"),
                new Asset("http://host/path/to/target2.png")
            );

            const initiateUpload = new AEMInitiateUpload({
                retryEnabled: false
            });

            const result = initiateUpload.checkAddBatch([ transferAsset1 ], transferAsset2);
            assert.strictEqual(result, true);
        });
        it("different folder", () => {
            const transferAsset1 = new TransferAsset(
                new Asset("file:///path/to/source1.png"),
                new Asset("http://host/path/to/target1.png")
            );
            const transferAsset2 = new TransferAsset(
                new Asset("file:///path/to/source2.png"),
                new Asset("http://host/path/to/subfolder/target2.png")
            );

            const initiateUpload = new AEMInitiateUpload({
                retryEnabled: false
            });

            const result = initiateUpload.checkAddBatch([ transferAsset1 ], transferAsset2);
            assert.strictEqual(result, false);
        });
    });
    describe("execute", () => {
        it("no assets", async () => {
            const controller = new ControllerMock();
            const initiateUpload = new AEMInitiateUpload({
                retryEnabled: false
            });
            const generator = initiateUpload.execute([], controller);
            const { value, done } = await generator.next();
            assert.strictEqual(value, undefined);
            assert.strictEqual(done, true);
        });
        it("single asset", async () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
    
            nock('http://host')
                .post(
                    "/path/to.initiateUpload.json", 
                    "fileName=target.png&fileSize=1234"
                )
                .reply(200, JSON.stringify({
                    files: [{
                        minPartSize: 1000, 
                        maxPartSize: 10000, 
                        uploadURIs: [
                            "http://host/path/to/target.png/block"
                        ], 
                        uploadToken: "uploadToken"
                    }],
                    completeURI: "/path/to.completeUpload.json"
                }), {
                    "content-type": "application/json"
                });
                
            const controller = new ControllerMock();
            const initiateUpload = new AEMInitiateUpload({
                retryEnabled: false
            });
            const generator = initiateUpload.execute([new TransferAsset(source, target, {
                metadata: new AssetMetadata(undefined, "image/png", 1234)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source, target, {
                    metadata: new AssetMetadata(undefined, "image/png", 1234),
                    multipartTarget: new AssetMultipart([
                        "http://host/path/to/target.png/block"
                    ], 1000, 10000, undefined, "http://host/path/to.completeUpload.json", "uploadToken")
                }));
                assert.strictEqual(done, false);    
            }
    
            // ensure there are no more files
            {
                const { value, done } = await generator.next();
                assert.strictEqual(value, undefined);
                assert.strictEqual(done, true);    
            }
        });
        it("batch of 2 assets", async () => {
            const source1 = new Asset("file:///path/to/source1.png");
            const target1 = new Asset("http://host/path/to/target1.png");
            const source2 = new Asset("file:///path/to/source2.png");
            const target2 = new Asset("http://host/path/to/target2.png");
                
            nock('http://host')
                .post(
                    "/path/to.initiateUpload.json", 
                    "fileName=target1.png&fileSize=1234&fileName=target2.png&fileSize=1234"
                )
                .reply(200, JSON.stringify({
                    files: [{
                        minPartSize: 1000, 
                        maxPartSize: 10000, 
                        uploadURIs: [
                            "http://host/path/to/target1.png/block"
                        ], 
                        uploadToken: "uploadToken1"
                    }, {
                        minPartSize: 2000, 
                        maxPartSize: 20000, 
                        uploadURIs: [
                            "http://host/path/to/target2.png/block"
                        ], 
                        uploadToken: "uploadToken2"
                    }],
                    completeURI: "/path/to.completeUpload.json"
                }), {
                    "content-type": "application/json"
                });           
     
            const controller = new ControllerMock();
            const initiateUpload = new AEMInitiateUpload({
                retryEnabled: false
            });
            const generator = initiateUpload.execute([new TransferAsset(source1, target1, {
                metadata: new AssetMetadata(undefined, "image/png", 1234)
            }), new TransferAsset(source2, target2, {
                metadata: new AssetMetadata(undefined, "image/png", 1234)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source1, target1, {
                    metadata: new AssetMetadata(undefined, "image/png", 1234),
                    multipartTarget: new AssetMultipart([
                        "http://host/path/to/target1.png/block"
                    ], 1000, 10000, undefined, "http://host/path/to.completeUpload.json", "uploadToken1")
                }));
                assert.strictEqual(done, false);    
            }
    
            // check the second file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source2, target2, {
                    metadata: new AssetMetadata(undefined, "image/png", 1234),
                    multipartTarget: new AssetMultipart([
                        "http://host/path/to/target2.png/block"
                    ], 2000, 20000, undefined, "http://host/path/to.completeUpload.json", "uploadToken2")
                }));
                assert.strictEqual(done, false);    
            }
    
            // ensure there are no more files
            {
                const { value, done } = await generator.next();
                assert.strictEqual(value, undefined);
                assert.strictEqual(done, true);    
            }
        });
    });
    describe("error", () => {
        it("files missing in response", async () => {
            await tryInvalidInitiateUploadResponse({
                completeURI: "/path/to.completeUpload.json"
            }, "'files' field missing in initiateUpload response: {\"completeURI\":\"/path/to.completeUpload.json\"}");
        });
        it("files mismatch in response", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [],
                completeURI: "/path/to.completeUpload.json"
            }, "'files' field incomplete in initiateUpload response (expected files: 1): {\"files\":[],\"completeURI\":\"/path/to.completeUpload.json\"}");
        });
        it("completeURI missing in response", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    uploadToken: "uploadToken"
                }],
            }, "'completeURI' field invalid in initiateUpload response: {\"files\":[{\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"uploadToken\":\"uploadToken\"}]}");
        });
        it("minPartSize missing", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    maxPartSize: 10000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"uploadToken\":\"uploadToken\"}");
        });
        it("maxPartSize missing", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"minPartSize\":1000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"uploadToken\":\"uploadToken\"}");
        });
        it("uploadURIs missing", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadToken\":\"uploadToken\"}");
        });
        it("uploadURIs array empty", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [], 
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[],\"uploadToken\":\"uploadToken\"}");
        });
    });
});
