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

const fs = require('fs');

/**
 * Async function to open a read stream. Resolves on open event.
 * 
 * @param {String} path Path to file to open
 * @param {Object} options Options
 */
function createReadStream(path, options) {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createReadStream(path, options);
        writeStream.on('open', () => {
            resolve(writeStream);
        })
        const errorCallback = (error) => {
            writeStream.removeListener(errorCallback);
            reject(error);
        }
        writeStream.on('error', errorCallback);
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
            writeStream.removeListener(errorCallback);
            reject(error);
        }
        writeStream.on('error', errorCallback);
    });
}

module.exports = {
    createReadStream,
    createWriteStream
}
