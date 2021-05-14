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
const { AEMDownload } = require('../lib/aemdownload');

describe('AEM Download', function() {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it('AEM download smoke test', async function() {
        const testFile = Path.join(__dirname, 'file-1.jpg');
        nock('http://test-aem-download-200')
            .matchHeader('range', 'bytes=0-6')
            .get('/path/to/file-1.jpg')
            .reply(200, 'Hello W', {
                'Content-Length': 7
            });

        nock('http://test-aem-download-200')
            .matchHeader('range', 'bytes=7-11')
            .get('/path/to/file-1.jpg')
            .reply(200, 'orld!', {
                'Content-Length': '5'
            });

        const aemDownload = new AEMDownload();
        const events = {
            filestart: [],
            fileprogress:[],
            fileend: []
        };
        aemDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        aemDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        aemDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        await aemDownload.downloadFiles({
            downloadFiles: [{
                fileUrl: 'http://test-aem-download-200/path/to/file-1.jpg',
                filePath: testFile,
                fileSize: 12
            }],
            headers: {},
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 7
        });
        const fileData = await fs.readFile(testFile);

        try {
            await fs.unlink(testFile);
        } catch (e) { // ignore cleanup failures
            console.log(e);
        }
        assert.strictEqual(fileData.toString(), 'Hello World!');
        assert.strictEqual(events.filestart.length, 1);
        assert.strictEqual(events.fileprogress.length, 2);
        assert.strictEqual(events.fileend.length, 1);

        const fileEventData = {
            fileName: 'file-1.jpg',
            fileSize: 12,
            targetFolder: __dirname,
            targetFile: testFile
        };

        // concurrency might switch the progress events around, so make sure
        // to use the correct index
        let transferEventIndex1 = 0;
        let transferEventIndex2 = 1;
        if (events.fileprogress[transferEventIndex1].transferred !== 7) {
            transferEventIndex1 = 1;
            transferEventIndex2 = 0;
        }
        assert.deepStrictEqual(events.filestart[0], fileEventData);
        assert.deepStrictEqual(events.fileprogress[transferEventIndex1], {
            ...fileEventData,
            transferred: 7
        });
        assert.deepStrictEqual(events.fileprogress[transferEventIndex2], {
            ...fileEventData,
            transferred: 12
        });
        assert.deepStrictEqual(events.fileend[0], fileEventData);
    });
});
