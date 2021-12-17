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
const Path = require('path');
const { BlockDownload } = require('../../lib/block/blockdownload');
const fileUrl = require('file-url');

describe('Block Download', function () {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it.only('Block download smoke test (single file download)', async function () {
        console.log("block download test");

        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-1.jpeg";
        nock(HOST)
            .head(filenameToDownload)
            .reply((uri, requestBody) => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 15,
                        'content-disposition': 'attachment; filename="image-file-1.jpg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    },
                ]
            })

        nock(HOST)
            .get(filenameToDownload, 'hello world 123')
            .reply(200);

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        await blockDownload.downloadFiles({
            downloadFiles: [{
                fileUrl: fileToDownload,
                filePath: Path.resolve("./tmp.jpeg"), // where to put the file
                fileSize: 15
            }],
            concurrent: true,
            maxConcurrent: 4
        });

        assert.equal(events.error.length, 0);
        assert.fail();
    });

    it('Block download: download error', async function () {
        console.log("block download test");

        assert.fail();
    });
});
