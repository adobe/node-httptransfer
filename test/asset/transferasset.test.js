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
const { sep } = require('path');
const { Asset } = require('../../lib/asset/asset');
const { AssetMetadata } = require('../../lib/asset/assetmetadata');
const { AssetMultipart } = require('../../lib/asset/assetmultipart');
const { AssetVersion } = require('../../lib/asset/assetversion');
const { NameConflictPolicy } = require('../../lib/asset/nameconflictpolicy');
const { TransferAsset } = require('../../lib/asset/transferasset');

function getExpectedFilePath(path) {
    return path.replace(/\//g, sep);
}

describe("TransferAsset", function() {
    describe("constructor", () => {
        it("no-source no-target fail", () => {
            assert.strict.throws(() => {
                new TransferAsset;
            }, Error("'source' must be of type Asset: undefined"));
        });
        it("invalid source", () => {
            assert.strict.throws(() => {
                new TransferAsset(123);
            }, Error("'source' must be of type Asset: 123 (number)"));
        });
        it("no-target fail", () => {
            assert.strict.throws(() => {
                new TransferAsset(new Asset("http://host/path/to/source.png"));
            }, Error("'target' must be of type Asset: undefined"));
        });
        it("invalid target", () => {
            assert.strict.throws(() => {
                new TransferAsset(new Asset("http://host/path/to/source.png"), 123);
            }, Error("'target' must be of type Asset: 123 (number)"));
        });
        it("download", () => {
            const source = new Asset("http://host/path/to/source.png");
            const target = new Asset("file:///path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: '/path/to/source.png',
                sourceFolder: '/path/to',
                targetFile: getExpectedFilePath("/path/to/target.png"),
                targetFolder: getExpectedFilePath("/path/to")
            });
        });
        it("upload", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
    });
    describe("metadata", () => {
        it("metadata c-tor", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const metadata = new AssetMetadata("source.png", "image/png", 9876);
            const transferAsset = new TransferAsset(source, target, {
                metadata
            });
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, metadata);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: 9876,
                mimeType: "image/png",
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("metadata c-tor invalid", () => {
            assert.strict.throws(() => {
                new TransferAsset(
                    new Asset("file:///path/to/source.png"), 
                    new Asset("http://host/path/to/target.png"), {
                        metadata: 123
                    });    
            }, Error("'metadata' must be of type AssetMetadata: 123 (number)"));
        });
        it("metadata setter", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
    
            const metadata = new AssetMetadata("source.png", "image/png", 9876);
            transferAsset.metadata = metadata;
    
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, metadata);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: 9876,
                mimeType: "image/png",
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("metadata setter invalid", () => {
            assert.strict.throws(() => {
                const source = new Asset("file:///path/to/source.png");
                const target = new Asset("http://host/path/to/target.png");
                const transferAsset = new TransferAsset(source, target);
                transferAsset.metadata = 123;    
            }, Error("'metadata' must be of type AssetMetadata: 123 (number)"));
        });
    });
    describe("acceptRanges", () => {
        it("acceptRanges c-tor", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target, {
                acceptRanges: true
            });
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, true);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("acceptRanges c-tor truthy", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target, {
                acceptRanges: 123
            });
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, true);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("acceptRanges setter", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
            transferAsset.acceptRanges = true;
    
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, true);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("acceptRanges setter truthy", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
            transferAsset.acceptRanges = 123;
    
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, true);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
    });
    describe("version", () => {
        it("version c-tor", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const version = new AssetVersion(Date.now(), "etag");
            const transferAsset = new TransferAsset(source, target, {
                version
            });
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, version);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("version c-tor invalid", () => {
            assert.strict.throws(() => {
                new TransferAsset(
                    new Asset("file:///path/to/source.png"), 
                    new Asset("http://host/path/to/target.png"), {
                        version: 123
                    });    
            }, Error("'version' must be of type AssetVersion: 123 (number)"));
        });
        it("version setter", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
    
            const version = new AssetVersion(Date.now(), "etag");
            transferAsset.version = version;
    
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, version);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("version setter invalid", () => {
            assert.strict.throws(() => {
                const source = new Asset("file:///path/to/source.png");
                const target = new Asset("http://host/path/to/target.png");
                const transferAsset = new TransferAsset(source, target);
                transferAsset.version = 123;    
            }, Error("'version' must be of type AssetVersion: 123 (number)"));
        });
    });
    describe("multipartTarget", () => {
        it("multipartTarget c-tor", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const multipartTarget = new AssetMultipart(["http://host/path/to/target.png-1"], 100, 1000);
            const transferAsset = new TransferAsset(source, target, {
                multipartTarget
            });
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, multipartTarget);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("multipartTarget c-tor invalid", () => {
            assert.strict.throws(() => {
                new TransferAsset(
                    new Asset("file:///path/to/source.png"), 
                    new Asset("http://host/path/to/target.png"), {
                        multipartTarget: 123
                    });    
            }, Error("'multipartTarget' must be of type AssetMultipart: 123 (number)"));
        });
        it("multipartTarget setter", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
    
            const multipartTarget = new AssetMultipart(["http://host/path/to/target.png-1"], 100, 1000);
            transferAsset.multipartTarget = multipartTarget;
    
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, multipartTarget);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, NameConflictPolicy.defaultPolicy());
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("multipartTarget setter invalid", () => {
            assert.strict.throws(() => {
                const source = new Asset("file:///path/to/source.png");
                const target = new Asset("http://host/path/to/target.png");
                const transferAsset = new TransferAsset(source, target);
                transferAsset.multipartTarget = 123;    
            }, Error("'multipartTarget' must be of type AssetMultipart: 123 (number)"));
        });
    });
    describe("nameConflictPolicy", () => {
        it("nameConflictPolicy c-tor", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const nameConflictPolicy = NameConflictPolicy.createVersionPolicy("label", "comment");
            const transferAsset = new TransferAsset(source, target, {
                nameConflictPolicy
            });
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, nameConflictPolicy);
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("nameConflictPolicy c-tor invalid", () => {
            assert.strict.throws(() => {
                new TransferAsset(
                    new Asset("file:///path/to/source.png"), 
                    new Asset("http://host/path/to/target.png"), {
                        nameConflictPolicy: 123
                    });    
            }, Error("'nameConflictPolicy' must be of type NameConflictPolicy: 123 (number)"));
        });
        it("nameConflictPolicy setter", () => {
            const source = new Asset("file:///path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
    
            const nameConflictPolicy = NameConflictPolicy.createVersionPolicy("label", "comment");
            transferAsset.nameConflictPolicy = nameConflictPolicy;
    
            assert.deepStrictEqual(transferAsset.source, source);
            assert.deepStrictEqual(transferAsset.target, target);
            assert.deepStrictEqual(transferAsset.metadata, undefined);
            assert.strictEqual(transferAsset.acceptRanges, false);
            assert.deepStrictEqual(transferAsset.version, undefined);
            assert.deepStrictEqual(transferAsset.multipartTarget, undefined);
            assert.deepStrictEqual(transferAsset.nameConflictPolicy, nameConflictPolicy);
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: undefined,
                sourceFile: getExpectedFilePath('/path/to/source.png'),
                sourceFolder: getExpectedFilePath('/path/to'),
                targetFile: "/path/to/target.png",
                targetFolder: "/path/to"
            });
        });
        it("nameConflictPolicy setter invalid", () => {
            assert.strict.throws(() => {
                const source = new Asset("file:///path/to/source.png");
                const target = new Asset("http://host/path/to/target.png");
                const transferAsset = new TransferAsset(source, target);
                transferAsset.nameConflictPolicy = 123;    
            }, Error("'nameConflictPolicy' must be of type NameConflictPolicy: 123 (number)"));
        });
        it("test event data with windows paths", () => {
            const source = new Asset("file:///C:/path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target, {
                metadata: new AssetMetadata("source.png", "image/png", 100),
            });
            assert.deepStrictEqual(transferAsset.eventData, {
                fileName: "target.png",
                fileSize: 100,
                mimeType: "image/png",
                targetFolder: "/path/to",
                targetFile: "/path/to/target.png",
                sourceFolder: getExpectedFilePath('C:/path/to'),
                sourceFile: getExpectedFilePath('C:/path/to/source.png'),
            });
        });
    });

    describe("Duration", function () {
        it("test duration accessors", function () {
            const source = new Asset("file:///C:/path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
            assert.strictEqual(transferAsset.uploadDuration, 0);
            transferAsset.setUploadDuration(100);
            assert.strictEqual(transferAsset.uploadDuration, 100);
        });
    });
});
