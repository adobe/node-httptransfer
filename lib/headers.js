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

const fetch = require("node-fetch");
const contentTypeParser = require("content-type");
const contentDispositionParser = require("content-disposition");

async function getHeaders(url) {
    const response = await fetch(url, {
        headers: {
            range: "bytes=0-0"
        }
    });
    await response.body.blob();
    if (!response.ok) {
        throw Error(`Unable to retrieve headers for '${url}': ${response.status}`);
    }
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
    const contentLength = headers.get("content-length");
    if (contentLength && contentLength.match(/[0-9]/g)) {
        return parseInt(contentLength);
    } else if (contentLength) {
        console.warn(`Unable to parse 'content-length' header: ${contentLength}`);
        return 0;
    } else {
        return 0;
    }
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
 * @param {Headers} headers Headers returned by node-fetch
 * @returns {ResourceHeaders} parsed resource headers
 */
function parseResourceHeaders(headers) {
    return {
        filename: getFilename(headers),
        mimetype: getMimetype(headers) || "application/octet-stream",
        size: getSize(headers)
    }
}

/**
 * Retrieve content information 
 * 
 * @param {String} url URL to request content headers for
 * @returns {ResourceHeaders} content headers
 */
async function getResourceHeaders(url) {
    const headers = await getHeaders(url);
    return parseResourceHeaders(headers);
}

module.exports = {
    parseResourceHeaders,
    getResourceHeaders
}
