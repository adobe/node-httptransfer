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
const { createReadStream, createWriteStream, getFileStats, isPositiveNumber } = require('./util');
const { retry } = require('./retry');
const { HttpStreamError, IllegalArgumentError } = require('./error');
const { BlockDownload } = require('./block/blockdownload');
const { BlockUpload } = require('./block/blockupload');

const RETRY_OPTIONS_FILTER = [
    'timeout',
    'retryMaxDuration', 'retryBackoff', 'retryInitialDelay',
    'retryEnabled', 'retryAllErrors', 'retryMaxCount'
];
const CONCURRENCY_OPTIONS_FILTER = [
    'maxConcurrent', 'concurrent'
];

/**
 * Check if file path is a directory, or does not exist (asynchronously)
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
 * Ensure that the directory filepath exists (asynchronously)
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
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
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
 * @typedef {Object} DownloadFileOptions
 *
 * @property {Number} [timeout=30000] Optional socket timeout (ms)
 * @property {Object} [headers] Optional override of request headers
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryMaxCount] time to retry until throwing an error, overrides retryMaxDuration (ms)
 * @property {Number} [retryInitialDelay=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Number} [retryBackoff=2] backoff factor for wait time between retries (defaults to 2.0)
 * @property {Number} [preferredPartSize] Optional custom preferred part size. Might be adjusted depending on the target.
 * @property {Number} [maxConcurrent] Optional concurrent amount.
 * @property {Number} [fileSize] Optional file size if it is known. Pass this through to avoid doing an extra head request.
 * @property {String} [contentType] Optional valid content type if it is known. Pass this through to avoid doing an extra head request.
 */
/**
 * Download file using multiple simultaneous transfers
 * Throws the first unrecoverable error if unsuccessful, all others are logged
 * @param {String|URL} url Location of file to download (e.g. presigned URL) 
 * @param {String} filepath Path to save file
 * @param {DownloadFileOptions} options Additional options such as headers, retry features, etc 
 * @returns {Promise} resolves when download completes
 */
async function downloadFileConcurrently(url, filepath, options) {
    if (options && options.mkdirs) {
        await ensureDir(path.dirname(path.resolve(filepath)));
    }

    const downloader = new BlockDownload();

    // extract upload options
    const downloadOptions = filterObject(
        options || {},
        ['headers', ...CONCURRENCY_OPTIONS_FILTER, ...RETRY_OPTIONS_FILTER, 'preferredPartSize']
    );

    return downloader.downloadFiles({
        downloadFiles: [
            {
                fileUrl: url,
                filePath: filepath,
                fileSize: (options && options.fileSize) || undefined,
                contentType: (options && options.contentType) || undefined
            }
        ],
        ...downloadOptions
    });
}

/**
 * @typedef {Object} UploadFileOptions
 *
 * @property {String} [method] Optional HTTP method (defaults to 'PUT')
 * @property {Number} [timeout=30000] Optional socket timeout (ms)
 * @property {Object} [headers] Optional override of request headers
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryMaxCount] time to retry until throwing an error, overrides retryMaxDuration (ms)
 * @property {Number} [retryInitialDelay=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Number} [retryBackoff=2] backoff factor for wait time between retries (defaults to 2.0)
 * @property {Number} [maxConcurrent] Optional concurrent amount.
 */
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

    // extract upload options
    const uploadOptions = filterObject(
        options || {},
        ['method', 'headers', ...CONCURRENCY_OPTIONS_FILTER,
            ...RETRY_OPTIONS_FILTER]
    );

    const uploader = new BlockUpload();
    return uploader.uploadFiles({
        uploadFiles: [
            {
                fileUrl: url,
                filePath: filepath,
                fileSize: size
            }
        ],
        ...uploadOptions
    });
}

/**
 * @typedef {Object} UploadAEMMultipartOptions
 *
 * @property {String} [method] Optional HTTP method (defaults to 'PUT')
 * @property {Number} [timeout=30000] Optional socket timeout (ms)
 * @property {Object} [headers] Optional override of request headers
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryMaxCount] time to retry until throwing an error, overrides retryMaxDuration (ms)
 * @property {Number} [retryInitialDelay=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Number} [preferredPartSize] Optional custom preferred part size. Might be adjusted depending on the target.
 * @property {Number} [maxConcurrent] Optional concurrent amount.
 */
/**
 * @typedef {Object} UploadAEMMultipartTarget
 *
 * @property {String[]} urls URLs
 * @property {Number} [maxPartSize] Maximum size of each part
 */
/**
 * Upload multi part file using multiple simultaneous transfers
 * Throws the first unrecoverable error if unsuccessful, all others are logged
 * @param {UploadAEMMultipartTarget} target Target urls
 * @param {String} filepath Path to locally saved file
 * @param {UploadAEMMultipartOptions} options Additional options such as headers, retry features, etc 
 * @returns {Promise} resolves when upload completes
 */
