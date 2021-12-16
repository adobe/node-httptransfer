/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

'use strict';

const filterObject = require('filter-obj');
const fs = require('fs');
const path = require('path');
const { downloadStream, uploadStream } = require('./stream');
const { createReadStream, createWriteStream, getFileStats } = require('./util');
const { retry } = require('./retry');
const { HttpStreamError } = require('./error');
const { BlockDownload } = require('./block/blockdownload');
const { BlockUpload } = require('./block/blockupload');

/**
 * Check if file path is a directory, or does not exist
 * 
 * @param {String} filepath File path
 * @returns {Boolean} True if filepath exists and is a directory, False if filepath does not exist
 * @throws {Error} If filepath exists and is not a directory, or can't be accessed
 */
async function checkIsDirectory(filepath) {
    return new Promise((resolve, reject) => {
        return fs.stat(filepath, (err, stats) => {
            if (err && err.code === 'ENOENT') {
                resolve(false);
            } else if (err) {
                reject(err);
            } else if (stats.isDirectory()) {
                resolve(true);
            } else {
                reject(Error(`${filepath} is not a directory`));
            }
        });   
    });
}

/**
 * Ensure that the directory filepath exists
 * 
 * @param {String} filepath File path
 * @throws {Error} when file path can't be created
 */
async function ensureDir(filepath) {
    if (! await checkIsDirectory(filepath)) {
        const dirname = path.dirname(filepath);
        if (dirname !== filepath) {
            await ensureDir(dirname);
            return new Promise((resolve, reject) => {
                fs.mkdir(filepath, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } else {
            throw Error(`Unable to get dirname of: ${filepath}`);
        }
    }
}

/**
 * @typedef {Object} DownloadFileOptions
 *
 * @property {Number} [timeout] Socket timeout
 * @property {Object} [headers] An object containing request headers
 * @property {Boolean} [mkdirs] True if the directory of the filepath should be created
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Download a file from an url
 *
 * @param {String|URL} url Source URL
 * @param {String} filepath Target file path
 * @param {DownloadFileOptions} [options] Download options
 * @returns {Promise} resolves when download completes
 */
async function downloadFile(url, filepath, options) {
    return retry(async options => {
        if (options && options.mkdirs) {
            await ensureDir(path.dirname(path.resolve(filepath)));
        }

        const writeStream = await createWriteStream(filepath);
        const transferred = await downloadStream(url, writeStream, options);
        const { size } = await getFileStats(filepath);
        if (size !== transferred) {
            throw new HttpStreamError("GET", url, 200, `Response truncated at ${size} bytes, received ${transferred} bytes`);
        }
    }, options);
}

/**
 * Download file using multiple simultaneous transfers
 * Throws the first unrecoverable error if unsuccessful, all others are logged
 * @param {String|URL} url Location of file to download (e.g. presigned URL) 
 * @param {String} filepath Path to save file
 * @param {DownloadFileOptions} options Additional options such as headers, retry features, etc 
 * @returns {Promise} resolves when download completes
 */
async function downloadFileConcurrently(url, filepath, options) {
    const downloader = new BlockDownload();
    return downloader.downloadFiles({
        downloadFiles: [
            {
                fileUrl : url,
                filePath : filepath,
                fileSize : -1        
            }
        ],
        ...options
    });
}

/**
 * Upload file using multiple simultaneous transfers
 * Throws the first unrecoverable error if unsuccessful, all others are logged
 * @param {String|URL} url Location to upload (e.g. presigned URL) 
 * @param {String} filepath Path to locally saved file
 * @param {UploadFileOptions} options Additional options such as headers, retry features, etc 
 * @returns {Promise} resolves when upload completes
 */
async function uploadFileConcurrently(filepath, url, options) {
    // options contains header information
    const { size } = await getFileStats(filepath);
    const uploader = new BlockUpload();
    return uploader.uploadFiles({
        uploadFiles: [
            {
                fileUrl : url,
                filePath : filepath,
                fileSize : size
            }
        ],
        ...options
    });
}

/**
 * Upload multi part file using multiple simultaneous transfers
 * Throws the first unrecoverable error if unsuccessful, all others are logged
 * @param {Array.<String|URL>} urls Array of url locations for multipart upload (e.g. presigned URL) 
 * @param {String} filepath Path to locally saved file
 * @param {UploadFileOptions} options Additional options such as headers, retry features, etc 
 * @returns {Promise} resolves when upload completes
 */
async function uploadMultiPartFileConcurrently(filepath, urls, options) {
    // options contains header information
    const { size } = await getFileStats(filepath);
    const uploader = new BlockUpload();
    return uploader.uploadFiles({
        uploadFiles: [
            {
                fileUrl : urls,
                filePath : filepath,
                fileSize : size
            }
        ],
        ...options
    });
}

/**
 * @typedef {Object} UploadFileOptions
 *
 * @property {String} [method] HTTP method (defaults to 'PUT')
 * @property {Number} [timeout] Socket timeout
 * @property {Object} [headers] An object containing request headers
 * @property {Number} [start] Offset of the first byte in the file to upload (inclusive)
 * @property {Number} [end] Offset of the last byte in the file to upload (inclusive)
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 *
 * Note that the start and end offsets are not passed to the server. This is intentional.
 * Range upload requests are not widely supported, although could be added optionally.
 */
/**
 * Upload a file to an url
 *
 * @param {String} filepath Source file path
 * @param {String} url Target URL
 * @param {UploadFileOptions} [options] Upload options
 * @returns {Promise} resolves when upload completes
 */
async function uploadFile(filepath, url, options) {
    return retry(async options => {
        // determine the content length
        let contentLength;
        let readStream;
        if (options && options.end) {
            const start = options.start || 0;
            contentLength = options.end - start + 1;
            readStream = await createReadStream(filepath, {
                start: start,
                end: options.end
            });
        } else {
            const { size } = await getFileStats(filepath);
            contentLength = size;
            readStream = await createReadStream(filepath);
        }

        // extract upload options
        const uploadOptions = filterObject(
            options || {},
            ['method', 'timeout', 'headers']
        );
        uploadOptions.headers = { ...uploadOptions.headers, 'content-length': contentLength};

        // upload file
        return uploadStream(readStream, url, uploadOptions);
    }, options);
}

module.exports = {
    downloadFile,
    uploadFile,
    downloadFileConcurrently,
    uploadFileConcurrently,
    uploadMultiPartFileConcurrently
};
