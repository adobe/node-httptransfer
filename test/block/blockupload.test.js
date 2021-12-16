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
const { BlockUpload } = require('../../lib/block/blockupload');
// const { Blob } = require('blob-polyfill');

const debug = require("debug");
debug.enable('httptransfer*');

describe('Block Upload', function() {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it('Block upload smoke test', async function() {
        console.log("block upload test");

        const HOST = 'http://test-aem-upload-201';
        const testFile = Path.join(__dirname, 'file-1.jpg');
        await fs.writeFile(testFile, 'hello world 123', 'utf8');

        nock(HOST, {
            reqheaders: {
                'content-length': 15,
                'content-type': 'image/jpeg'
            }
        })
            .put('/path/to/file-1.jpg', 'hello world 123')
            .reply(201);

        const blockUpload = new BlockUpload();
        const events = {
            filestart: [],
            fileprogress:[],
            fileend: []
        };
        blockUpload.on('transferPart', (data) => {
            events.filestart.push(data);
        });
        blockUpload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockUpload.on('aftertransfer', (data) => {
            events.fileend.push(data);
        });
        const targetUrl =  'http://test-aem-upload-201/path/to/file-1.jpg';

        await blockUpload.uploadFiles({
            uploadFiles: [{
                fileUrl: targetUrl,
                filePath: testFile,
                fileSize: 15,
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 10,
                maxPartSize: 25
            }],
            headers: {
                // Asset Compute passes through content-type header
                'content-type': 'image/jpeg',
            },
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
            mimeType: "image/jpeg",
            sourceFolder: __dirname,
            sourceFile: testFile,
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

});
