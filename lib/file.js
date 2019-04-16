/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2019 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/

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
    options = Object.assign({}, options, {
        headers: {
            'content-length': size
        }
    });

    // upload file
    const readStream = await createReadStream(filepath);
    return uploadStream(readStream, url, options);
}

module.exports = {
    downloadFile,
    uploadFile
}
