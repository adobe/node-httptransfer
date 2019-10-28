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

"use strict";

require("isomorphic-fetch");
const { HttpTransferError, HttpConnectError } = require("./error");

/**
 * Check if response is user readable text
 * 
 * @param {Headers} headers Node-fetch headers
 */
function isTextContent(headers) {
    const contentType = headers.get("content-type");
    return contentType && (
        contentType.startsWith("text/") || 
        contentType.startsWith("application/xml") ||
        contentType.startsWith("application/json")
    );
}

/**
 * Read a UTF8 text stream
 * 
 * @param {stream.Readable} stream Readable stream
 * @param {Number} maxLength Maximum number of characters to read
 * @param {Function} callback Callback with the text that was read
 */
async function readTextStream(stream, maxLength) {
    return new Promise(resolve => {
        let text = ""
        let totalLength = 0
        stream.setEncoding("utf8");
        stream.on("data", chunk => {
            totalLength += chunk.length
            const remaining = maxLength - Math.min(text.length, maxLength)
            if (remaining > 0) {
                text += chunk.substr(0, Math.min(chunk.length, remaining))
            }
        })
        stream.on("end", () => {
            if (totalLength > maxLength) {
                return resolve(`${text}...`);
            } else {
                return resolve(text);
            }
        })
    })
}

/**
 * Issue an streaming HTTP request with error handling
 * 
 * @param {String} method HTTP method 
 * @param {String} url URL to connect to
 * @param {Object} options Fetch options
 */
async function stream(method, url, options) {
    const request = Object.assign({ method }, options);
    let response;
    try {
        response = await fetch(url, request);
    } catch (e) {
        throw new HttpConnectError(request.method, url, e.message);
    }

    if (!response.ok) {
        if (isTextContent(response.headers)) {
            const message = await readTextStream(response.body, 10000);
            throw new HttpTransferError(request.method, url, response.status, message);
        } else {
            throw new HttpTransferError(request.method, url, response.status);
        }
    } else {
        return response;
    }
}

/**
 * Retrieve headers and status from the given URL. 
 * Defaults to "HEAD" method.
 * The response stream is closed on success.
 * 
 * @param {String} url URL to download 
 * @param {Object} options Fetch options
 */
async function issueHead(url, options) {
    const response = await stream("HEAD", url, options);
    response.body.destroy();
    return response;
}

/**
 * Download content from the given URL. 
 * Defaults to "GET" method.
 * 
 * @param {String} url URL to download 
 * @param {Object} options Fetch options
 */
async function streamGet(url, options) {
    return stream("GET", url, options);
}

/**
 * Upload content to the given URL. 
 * Defaults to "PUT" method.
 * The response stream is closed on success.
 * 
 * @param {String} url URL to download 
 * @param {Object} options Fetch options
 */
async function issuePut(url, options) {
    const response = await stream("PUT", url, options);
    response.body.destroy();
    return response;
}

module.exports = {
    issueHead,
    streamGet,
    issuePut
};
