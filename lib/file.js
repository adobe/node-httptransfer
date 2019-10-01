/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

'use strict';

const fs = require('fs-extra');
const path = require('path');
const { downloadStream, uploadStream } = require('./stream');
const { createReadStream, createWriteStream } = require('./util');

/**
 * @typedef {Object} DownloadFileOptions
 * 
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 * @property {Boolean} mkdirs True if the directory of the filepath should be created
 */
/**
 * Download a file from an url
 * 
 * @param {String|URL} url Source URL
 * @param {String} filepath Target file path
 * @param {DownloadFileOptions} options Download options
 * @returns {Promise} resolves when download completes
 */
async function downloadFile(url, filepath, options) {
    if (options && options.mkdirs) {
        await fs.ensureDir(path.dirname(filepath));
    }
    const writeStream = await createWriteStream(filepath);
    return downloadStream(url, writeStream, options);
}

/**
 * @typedef {Object} UploadFileOptions
 * 
 * @property {String} method HTTP method (defaults to 'PUT')
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 */
/**
 * Upload a file to an url
 * 
 * @param {String} filepath Source file path
 * @param {String} url Target URL
 * @param {UploadFileOptions} options Upload options
 * @returns {Promise} resolves when upload completes
 */
async function uploadFile(filepath, url, options) {
    // pass in the content-length header to disable chunked encoding
    const { size } = await fs.stat(filepath);
    const headers = Object.assign({
        "content-length": size
    }, options && options.headers);
    options = Object.assign({}, options, { headers });

    // upload file
    const readStream = await createReadStream(filepath);
    return uploadStream(readStream, url, options);
}

module.exports = {
    downloadFile,
    uploadFile
}
