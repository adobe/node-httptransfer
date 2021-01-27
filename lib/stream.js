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

const fetch = require('./fetch');
const { retry } = require("./retry");
const { parseResourceHeaders } = require('./headers');
const { HttpStreamError } = require('./error');

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
 * @returns {Promise} resolves to the number of bytes downloaded
 */
async function downloadStream(url, writeStream, options) {
    const response = await fetch.streamGet(url, options);
    console.log('-------------------------------- Headers:');
    console.log(JSON.stringify(response.headers));
    console.log('transfer encoding:', response.headers.get('transfer-encoding'));

    const expectedBytes = parseResourceHeaders(response.headers).size;
    let actualBytes = 0;
    return new Promise((resolve, reject) => {
        response.body
            .on("data", chunk => {
                actualBytes += chunk.length;
            })
            .on("error", err => {
                reject(new HttpStreamError("GET", url, response.status, err.message));
            })
            .pipe(writeStream)
            .on("error", err => {
                reject(new HttpStreamError("GET", url, response.status, err.message));
            })
            .on("finish", () => {
                if (expectedBytes && (actualBytes !== expectedBytes)) {
                    reject(new HttpStreamError("GET", url, response.status, `Unexpected stream-size. Received ${actualBytes} bytes, expected ${expectedBytes} bytes`));
                }
                resolve(actualBytes);
            });
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
    return fetch.issuePut(
        url,
        {body: readStream, ...options}
    );
}

/**
 * @typedef {Object} TransferStreamOptions
 *
 * @property {DownloadStreamOptions} source Source options
 * @property {UploadStreamOptions} target Target options
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Transfer a stream of content from one url to another
 *
 * @param {String} sourceUrl Source URL
 * @param {String} targetUrl Target URL
 * @param {TransferStreamOptions} options Transfer options
 * @returns {Promise} resolves when transfer completes
 */
async function transferStream(sourceUrl, targetUrl, options={}) {
    return retry(async options => {
        const response = await fetch.streamGet(sourceUrl, options.source);

        // resolve headers, allow override by options
        const resourceHeaders = parseResourceHeaders(response.headers);
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const headers = {"content-length": resourceHeaders.size,
            "content-type": contentType, ...options.target && options.target.headers};

        // resolve options, headers last since they are already resolved
        const targetOptions = {
            ...options.target, headers};
        return uploadStream(response.body, targetUrl, targetOptions);
    }, options);
}

module.exports = {
    downloadStream,
    uploadStream,
    transferStream
};
