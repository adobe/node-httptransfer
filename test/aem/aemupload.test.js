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
const fs = require('fs').promises;
const nock = require('nock');
const Path = require('path');
const { AEMUpload } = require('../../lib/aem/aemupload');
const { Blob } = require('node:buffer');
const { directBinaryAccessEnabled } = require("../testutils");

describe('AEM Upload', function() {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it('AEM upload smoke test', async function() {
        const HOST = 'http://test-aem-upload-201';
        const testFile = Path.join(__dirname, 'file-1.jpg');
        await fs.writeFile(testFile, 'hello world 123', 'utf8');
        directBinaryAccessEnabled(nock, HOST, '/path/to');
        const initResponse = {
            completeURI: `${HOST}/path/to.completeUpload.json`,
            folderPath: '/path/to',
            files: [{
                fileName: 'file-1.jpg',
                mimeType: 'image/jpeg',
                uploadToken: 'upload-token',
                uploadURIs: [
                    `${HOST}/part`
                ],
                minPartSize: 10,
                maxPartSize: 100
            }]
        };
        const initRaw = JSON.stringify(initResponse);
        nock(HOST)
            .post('/path/to.initiateUpload.json', 'fileName=file-1.jpg&fileSize=15')
            .reply(201, initRaw, {
                'Content-Length': initRaw.length
            });

        nock(HOST, {
            reqheaders: {
                'content-length': 15,
                'content-type': 'image/jpeg',
                partHeader: 'test'
            }
        })
            .put('/part', 'hello world 123')
            .reply(201);

        nock(HOST)
            .post('/path/to.completeUpload.json', (body) => {
                const {
                    fileName,
                    fileSize,
                    mimeType,
                    createVersion,
                    versionLabel,
                    versionComment,
                    replace,
                    uploadToken,
                    uploadDuration
                } = body;
                return fileName === "file-1.jpg" && fileSize === "15" && mimeType === "image/jpeg" &&
                    createVersion === "true" && versionLabel === "versionLabel" && versionComment === "versionComment" &&
                    replace === "false" && uploadToken === "upload-token" && uploadDuration;
            })
            .reply(200, '{}');

        const aemUpload = new AEMUpload();
        const events = {
            filestart: [],
            fileprogress:[],
            fileend: []
        };
        aemUpload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        aemUpload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        aemUpload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        await aemUpload.uploadFiles({
            uploadFiles: [{
                fileUrl: 'http://test-aem-upload-201/path/to/file-1.jpg',
                filePath: testFile,
                fileSize: 15,
                createVersion: true,
                versionLabel: 'versionLabel',
                versionComment: 'versionComment',
                multipartHeaders: { partHeader: 'test' }
            }],
            headers: {},
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 7
        });

        try {
            await fs.unlink(testFile);
        } catch (e) { // ignore cleanup failures
            console.log(e);
        }

        const fileEventData = {
            fileName: 'file-1.jpg',
            fileSize: 15,
            targetFolder: '/path/to',
            targetFile: '/path/to/file-1.jpg',
            sourceFolder: __dirname,
            sourceFile: testFile
        };

        assert.deepStrictEqual(events.filestart[0], fileEventData);
        assert.deepStrictEqual(events.fileprogress[0], {
            ...fileEventData,
            mimeType: "image/jpeg",
            transferred: 15
        });
        assert.deepStrictEqual(events.fileend[0], {
            ...fileEventData,
            mimeType: "image/jpeg",
        });
    });

    it('AEM upload failure smoke test', async function() {
        const HOST = 'http://test-aem-upload-201';
        const testFile = Path.join(__dirname, 'file-1.jpg');
        await fs.writeFile(testFile, 'hello world 123', 'utf8');
        directBinaryAccessEnabled(nock, HOST, '/path/to');

        nock(HOST)
            .post('/path/to.initiateUpload.json', 'fileName=file-1.jpg&fileSize=15')
            .reply(403);

        const aemUpload = new AEMUpload();
        const events = {
            filestart: [],
            fileprogress:[],
            fileend: [],
            fileerror: []
        };
        aemUpload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        aemUpload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        aemUpload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        aemUpload.on('fileerror', (data) => {
            events.fileerror.push(data);
        });
        await aemUpload.uploadFiles({
            uploadFiles: [{
                fileUrl: 'http://test-aem-upload-201/path/to/file-1.jpg',
                filePath: testFile,
                fileSize: 15,
                createVersion: true,
                versionLabel: 'versionLabel',
                versionComment: 'versionComment'
            }],
            headers: {},
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 7
        });

        try {
            await fs.unlink(testFile);
        } catch (e) { // ignore cleanup failures
            console.log(e);
        }

        const fileEventData = {
            fileName: 'file-1.jpg',
            fileSize: 15,
            targetFolder: '/path/to',
            targetFile: '/path/to/file-1.jpg',
            sourceFolder: __dirname,
            sourceFile: testFile
        };

        assert.strictEqual(events.filestart.length, 1);
        assert.strictEqual(events.fileprogress.length, 0);
        assert.strictEqual(events.fileend.length, 0);
        assert.strictEqual(events.fileerror.length, 1);

        assert.deepStrictEqual(events.filestart[0], fileEventData);
        const errors = events.fileerror[0].errors;
        delete events.fileerror[0].errors;
        assert.deepStrictEqual(events.fileerror[0], { 
            ...fileEventData,
        });
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].message, "Request failed with status code 403");

    });

    it('AEM upload blob smoke test', async function() {
        const blob = new Blob(['hello world 123']);
        const HOST = 'http://test-aem-upload-201';
        directBinaryAccessEnabled(nock, HOST, '/path/to');
        const initResponse = {
            completeURI: `${HOST}/path/to.completeUpload.json`,
            folderPath: '/path/to',
            files: [{
                fileName: 'file-1.jpg',
                mimeType: 'image/jpeg',
                uploadToken: 'upload-token',
                uploadURIs: [
                    `${HOST}/part`
                ],
                minPartSize: 10,
                maxPartSize: 100
            }]
        };
        const initRaw = JSON.stringify(initResponse);
        nock(HOST)
            .post('/path/to.initiateUpload.json', 'fileName=file-1.jpg&fileSize=15')
            .reply(201, initRaw, {
                'Content-Length': initRaw.length
            });

        nock(HOST, {
            reqheaders: {
                'content-length': 13,
                'content-type': 'image/jpeg'
            }
        })
            .put('/part', '[object Blob]')
            .reply(201);

        nock(HOST)
            .post('/path/to.completeUpload.json', (body) => {
                const {
                    fileName,
                    fileSize,
                    mimeType,
                    createVersion,
                    replace,
                    uploadToken,
                    uploadDuration
                } = body;
                return fileName === "file-1.jpg" && fileSize === "15" && mimeType === "image/jpeg" &&
                    createVersion === "false" && replace === "false" && uploadToken === "upload-token" &&
                    uploadDuration;
            })
            .reply(200, '{}');

        const aemUpload = new AEMUpload();
        return aemUpload.uploadFiles({
            uploadFiles: [{
                fileUrl: 'http://test-aem-upload-201/path/to/file-1.jpg',
                blob,
                fileSize: 15
            }]
        });
    });

    it('AEM upload no filePath or blob error', function() {
        const aemUpload = new AEMUpload();
        assert.rejects(() => aemUpload.uploadFiles({
            uploadFiles: [{
                fileUrl: 'http://test-aem-upload-201/path/to/file-1.jpg',
                fileSize: 15
            }]
        }), {
            name: 'IllegalArgumentException'
        });
    });
});
