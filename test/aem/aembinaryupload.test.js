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
const { AEMBinaryUpload } = require('../../lib/aem/aembinaryupload');
const { Blob } = require('node:buffer');

describe('AEM Binary Upload', function() {
    it('test get transfer options', function () {
        const upload = new AEMBinaryUpload();
        assert.throws(() => upload.getTransferOptions());
    });

    it('test get transfer asset options', function () {
        const upload = new AEMBinaryUpload();
        assert.throws(() => upload.getTransferAssetOptions());
    });

    it('test get preferred part size', function () {
        const upload = new AEMBinaryUpload();
        assert.throws(() => upload.getPreferredPartSize());
    });

    it('test get max concurrent', function () {
        const upload = new AEMBinaryUpload();
        assert.throws(() => upload.getMaxConcurrent());
    });

    it('test get pipeline steps', function () {
        const upload = new AEMBinaryUpload();
        assert.throws(() => upload.getPipelineSteps());
    });

    it('test get file start event name', function () {
        const upload = new AEMBinaryUpload();
        assert.throws(() => upload.getFileStartEventName());
    });

    it('test get file end event name', function () {
        const upload = new AEMBinaryUpload();
        assert.throws(() => upload.getFileEndEventName());
    });

    it('test generate aem upload transfer records', async function () {
        const URL1 = 'http://somefakefileurl/file1.jpg';
        const URL2 = 'http://somefakefileurl/file2.jpg';
        const upload = new AEMBinaryUpload({
            uploadFiles: [{
                blob: new Blob(['blooooob']),
                fileUrl: URL1,
                multipartHeaders: {
                    multipart1: 'headervalue'
                }
            }, {
                filePath: '/some/fake/local/file',
                fileUrl: URL2
            }],
            headers: {
                hello: 'world'
            }
        });
        upload.getTransferAssetOptions = () => { return {}; };

        for await (const uploadFile of upload.generateAEMUploadTransferRecords()) {
            if (uploadFile.target.filename === 'file1.jpg') {
                assert.ok(uploadFile.source.blob);
                assert.strictEqual(uploadFile.target.url.host, 'somefakefileurl');
                assert.deepStrictEqual(uploadFile.target.headers, { hello: 'world' });
                assert.deepStrictEqual(uploadFile.target.multipartHeaders, { multipart1: 'headervalue' });
            } else if (uploadFile.target.filename === 'file2.jpg') {
                assert.ok(uploadFile.source.url);
                assert.ok(!uploadFile.source.blob);
                assert.strictEqual(uploadFile.target.url.host, 'somefakefileurl');
                assert.deepStrictEqual(uploadFile.target.headers, { hello: 'world' });
            } else {
                assert.ok(false, `unexpected target filename: ${uploadFile.target.filename}`);
            }
        }
    });
});
