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

const fetch = require('node-fetch');
const { parseResourceHeaders } = require('./headers');

/**
 * Read a UTF8 text stream
 * 
 * @param {stream.Readable} stream Readable stream
 * @param {Number} maxLength Maximum number of characters to read
 * @param {Function} callback Callback with the text that was read
 */
async function readTextStream(stream, maxLength) {
    return new Promise(resolve => {
        let text = ''
        let totalLength = 0
        stream.setEncoding('utf8');
        stream.on('data', chunk => {
            totalLength += chunk.length
            const remaining = maxLength - Math.min(text.length, maxLength)
            if (remaining > 0) {
                text += chunk.substr(0, Math.min(chunk.length, remaining))
            }
        })
        stream.on('end', () => {
            if (totalLength > maxLength) {
                return resolve(`${text}...`);
            } else {
                return resolve(text);
            }
        })
    })
}

/**
 * @typedef {Object} DownloadStreamOptions
 * 
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 */
/**
 * Download content from a URL and write it to a stream
 * 
 * @param {String|URL} url Source URL
 * @param {Object} writeStream Target writable stream
 * 
 * @param {DownloadStreamOptions} options Download options
 * @returns {Promise} resolves when download completes
 */
async function downloadStream(url, writeStream, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('text/')) {
            const message = await readTextStream(response.body, 10000);
            throw Error(`Download '${url}' failed with status ${response.status}: ${message}`);
        } else {
            throw Error(`Download '${url}' failed with status ${response.status}`);
        }
    }

    return new Promise((resolve, reject) => {
        writeStream.on("error", err => {
            reject(Error(`Download '${url}' failed: ${err.message}`))
        });
        response.body
            .pipe(writeStream)
            .on("error", err => reject(err))
            .on("finish", () => resolve());
    });
}

/**
 * @typedef {Object} UploadStreamOptions
 * 
 * @property {String} method HTTP method (defaults to 'PUT')
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 */
/**
 * Upload a stream of data to a URL
 * 
 * @param {Object} readStream Source readable stream
 * @param {String} url Target URL
 * @param {UploadStreamOptions} options Upload options
 * @returns {Promise} resolves when upload completes
 */
async function uploadStream(readStream, url, options) {
    const response = await fetch(url, Object.assign({
        method: "PUT",
        body: readStream
    }, options));
    if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('text/')) {
            const message = await readTextStream(response.body, 10000);
            throw Error(`Upload to '${url}' failed with status ${response.status}: ${message}`);
        } else {
            throw Error(`Upload to '${url}' failed with status ${response.status}`);
        }
    }

    return new Promise((resolve, reject) => {
        response.body
            .resume()
            .on("error", err => reject(err))
            .on("finish", () => resolve());
    });
}

/**
 * Transfer a stream of content from one url to another
 * 
 * @param {String} sourceUrl Source URL
 * @param {String} targetUrl Target URL
 * @returns {Promise} resolves when transfer completes
 */
async function transferStream(sourceUrl, targetUrl) {
    const sourceRes = await fetch(sourceUrl);
    if (!sourceRes.ok) {
        throw Error(`Transfer '${sourceUrl}' to '${targetUrl}' failed: ${sourceRes.status}`);
    }

    const resourceHeaders = parseResourceHeaders(sourceRes.headers);
    const contentType = sourceRes.headers.get("content-type") || "application/octet-stream";
    const targetRes = await fetch(targetUrl, {
        method: "PUT",
        headers: {
            "content-length": resourceHeaders.size,
            "content-type": contentType
        },
        body: sourceRes.body
    })
    if (!targetRes.ok) {
        throw Error(`Transfer '${sourceUrl}' to '${targetUrl}' failed: ${sourceRes.status}`);
    }
}

module.exports = {
    downloadStream,
    uploadStream,
    transferStream
}
