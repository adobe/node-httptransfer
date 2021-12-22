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

// not exported and not expected to be used by clients
const {
    BlockDownload,
    BlockUpload
} = require("../lib");
const {
    uploadMultiPartFileConcurrently,
    uploadFileConcurrently,
    downloadFileConcurrently
} = require("../lib/index");
const {
    getBlobUrl,
    commitAzureBlocks,
    getFileHash,
    validateAzureAuth
} = require("./e2eutils");

/***
 * This test should work similar to AEM Transfer test with a few notable differences:
 * 1) No authentication to AEM, should authenticate directly to a blob store
 * 2) Additional support functions are required for obtaining signed URLs, etc.
 * 3) Same approach of upload and then download, but in this case we bypass AEM as the producer of URLs
 * 4) TODO: The code for block uploads assumes that AEM (actually Oak) will send the blob complete signal to finish storing a file after upload
 * -- This should be accommodated somehow in this test (or maybe we still have to piggy-back on AEM after all?)
 */

describe('Block Transfer e2e test', function() {
    this.timeout(60000);
    
    /**
     * UploadFileOptions
     * @param {string||object} fileUrl
     * @param {number} fileSize
     * @param {string} fileName
     * @param {string} filePath
     */
    /**
     * 
     * @param {UploadFileOptions} options 
     */
    async function doBlockUpload(options) {
        if (!options || !options.fileUrl || !options.fileName || !options.filePath) {
            throw new Error('Missing required fields for block upload');
        }
        const blockUpload = new BlockUpload();
        const uploadErrors = [];
        blockUpload.on("filestart", ({ fileName, fileSize }) => console.log(`Upload: start ${fileName}, ${fileSize} bytes`));
        blockUpload.on("fileprogress", ({ fileName, fileSize, transferred }) => console.log(`Upload: progress ${fileName}, ${transferred}/${fileSize} bytes`));
        blockUpload.on("fileend", ({ fileName, fileSize }) => console.log(`Upload: completed ${fileName}, ${fileSize} bytes`));
        blockUpload.on("filerror", ({ fileName, errors }) => {
            console.log(`Upload: error ${fileName}`, errors);
            uploadErrors.push(errors);
        });

        let target =  options.fileUrl;
        let maxPartSize;
        if (typeof(options.fileUrl) === 'object') {
            target = options.fileUrl.urls;
            maxPartSize = options.fileUrl.maxPartSize;
        }
        await blockUpload.uploadFiles({
            uploadFiles: [{
                fileUrl: target,
                filePath: options.filePath,
                fileSize: options.fileSize,
                maxPartSize
            }], 
            headers: {
                "x-ms-blob-type": "BlockBlob"
            },
            maxConcurrent: 5,
            preferredPartSize: 100000
        });
        assert.strictEqual(uploadErrors.length, 0);

        // if uploaded as a single block, no need to commit the blocks
        if (typeof(options.fileUrl) === 'object') {
            console.log("Commit uncommitted blocks");
            await commitAzureBlocks(options.fileName);
        }
    }

    /**
     * DownloadFileOptions
     * @param {string} fileUrl
     * @param {number} fileSize
     * @param {string} downloadFile
     */
    /**
     * 
     * @param {DownloadFileOptions} options 
     */
    async function doBlockDownload(options) {
        const blockDownload = new BlockDownload();
        const downloadErrors = [];
        blockDownload.on("filestart", (data) => console.log(`Download: start ${JSON.stringify(data)}`));
        blockDownload.on("fileprogress", (data) => console.log(`Download: progress ${JSON.stringify(data)}`));
        blockDownload.on("fileend", (data) => console.log(`Download: completed ${JSON.stringify(data)}`));
        blockDownload.on("filerror", ({ fileName, errors }) => {
            console.log(`Download: error ${fileName}`, errors);
            downloadErrors.push(errors);
        });
        let target = options.fileUrl;
        let maxPartSize;
        if (typeof(options.fileUrl) === 'object') {
            target = options.fileUrl.urls;
            maxPartSize = options.fileUrl.maxPartSize;
        }
        await blockDownload.downloadFiles({
            downloadFiles: [{
                fileUrl: target,
                filePath: options.downloadFilePath,
                fileSize: options.fileSize,
                maxPartSize,
            }], 
            headers: {
                "x-ms-blob-type": "BlockBlob"
            },
            concurrent: true,
            maxConcurrent: 16
        });
        assert.strictEqual(downloadErrors.length, 0);
        return fs.stat(options.downloadFilePath);
    }

    it('AEM upload then download using Block classes directly (jpg)', async function () {
        // make sure necessary environment variables are set
        validateAzureAuth();

        const testId = `node-httptransfer_aem-e2e_${new Date().getTime()}`;
        const fileName = `${testId}.jpg`;
        const originalFilePath =  Path.join(__dirname, "images/freeride-siberia.jpg");
        const fileSize = 282584;

        // single url used for uploading and downloading
        const fileUrl = getBlobUrl(fileName, {
            permissions: "cwr",
            size: fileSize
        });
        await doBlockUpload({
            fileSize,
            fileName,
            fileUrl: fileUrl, 
            filePath: originalFilePath
        });
        console.log('Upload complete for file', fileName);
        console.log("Downloading file using url:", fileUrl);

        const downloadDir = Path.join(__dirname, "output", testId);
        const downloadFilePath = Path.join(downloadDir, fileName);
        await mkdirp(downloadDir);
        await doBlockDownload({
            fileUrl,
            fileSize,
            downloadFilePath
        });

        // check downloaded file is the same as the original file by generating a hash
        assert.strictEqual(await getFileHash(originalFilePath), await getFileHash(downloadFilePath));
    });
    it('AEM upload then download (jpg)', async function () {
        // make sure necessary environment variables are set
        validateAzureAuth();

        const testId = `node-httptransfer_aem-e2e_${new Date().getTime()}`;
        const fileName = `${testId}.jpg`;
        const originalFilePath =  Path.join(__dirname, "images/freeride-siberia.jpg");
        const fileSize = 282584;

        // single url used for uploading and downloading
        const fileUrl = getBlobUrl(fileName, {
            permissions: "cwr",
            size: fileSize
        });
        await uploadFileConcurrently(originalFilePath, fileUrl, {
            headers: {
                "x-ms-blob-type": "BlockBlob"
            }
        });
        console.log('Upload complete for file', fileName);
        console.log("Downloading file using url:", fileUrl);

        const downloadDir = Path.join(__dirname, "output", testId);
        const downloadFilePath = Path.join(downloadDir, fileName);
        await mkdirp(downloadDir);
        await downloadFileConcurrently(fileUrl, downloadFilePath, {
            headers: {
                "x-ms-blob-type": "BlockBlob"
            }
        });
        // check downloaded file is the same as the original file by generating a hash
        assert.strictEqual(await getFileHash(originalFilePath), await getFileHash(downloadFilePath));
    });

    it('AEM multipart upload then download using Block classes directly (jpg)', async function () {
        // make sure necessary environment variables are set
        validateAzureAuth();

        const testId = `node-httptransfer_aem-e2e_${new Date().getTime()}`;
        const fileName = `${testId}.jpg`;
        const originalFilePath =  Path.join(__dirname, "images/freeride-siberia.jpg");
        const fileSize = 282584;

        // multipart upload urls
        const uploadFileUrls = getBlobUrl(fileName, {
            permissions: "cw",
            size: fileSize,
            maxPartSize: 100000
        });
        await doBlockUpload({
            fileSize,
            fileName,
            fileUrl: uploadFileUrls, 
            filePath: originalFilePath
        });
        // singular url used for downloading
        console.log('Upload complete for file', fileName);
        const downloadFileUrl = getBlobUrl(fileName, {
            permissions: "r",
            size: fileSize
        });
        console.log("Downloading file using url:", downloadFileUrl);

        const downloadDir = Path.join(__dirname, "output", testId);
        const downloadFilePath = Path.join(downloadDir, fileName);
        await mkdirp(downloadDir);

        await doBlockDownload({
            fileUrl: downloadFileUrl,
            fileSize,
            downloadFilePath
        });

        // check downloaded file is the same as the original file by generating a hash
        assert.strictEqual(await getFileHash(originalFilePath), await getFileHash(downloadFilePath));
    });
    it('AEM multipart upload then download (jpg)', async function () {
        // make sure necessary environment variables are set
        validateAzureAuth();

        const testId = `node-httptransfer_aem-e2e_${new Date().getTime()}`;
        const fileName = `${testId}.jpg`;
        const originalFilePath =  Path.join(__dirname, "images/freeride-siberia.jpg");
        const fileSize = 282584;

        // multipart upload urls
        const uploadFileUrls = getBlobUrl(fileName, {
            permissions: "cw",
            size: fileSize,
            maxPartSize: 100000
        });
        await uploadMultiPartFileConcurrently(originalFilePath, uploadFileUrls, {
            headers: {
                "x-ms-blob-type": "BlockBlob"
            }
        });
        
        // commit blocks
        await commitAzureBlocks(fileName);

        // singular url used for downloading
        console.log('Upload complete for file', fileName);
        const downloadFileUrl = getBlobUrl(fileName, {
            permissions: "r",
            size: fileSize
        });
        console.log("Downloading file using url:", downloadFileUrl);
        const downloadDir = Path.join(__dirname, "output", testId);
        const downloadFilePath = Path.join(downloadDir, fileName);
        await mkdirp(downloadDir);

        await downloadFileConcurrently(downloadFileUrl, downloadFilePath, {
            headers: {
                "x-ms-blob-type": "BlockBlob"
            }
        });

        // check downloaded file is the same as the original file by generating a hash
        assert.strictEqual(await getFileHash(originalFilePath), await getFileHash(downloadFilePath));
    });
});
