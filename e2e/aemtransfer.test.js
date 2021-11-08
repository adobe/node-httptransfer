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
    AEMDownload,
    AEMUpload
} = require("../lib/index");
const {
    getAemEndpoint,
    getAuthorizationHeader
} = require("./e2eutils");

describe('AEM Transfer e2e test', function() {
    this.timeout(60000);
    async function doAEMUpload(fileUrl, fileSize) {
        const aemUpload = new AEMUpload();
        const uploadErrors = [];
        aemUpload.on("filestart", ({ fileName, fileSize }) => console.log(`Upload: start ${fileName}, ${fileSize} bytes`));
        aemUpload.on("fileprogress", ({ fileName, fileSize, transferred }) => console.log(`Upload: progress ${fileName}, ${transferred}/${fileSize} bytes`));
        aemUpload.on("fileend", ({ fileName, fileSize }) => console.log(`Upload: completed ${fileName}, ${fileSize} bytes`));
        aemUpload.on("filerror", ({ fileName, errors }) => {
            console.log(`Upload: error ${fileName}`, errors);
            uploadErrors.push(errors);
        });
        await aemUpload.uploadFiles({
            uploadFiles: [{
                fileUrl,
                fileSize,
                filePath: Path.join(__dirname, "images/freeride-siberia.jpg")
            }], 
            headers: getAuthorizationHeader(),
            concurrent: true,
            maxConcurrent: 16
        });
        assert.strictEqual(uploadErrors.length, 0);
    }

    async function doAEMDownload(fileUrl, fileSize, downloadFile) {
        const aemDownload = new AEMDownload();
        const downloadErrors = [];
        aemDownload.on("filestart", (data) => console.log(`Download: start ${JSON.stringify(data)}`));
        aemDownload.on("fileprogress", (data) => console.log(`Download: progress ${JSON.stringify(data)}`));
        aemDownload.on("fileend", (data) => console.log(`Download: completed ${JSON.stringify(data)}`));
        aemDownload.on("filerror", ({ fileName, errors }) => {
            console.log(`Download: error ${fileName}`, errors);
            downloadErrors.push(errors);
        });
        await aemDownload.downloadFiles({
            downloadFiles: [{
                fileUrl,
                fileSize,
                filePath: downloadFile
            }], 
            headers: getAuthorizationHeader(),
            concurrent: true,
            maxConcurrent: 16
        });
        assert.strictEqual(downloadErrors.length, 0);
        return fs.stat(downloadFile);
    }

    it('AEM upload then download', async function () {
        const testId = `node-httptransfer_aem-e2e_${new Date().getTime()}`;
        const fileName = `${testId}.jpg`;
        const fileUrl = `${getAemEndpoint()}/content/dam/${fileName}`;
        const fileSize = 282584;
        const downloadDir = Path.join(__dirname, "output", testId);
        const downloadFile = Path.join(downloadDir, fileName);
        await mkdirp(downloadDir);
        await doAEMUpload(fileUrl, fileSize);
        return doAEMDownload(fileUrl, fileSize, downloadFile);
    });
});
