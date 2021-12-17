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
const { BlockDownload } = require('../../lib/block/blockdownload');

describe('Block Download', function() {
    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it('Block download smoke test', async function() {
        console.log("block download test");

        const HOST = 'http://test-aem-download-201';

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress:[],
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

        assert.equal(events.error.length, 0);
        assert.fail();
    });

    it('Block download: download error', async function() {
        console.log("block download test");

        assert.fail();
    });
});
