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
 * @param {Number} value Check if value is a valid number
 * @returns {Boolean} True if value is a valid number
 */
function isValidNumber(value) {
    return (typeof value === "number") && !isNaN(value);
}

/**
 * Converts the content of a readable Stream into a Buffer
 * instance. WARNING: this method will read the entirety of
 * the stream into memory; use with extreme caution.
 *
 * @param {ReadableStream} stream Stream to convert.
 * @returns {Promise<Buffer>} Contents of the stream in a
 *  Buffer.
 */
async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        stream.once('error', (err) => {
            reject(err);
        });

        stream.once('end', () => {
            resolve(Buffer.concat(chunks));
        });

        stream.on('data', (chunk) => {
            chunks.push(chunk);
        });
    });
}

module.exports = {
    getFileStats,
    createReadStream,
    createWriteStream,
    isFileProtocol,
    isValidNumber,
    streamToBuffer
};