async function uploadMultiPartFileConcurrently(filepath, target, options = {}) {
    // fail fast, keep error handling the same as older, non-concurrent function
    if (!target) {
        throw new IllegalArgumentError('target not provided', target);
    } else if (!target.urls || target.urls.length === 0) {
        throw new IllegalArgumentError('\'target.urls\' must be a non-empty array', target.urls);
    } else if (!isPositiveNumber(target.maxPartSize)) {
        throw new IllegalArgumentError('\'target.maxPartSize\' must be a positive number', target.maxPartSize);
    }

    // Calculate the partSize based on the number of urls
    const { size } = await getFileStats(filepath);

    // to stay backwards compatible with older `uploadAEMMultipartFile` that uses `partSize`
    options.preferredPartSize = options.partSize ? options.partSize : options.preferredPartSize;

    // extract upload options
    const uploadOptions = filterObject(
        options || {},
        ['method', 'headers', ...CONCURRENCY_OPTIONS_FILTER,
            ...RETRY_OPTIONS_FILTER, 'preferredPartSize']
    );

    const uploader = new BlockUpload();
    return uploader.uploadFiles({
        uploadFiles: [
            {
                fileUrl: target.urls,
                filePath: filepath,
                fileSize: size,
                maxPartSize: target.maxPartSize,
                multipartHeaders: target.multipartHeaders
            }
        ],
        ...uploadOptions
    });
}
/**
 * @typedef {Object} UploadAEMMultipartOptions
 *
 * @property {String} [method] Optional HTTP method (defaults to 'PUT')
 * @property {Number} [timeout=30000] Optional socket timeout (ms)
 * @property {Object} [headers] Optional override of request headers
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryMaxCount] time to retry until throwing an error, overrides retryMaxDuration (ms)
 * @property {Number} [retryInitialDelay=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Number} [preferredPartSize] Optional custom preferred part size. Might be adjusted depending on the target.
 * @property {Number} [maxConcurrent] Optional concurrent amount.
 */
/**
 * @typedef {Object} UploadAEMMultipartTarget
 *
 * @property {String[]} urls URLs
 * @property {Number} [maxPartSize] Maximum size of each part
 */
/**
 * @typedef {Object} UploadFile Object containing information about file to upload
 *
 * @param {UploadAEMMultipartTarget} target Target urls
 * @param {String} filepath Path to locally saved file
 */
/**
 * Upload multi part file using multiple simultaneous transfers
 * Throws the first unrecoverable error if unsuccessful, all others are logged
 * @param {UploadFile[]} files Array of UploadFile objects
 * @param {UploadAEMMultipartOptions} options Additional options such as headers, retry features, etc 
 * @returns {Promise} resolves when upload completes
 */
async function uploadFilesConcurrently(files, options = {}) {
    const uploadFiles = [];
    for (const file of files) {
        const target = file.target;
        const filepath = file.filepath;
        // fail fast, keep error handling the same as older, non-concurrent function
        if (!target) {
            throw new IllegalArgumentError('target not provided', target);
        } else if (!target.urls || target.urls.length === 0) {
            throw new IllegalArgumentError('\'target.urls\' must be a non-empty array', target.urls);
        } else if (!isPositiveNumber(target.maxPartSize)) {
            throw new IllegalArgumentError('\'target.maxPartSize\' must be a positive number', target.maxPartSize);
        }
   
        // Calculate the partSize based on the number of urls
        const { size } = await getFileStats(filepath);
        uploadFiles.push(
            {
                fileUrl: target.urls,
                filePath: filepath,
                fileSize: size,
                maxPartSize: target.maxPartSize,
                multipartHeaders: target.multipartHeaders
            }
        );
    }
    // to stay backwards compatible with older `uploadAEMMultipartFile` that uses `partSize`
    options.preferredPartSize = options.partSize ? options.partSize : options.preferredPartSize;
    
    // extract upload options
    const uploadOptions = filterObject(
        options || {},
        ['method', 'headers', ...CONCURRENCY_OPTIONS_FILTER,
            ...RETRY_OPTIONS_FILTER, 'preferredPartSize']
    );
    const uploader = new BlockUpload();
    return uploader.uploadFiles({
        uploadFiles,
        ...uploadOptions
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
        uploadOptions.headers = { ...uploadOptions.headers, 'content-length': contentLength };

        // upload file
        return uploadStream(readStream, url, uploadOptions);
    }, options);
}

module.exports = {
    downloadFile,
    uploadFile,
    downloadFileConcurrently,
    uploadFileConcurrently,
    uploadMultiPartFileConcurrently,
    uploadFilesConcurrently
};
