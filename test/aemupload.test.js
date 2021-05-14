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
const { AEMUpload } = require('../lib/aemupload');

describe('AEM Upload', function() {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it('AEM upload smoke test', async function() {
        const HOST = 'http://test-aem-upload-201';
        const testFile = Path.join(__dirname, 'file-1.jpg');
        await fs.writeFile(testFile, 'hello world 123', 'utf8');
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
            .post('/path/to.initiateUpload.json')
            .reply(201, initRaw, {
                'Content-Length': initRaw.length
            });

        nock(HOST)
            .put('/part')
            .reply(201);

        nock(HOST)
            .post('/path/to.completeUpload.json')
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
                fileSize: 12
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
            fileSize: 12,
            targetFolder: '/path/to',
            targetFile: '/path/to/file-1.jpg',
            sourceFolder: __dirname,
            sourceFile: testFile
        };

        assert.deepStrictEqual(events.filestart[0], fileEventData);
        assert.deepStrictEqual(events.fileprogress[0], {
            ...fileEventData,
            transferred: 12
        });
        assert.deepStrictEqual(events.fileend[0], fileEventData);
    });
});
