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

const fetch = require("./fetch");
const { retry } = require("./retry");
const contentRangeParser = require("content-range");
const contentTypeParser = require("content-type");
const contentDispositionParser = require("content-disposition");
const DEFAULT_MS_HEADERS_SOCKET_TIMEOUT = process.env.DEFAULT_MS_SOCKET_TIMEOUT || 60000; // socket timeout

async function getHeaders(url, options={}) {
    const timeoutValue = options.timeout || DEFAULT_MS_HEADERS_SOCKET_TIMEOUT;
    const fetchOptions = {
        timeout: timeoutValue,
        headers: { ...options.headers }
    };

    if (options.doGet) {
        fetchOptions.method = "GET";
        fetchOptions.headers.range = "bytes=0-0";
    }

    const response = await fetch.issueHead(url, fetchOptions);
    return response.headers;
}

function getFilename(headers) {
    const contentDisposition = headers.get("content-disposition");
    if (contentDisposition) {
        try {
            const parsed = contentDispositionParser.parse(contentDisposition, {
                fallback: false
            });
            return parsed && parsed.parameters && parsed.parameters.filename;
        } catch (e) {
            console.warn(`Unable to parse 'content-disposition' header: ${contentDisposition}`, e.message || e);
        }
    } else {
        return null;
    }
}

function getMimetype(headers) {
    const contentType = headers.get("content-type");
    if (contentType) {
        try {
            const parsed = contentTypeParser.parse(contentType);
            return parsed && parsed.type;
        } catch (e) {
            console.warn(`Unable to parse 'content-type' header: ${contentType}`, e.message || e);
        }
    } else {
        return null;
    }
}

function getSize(headers) {
    const contentRange = headers.get("content-range");
    const contentLength = headers.get("content-length");
    const parsed = contentRangeParser.parse(contentRange);
    return (parsed && parsed.length) || (contentLength && parseInt(contentLength));
}

/**
 * @typedef {Object} ResourceHeaders
 *
 * @property {String} filename Resource filename (if available)
 * @property {String} mimetype Resource mimetype (if available)
 * @property {Number} size Resource size in bytes (if available)
 */
/**
 * Parse headers
 *
 * @param {Headers} headers Headers returned by fetch (https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
 * @returns {ResourceHeaders} parsed resource headers
 */
function parseResourceHeaders(headers) {
    const result = {
        mimetype: getMimetype(headers) || "application/octet-stream",
        size: getSize(headers) || 0
    };
    const filename = getFilename(headers);
    if (filename) {
        result.filename = filename;
    }
    return result;
}

/**
 * @typedef {Object} GetResourceHeadersOptions
 * @property {Object} headers An object containing request headers
 * @property {Number} timeout Socket timeout
 * @property {Boolean} doGet Use the HTTP GET method to fetch response headers
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Retrieve content information
 *
 * @param {String} url URL to request content headers for
 * @param {GetResourceHeadersOptions} options Resource header options
 * @returns {ResourceHeaders} content headers
 */
async function getResourceHeaders(url, options) {
    return retry(async options => {
        const headers = await getHeaders(url, options);
        return parseResourceHeaders(headers);
    }, options);
}

module.exports = {
    parseResourceHeaders,
    getResourceHeaders
}
