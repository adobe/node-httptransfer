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

require("core-js/stable");

const fs = require('fs');
const validUrl = require('valid-url');

/**
 * Get the file stats
 * 
 * @param {String} path File path
 * @returns {fs.Stats} File stats
 */
function getFileStats(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if (err) {
                reject(err);
            } else {
                resolve(stats);
            }
        });
    });
}

/**
 * Async function to open a read stream. Resolves on open event.
 *
 * @param {String} path Path to file to open
 * @param {Object} options Options
 */
function createReadStream(path, options) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(path, options);
        readStream.on('open', () => {
            resolve(readStream);
        });
        const errorCallback = (error) => {
            readStream.removeListener('error', errorCallback);
            reject(error);
        };
        readStream.on('error', errorCallback);
    });
}

/**
 * Async function to open a write stream. Resolves on open event.
 *
 * @param {String} path Path to file to open
 * @param {Object} options Options
 */
function createWriteStream(path, options) {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(path, options);
        writeStream.on('open', () => {
            resolve(writeStream);
        });

        const errorCallback = (error) => {
            // remove itself to prevent any future callbacks
            writeStream.removeListener('error', errorCallback);
            reject(error);
        };
        writeStream.on('error', errorCallback);
    });
}

/**
 * Check if the given value is a http/https url
 * 
 * @param {*} value Value to check 
 * @returns {Boolean} True if the value is a http/https url
 */
function isValidWebUrl(value) {
    if (value instanceof URL) {
        return value.protocol === "https:" || value.protocol === "http:";
    } else if (typeof value === "string") {
        return validUrl.isWebUri(value);
    } else {
        return false;
    }
}

/**
 * Check if the provided URL has a file protocol
 * 
 * @param {URL|string} url URI to review
 * @returns {Boolean} True if the URL has a file protocol
 */
function isFileProtocol(url) {
    return url && new URL(url).protocol === 'file:';
}

/**
 * Check if value is a valid number
 * 
 * @param {Number} value Value to check
 * @returns {Boolean} True if value is a valid number
 */
function isValidNumber(value) {
    return (typeof value === "number") && !isNaN(value);
}

/**
 * Check if value is a positive number
 * 
 * @param {Number} value Value to check
 * @returns {Boolean} True if value is a positive number
 */
function isPositiveNumber(value) {
    return isValidNumber(value) && value > 0;
}

/**
 * Converts the content of a readable Stream into a Buffer
 * instance. WARNING: this method will read the entirety of
 * the stream into memory; use with extreme caution.
 *
 * @param {ReadableStream} stream Stream to convert.
 * @param {number} totalSize Total size of the stream.
 * @returns {Promise<Buffer>} Contents of the stream in a
 *  Buffer.
 */
async function streamToBuffer(stream, totalSize) {
    return new Promise((resolve, reject) => {
        const buffer = Buffer.allocUnsafe(totalSize);
        let bufferOffset = 0;

        stream.once('error', (err) => {
            reject(err);
        });

        stream.once('end', () => {
            if (bufferOffset !== totalSize) {
                reject(`Unexpected number of bytes read from stream. Expected ${totalSize} but got ${bufferOffset}.`);
                return;
            }
            resolve(buffer);
        });

        stream.on('data', (chunk) => {
            chunk.copy(buffer, bufferOffset, 0);
            bufferOffset += chunk.length;
        });
    });
}

/**
 * Converts one of several potential values to a local file path.
 * If the value is a string and does _not_ begin with "file://", then
 * the value will be returned as-is. Otherwise the value is assumed to
 * be a file URL, and the method will return the local path represented
 * by the URL.
 * @param {URL|string} path Value whose path should be retrieved.
 * @returns {string} A local file path.
 */
function fileUrlToFilePath(path) {
    if ((typeof path === "string") && !path.startsWith("file://")) {
        return path;
    } else {
        const url = new URL(path);
        let filePath = decodeURIComponent(url.pathname);
        // windows paths will have a forward slash followed by
        // the drive letter. strip off the leading forward slash
        // if it appears to be a windows path (i.e. starts with "/C:/")
        if (/^\/[a-zA-Z]:\//g.exec(filePath)) {
            filePath = filePath.substr(1);
        }
        return filePath;
    }
}

module.exports = {
    getFileStats,
    createReadStream,
    createWriteStream,
    isValidWebUrl,
    isFileProtocol,
    isValidNumber,
    isPositiveNumber,
    streamToBuffer,
    fileUrlToFilePath
};
