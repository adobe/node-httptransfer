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

const fs = require('fs');

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
        })
        const errorCallback = (error) => {
            readStream.removeListener('error', errorCallback);
            reject(error);
        }
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
            // only issued once
            resolve(writeStream);
        })
        const errorCallback = (error) => {
            // remove itself to prevent any future callbacks
            writeStream.removeListener('error', errorCallback);
            reject(error);
        }
        writeStream.on('error', errorCallback);
    });
}

module.exports = {
    createReadStream,
    createWriteStream
}
