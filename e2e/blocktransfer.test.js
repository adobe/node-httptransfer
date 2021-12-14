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

const assert = require("assert");
const Path = require("path");
const mkdirp = require("mkdirp");
const { promises: fs } = require("fs");
const {
    BlockDownload,
    BlockUpload
} = require("../lib");
const {
    getBlobUrl,
    getAuthorizationHeader
} = require("./e2eutils");

/***
 * This test should work similar to AEM Transfer test with a few notable differences:
 * 1) No authentication to AEM, should authenticate directly to a blob store
 * 2) Additional support functions are required for obtaining signed URLs, etc.
 * 3) Same approach of upload and then download, but in this case we bypass AEM as the producer of URLs
 * 4) TODO: The code for block uploads assumes that AEM (actually Oak) will send the blob complete signal to finish storing a file after upload
 * -- This should be accomodated somehow in this test (or maybe we still have to piggy-back on AEM after all?)
 */

describe('Block Transfer e2e test', function() {
    this.timeout(60000);
    async function doBlockUpload(fileUrl, fileSize) {
        const blockUpload = new BlockUpload();
        const uploadErrors = [];
        blockUpload.on("filestart", ({ fileName, fileSize }) => console.log(`Upload: start ${fileName}, ${fileSize} bytes`));
        blockUpload.on("fileprogress", ({ fileName, fileSize, transferred }) => console.log(`Upload: progress ${fileName}, ${transferred}/${fileSize} bytes`));
        blockUpload.on("fileend", ({ fileName, fileSize }) => console.log(`Upload: completed ${fileName}, ${fileSize} bytes`));
        blockUpload.on("filerror", ({ fileName, errors }) => {
            console.log(`Upload: error ${fileName}`, errors);
            uploadErrors.push(errors);
        });
        await blockUpload.uploadFiles({
            uploadFiles: [{
                fileUrl,
                fileSize,
                filePath: Path.join(__dirname, "images/freeride-siberia.jpg")
            }], 
            headers: {
                "x-ms-blob-type": "BlockBlob"
            }, //getAuthorizationHeader(),
            concurrent: true,
            maxConcurrent: 16
        });
        assert.strictEqual(uploadErrors.length, 0);
    }

    async function doBlockDownload(fileUrl, fileSize, downloadFile) {
        const blockDownload = new BlockDownload();
        const downloadErrors = [];
        blockDownload.on("filestart", (data) => console.log(`Download: start ${JSON.stringify(data)}`));
        blockDownload.on("fileprogress", (data) => console.log(`Download: progress ${JSON.stringify(data)}`));
        blockDownload.on("fileend", (data) => console.log(`Download: completed ${JSON.stringify(data)}`));
        blockDownload.on("filerror", ({ fileName, errors }) => {
            console.log(`Download: error ${fileName}`, errors);
            downloadErrors.push(errors);
        });
        await blockDownload.downloadFiles({
            downloadFiles: [{
                fileUrl,
                fileSize: fileSize,
                filePath: downloadFile
            }], 
            headers: 'headers', // getAuthorizationHeader(),
            concurrent: true,
            maxConcurrent: 16
        });
        assert.strictEqual(downloadErrors.length, 0);
        return fs.stat(downloadFile);
    }

    it('AEM upload then download', async function () {
        const testId = `node-httptransfer_aem-e2e_${new Date().getTime()}`;
        const fileName = `${testId}.jpg`;
        // TODO: This should not be via AEM but just a raw blob location
        const fileUrl = `${getBlobUrl(fileName, "rw")}`;
        const fileSize = 282584;
        const downloadDir = Path.join(__dirname, "output", testId);
        const downloadFile = Path.join(downloadDir, fileName);
        await mkdirp(downloadDir);
        await doBlockUpload(fileUrl, fileSize);
        return doBlockDownload(fileUrl, fileSize, downloadFile);
    });
});
