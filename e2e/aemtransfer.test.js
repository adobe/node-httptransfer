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
    getAuthorizationHeader,
    getUniqueTestId
} = require("./e2eutils");

const FILE_SIZE = 282584;

describe('AEM Transfer e2e test', function() {
    this.timeout(60000);
    function writeErrors(errors) {
        return errors.map((error) => error.code);
    }

    async function doAEMUpload(fileUrls, errorCount = 0) {
        const aemUpload = new AEMUpload();
        const uploadErrors = [];
        const uploadSuccesses = [];
        aemUpload.on("filestart", ({ fileName, fileSize }) => console.log(`Upload: start ${fileName}, ${fileSize} bytes`));
        aemUpload.on("fileprogress", ({ fileName, fileSize, transferred }) => console.log(`Upload: progress ${fileName}, ${transferred}/${fileSize} bytes`));
        aemUpload.on("fileend", ({ fileName, fileSize }) => {
            console.log(`Upload: completed ${fileName}, ${fileSize} bytes`);
            uploadSuccesses.push(fileName);
        });
        aemUpload.on("fileerror", ({ fileName, errors }) => {
            console.log(`Upload: error ${fileName}`, writeErrors(errors));
            uploadErrors.push(errors);
        });
        await aemUpload.uploadFiles({
            uploadFiles: fileUrls.map((fileUrl) => {
                return {
                    fileUrl,
                    fileSize: FILE_SIZE,
                    filePath: Path.join(__dirname, "images/freeride-siberia.jpg")
                };
            }),
            headers: getAuthorizationHeader(),
            concurrent: true,
            maxConcurrent: 16
        });
        assert.strictEqual(uploadErrors.length, errorCount);
        return {
            uploadErrors,
            uploadSuccesses
        };
    }

    async function doAEMDownload(fileUrl, downloadFile) {
        const aemDownload = new AEMDownload();
        const downloadErrors = [];
        aemDownload.on("filestart", (data) => console.log(`Download: start ${JSON.stringify(data)}`));
        aemDownload.on("fileprogress", (data) => console.log(`Download: progress ${JSON.stringify(data)}`));
        aemDownload.on("fileend", (data) => console.log(`Download: completed ${JSON.stringify(data)}`));
        aemDownload.on("fileerror", ({ fileName, errors }) => {
            console.log(`Download: error ${fileName}`, writeErrors(errors));
            downloadErrors.push(errors);
        });
        await aemDownload.downloadFiles({
            downloadFiles: [{
                fileUrl,
                fileSize: FILE_SIZE,
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
        const testId = getUniqueTestId();
        const fileName = `${testId}.jpg`;
        const fileUrl = `${getAemEndpoint()}/content/dam/${fileName}`;
        const downloadDir = Path.join(__dirname, "output", testId);
        const downloadFile = Path.join(downloadDir, fileName);
        await mkdirp(downloadDir);
        await doAEMUpload([fileUrl]);
        return doAEMDownload(fileUrl, downloadFile);
    });

    it('AEM upload with invalid characters', async function () {
        const testId = getUniqueTestId();
        const fileName = `${testId}:[invalid name].jpg`;
        const successName = `${testId}.jpg`;
        const {
            uploadErrors,
            uploadSuccesses
        } = await doAEMUpload([
            `${getAemEndpoint()}/content/dam/${fileName}`,
            `${getAemEndpoint()}/content/dam/${successName}`
        ], 1);
        assert.strictEqual(uploadSuccesses.length, 1);
        assert.strictEqual(uploadSuccesses[0], successName);
        assert.strictEqual(uploadErrors[0].length, 1);
        assert.strictEqual(uploadErrors[0][0].uploadError, true);
        assert.strictEqual(uploadErrors[0][0].code, "EUNKNOWN");
        assert.strictEqual(uploadErrors[0][0].message, `File cannot be uploaded: Filename '${fileName}' has unsupported characters`);
    });
});
