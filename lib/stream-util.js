/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

"use strict";

require("core-js/stable");

const fs = require("fs");
const { HttpStreamError } = require("./error");

/**
 * Async function to open a read stream. Resolves on open event (asynchronously).
 *
 * @param {String} path Path to file to open
 * @param {Object} options Options
 * 
 * @returns {Promise} A promise resolving to a read stream
 */
function createReadStream(path, options) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(path, options);
        readStream.on("open", () => {
            resolve(readStream);
        });
        const errorCallback = (error) => {
            readStream.removeListener("error", errorCallback);
            reject(error);
        };
        readStream.on("error", errorCallback);
    });
}

/**
 * Async function to open a write stream. Resolves on open event (asynchronously).
 *
 * @param {String} path Path to file to open
 * @param {Object} options Options
 * 
 * @returns {Promise} A promise resolving to a write stream
 */
function createWriteStream(path, options) {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(path, options);
        writeStream.on("open", () => {
            resolve(writeStream);
        });

        const errorCallback = (error) => {
            // remove itself to prevent any future callbacks
            writeStream.removeListener("error", errorCallback);
            reject(error);
        };
        writeStream.on("error", errorCallback);
    });
}

/**
 * Converts the content of a readable Stream into a Buffer
 * instance. WARNING: this method will read the entirety of
 * the stream into memory; use with extreme caution.
 *
 * @param {String} method HTTP method
 * @param {String} url URL requested
 * @param {Number} status HTTP status code of response
 * @param {ReadableStream} stream Stream to convert.
 * @param {number} totalSize Total size of the stream.
 * @returns {Promise<Buffer>} Contents of the stream in a
 *  Buffer.
 */
async function streamToBuffer(method, url, status, stream, totalSize) {
    return new Promise((resolve, reject) => {
        const buffer = Buffer.allocUnsafe(totalSize);
        let bufferOffset = 0;

        stream.once("error", (err) => {
            reject(new HttpStreamError(method, url, status, err));
        });

        stream.once("end", () => {
            if (bufferOffset !== totalSize) {
                reject(new HttpStreamError(method, url, status, `Unexpected number of bytes read from stream. Expected ${totalSize} but got ${bufferOffset}.`));
                return;
            }
            resolve(buffer);
        });

        stream.on("data", (chunk) => {
            chunk.copy(buffer, bufferOffset, 0);
            bufferOffset += chunk.length;
        });
    });
}

/**
 * Converts the content of a readable Stream into a Buffer
 * instance. WARNING: this method will read the entirety of
 * the stream into memory; use with extreme caution.
 *
 * @param {String} method HTTP method
 * @param {String} url URL requested
 * @param {Number} status HTTP status code of response
 * @param {ReadableStream} stream Stream to convert.
 * @param {number} totalSize Total size of the stream.
 * @returns {Promise<TransferMemoryBlock>} Contents of the stream in a
 *  pooled buffer memory block.
 */
async function streamToPooledBuffer(method, url, status, stream, totalSize, bufferBlockMemoryAllocator) {
    if (!bufferBlockMemoryAllocator) {
        return streamToBuffer(method, url, status, stream, totalSize);
    }

    return bufferBlockMemoryAllocator.obtainBuffer(totalSize).then((bufferMemoryBlock) => {
        return new Promise((resolve, reject) => {
            let bufferOffset = 0;
            stream.once("error", (err) => {
                reject(new HttpStreamError(method, url, status, err));
            });

            stream.once("end", () => {
                if (bufferOffset !== totalSize) {
                    reject(new HttpStreamError(method, url, status, `Unexpected number of bytes read from stream. Expected ${totalSize} but got ${bufferOffset}.`));
                    return;
                }
                resolve(bufferMemoryBlock);
            });

            stream.on("data", (chunk) => {
                if (bufferOffset >= totalSize) {
                    reject(new HttpStreamError(method, url, status, `Unexpected number of bytes written to buffer from stream. Too many bytes: Expected ${totalSize} but got ${bufferOffset}.`));
                }

                chunk.copy(bufferMemoryBlock.buffer, bufferOffset, 0);
                bufferOffset += chunk.length;
            });
        });
    });
}

module.exports = {
    createReadStream,
    createWriteStream,
    streamToBuffer,
    streamToPooledBuffer,
};