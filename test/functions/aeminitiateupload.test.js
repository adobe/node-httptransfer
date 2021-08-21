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
const { ControllerMock } = require("./controllermock");

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
        eventName: "AEMInitiateUpload",
        functionName: "AEMInitiateUpload",
        props: undefined,
        transferItem: transferAsset
    }, {
        eventName: "error",
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
            const partHeaders = { partHeader: 'testing' };
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png", undefined, partHeaders);
    
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
                        mimeType: "image/png",
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
                metadata: new AssetMetadata("target.png", undefined, 1234)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source, target, {
                    metadata: new AssetMetadata("target.png", "image/png", 1234),
                    multipartTarget: new AssetMultipart([
                        "http://host/path/to/target.png/block"
                    ], 1000, 10000, partHeaders, "http://host/path/to.completeUpload.json", "uploadToken")
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
                    "fileName=target1.png&fileSize=1234&fileName=target2.png&fileSize=5678"
                )
                .reply(200, JSON.stringify({
                    files: [{
                        minPartSize: 1000, 
                        maxPartSize: 10000, 
                        uploadURIs: [
                            "http://host/path/to/target1.png/block"
                        ], 
                        mimeType: "image/png",
                        uploadToken: "uploadToken1"
                    }, {
                        minPartSize: 2000, 
                        maxPartSize: 20000, 
                        mimeType: "image/png",
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
                metadata: new AssetMetadata("target1.png", undefined, 1234)
            }), new TransferAsset(source2, target2, {
                metadata: new AssetMetadata("target2.png", undefined, 5678)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source1, target1, {
                    metadata: new AssetMetadata("target1.png", "image/png", 1234),
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
                    metadata: new AssetMetadata("target2.png", "image/png", 5678),
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
        it("single asset, no mimetype", async () => {
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
                        mimeType: null,
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
                metadata: new AssetMetadata("target.png", undefined, 1234)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source, target, {
                    metadata: new AssetMetadata("target.png", "application/octet-stream", 1234),
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
        it("single asset, custom mimetype", async () => {
            const source = new Asset("file:///path/to/source.jpg");
            const target = new Asset("http://host/path/to/target.jpg");
    
            nock('http://host')
                .post(
                    "/path/to.initiateUpload.json", 
                    "fileName=target.jpg&fileSize=1234"
                )
                .reply(200, JSON.stringify({
                    files: [{
                        minPartSize: 1000, 
                        maxPartSize: 10000, 
                        uploadURIs: [
                            "http://host/path/to/target.jpg/block"
                        ], 
                        mimeType: "server/mimetype",
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
                metadata: new AssetMetadata("target.jpg", "image/jpg", 1234)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source, target, {
                    metadata: new AssetMetadata("target.jpg", "image/jpg", 1234),
                    multipartTarget: new AssetMultipart([
                        "http://host/path/to/target.jpg/block"
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
        it("single asset, minPartSize == maxPartSize", async () => {
            const source = new Asset("file:///path/to/source.jpg");
            const target = new Asset("http://host/path/to/target.jpg");
    
            nock('http://host')
                .post(
                    "/path/to.initiateUpload.json", 
                    "fileName=target.jpg&fileSize=1234"
                )
                .reply(200, JSON.stringify({
                    files: [{
                        minPartSize: 1, 
                        maxPartSize: 1, 
                        uploadURIs: [
                            "http://host/path/to/target.jpg/block"
                        ], 
                        mimeType: "server/mimetype",
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
                metadata: new AssetMetadata("target.jpg", "image/jpg", 1234)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.deepStrictEqual(value, new TransferAsset(source, target, {
                    metadata: new AssetMetadata("target.jpg", "image/jpg", 1234),
                    multipartTarget: new AssetMultipart([
                        "http://host/path/to/target.jpg/block"
                    ], 1, 1, undefined, "http://host/path/to.completeUpload.json", "uploadToken")
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
        it("http failure", async () => {
            const source = new Asset("file:///path/to/source.jpg");
            const target = new Asset("http://host/path/to/target.jpg");
    
            nock('http://host')
                .post(
                    "/path/to.initiateUpload.json", 
                    "fileName=target.jpg&fileSize=1234"
                )
                .reply(403);
                
            const controller = new ControllerMock();
            const initiateUpload = new AEMInitiateUpload({
                retryEnabled: false
            });
            const generator = initiateUpload.execute([new TransferAsset(source, target, {
                metadata: new AssetMetadata("target.jpg", undefined, 1234)
            })], controller);
            
            // check the first file response
            {
                const { value, done } = await generator.next();
                assert.strictEqual(value, undefined);
                assert.strictEqual(done, true);    
            }

            // check notifications
            assert.deepStrictEqual([{
                "eventName": "AEMInitiateUpload",
                "functionName": "AEMInitiateUpload",
                "props": undefined,
                "transferItem": new TransferAsset(source, target, {
                    metadata: new AssetMetadata("target.jpg", undefined, 1234)
                })
            }, {
                "eventName": "error",
                "functionName": "AEMInitiateUpload",
                "props": undefined,
                "error": "POST 'http://host/path/to.initiateUpload.json' failed with status 403",
                "transferItem":  new TransferAsset(source, target, {
                    metadata: new AssetMetadata("target.jpg", undefined, 1234)
                })
            }], controller.notifications);
        });
        it("files missing", async () => {
            await tryInvalidInitiateUploadResponse({
                completeURI: "/path/to.completeUpload.json"
            }, "'files' field missing in initiateUpload response: {\"completeURI\":\"/path/to.completeUpload.json\"}");
        });
        it("files length mismatch", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [],
                completeURI: "/path/to.completeUpload.json"
            }, "'files' field incomplete in initiateUpload response (expected files: 1): {\"files\":[],\"completeURI\":\"/path/to.completeUpload.json\"}");
        });
        it("files element invalid type", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [ "abc" ],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: \"abc\"");
        });
        it("completeURI missing", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }]
            }, "'completeURI' field invalid in initiateUpload response: {\"files\":[{\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}]}");
        });
        it("completeURI not a string", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: {}
            }, "'completeURI' field invalid in initiateUpload response: {\"files\":[{\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}],\"completeURI\":{}}");
        });
        it("minPartSize missing", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    maxPartSize: 10000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("minPartSize invalid number", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 0,
                    maxPartSize: 10000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid minPartSize for http://host/path/to/target.png: {\"minPartSize\":0,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("maxPartSize missing", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"minPartSize\":1000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("maxPartSize invalid number", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 2,
                    maxPartSize: 1, 
                    uploadURIs: [
                        "http://host/path/to/target.png/block"
                    ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid maxPartSize for http://host/path/to/target.png: {\"minPartSize\":2,\"maxPartSize\":1,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("uploadURIs missing", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("uploadURIs array empty", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid multi-part information for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("first uploadURI element invalid", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [ null ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid upload url for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[null],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("second uploadURI element invalid", async () => {
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [ "http://host/path/to/target.png/block", null ], 
                    mimeType: "image/png",
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid upload url for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\",null],\"mimeType\":\"image/png\",\"uploadToken\":\"uploadToken\"}");
        });
        it("invalid mimetype", async () => {          
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [ "http://host/path/to/target.png/block" ], 
                    mimeType: {},
                    uploadToken: "uploadToken"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid mimetype for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":{},\"uploadToken\":\"uploadToken\"}");
        });
        it("uploadToken missing", async () => {          
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [ "http://host/path/to/target.png/block" ], 
                    mimeType: "image/png"
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid uploadToken for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\"}");
        });
        it("invalid uploadToken", async () => {          
            await tryInvalidInitiateUploadResponse({
                files: [{
                    minPartSize: 1000, 
                    maxPartSize: 10000, 
                    uploadURIs: [ "http://host/path/to/target.png/block" ], 
                    mimeType: "image/png",
                    uploadToken: {}
                }],
                completeURI: "/path/to.completeUpload.json"
            }, "invalid uploadToken for http://host/path/to/target.png: {\"minPartSize\":1000,\"maxPartSize\":10000,\"uploadURIs\":[\"http://host/path/to/target.png/block\"],\"mimeType\":\"image/png\",\"uploadToken\":{}}");
        });
    });
});
