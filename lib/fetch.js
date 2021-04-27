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

"use strict";

const fetch = require("node-fetch-npm");
const { HttpResponseError, HttpConnectError, HttpStreamError } = require("./error");
const { HTTP } = require("./constants");

// --------------------------------- For tests ---------------------------------------------------
// I could not find a way to return a stream from fetch() using nock that would fail when read.
// The error is passed through, but it ends up being emitted on a client message object internally
// which is not caught.
// The code below is meant for unit testing only, and overrides the stream returned by fetch/nock.
// It does this once and resets back to the default state.

const responseBodyOverride = {};

/**
 * Override the stream returned by fetch for unit testing stream failures
 *
 * @param {String} method HTTP method for which to return the provided stream
 * @param {Readable} stream Readable stream
 */
function testSetResponseBodyOverride(method, stream) {
    responseBodyOverride[method] = stream;
}

/**
 * Return true if any response body overrides are in place
 */
function testHasResponseBodyOverrides() {
    return Object.entries(responseBodyOverride).length > 0;
}

/**
 * Override the response body
 *
 * @param {String} method Method
 * @param {Response} response Fetch response
 */
function testOverrideResponseBody(method, response) {
    if (responseBodyOverride[method]) {
        response.body = responseBodyOverride[method];
        delete responseBodyOverride[method];
    }
}

// --------------------------------- /For tests --------------------------------------------------

/**
 * Check if response is user readable text
 *
 * @param {Headers} headers Fetch headers (https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
 */
function isTextContent(headers) {
    const contentType = headers.get(HTTP.HEADER.CONTENT_TYPE);
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
    return new Promise((resolve, reject) => {
        let text = "";
        let totalLength = 0;
        stream.setEncoding("utf8");
        stream.on("data", chunk => {
            totalLength += chunk.length;
            const remaining = maxLength - Math.min(text.length, maxLength);
            if (remaining > 0) {
                text += chunk.substr(0, Math.min(chunk.length, remaining));
            }
        });
        stream.on("end", () => {
            if (totalLength > maxLength) {
                return resolve(`${text}...`);
            } else {
                return resolve(text);
            }
        });
        stream.on("error", error => {
            reject(error);
        });
    });
}

/**
 * Issue an streaming HTTP request with error handling
 *
 * @param {String} method HTTP method
 * @param {String} url URL to connect to
 * @param {Object} options Fetch options
 * @returns {*} response
 */
async function stream(method, url, options) {
    const request = {method, ...options};
    let response;
    try {
        // fetch is defined globally by isomorphic-fetch
        // eslint-disable-next-line no-undef
        response = await fetch(url, request);
        testOverrideResponseBody(method, response);
    } catch (e) {
        throw new HttpConnectError(request.method, url, e.message);
    }

    if (!response.ok) {
        let message;
        if (isTextContent(response.headers)) {
            try {
                message = await readTextStream(response.body, 10000);
            } catch (e) {
                throw new HttpStreamError(request.method, url, response.status, e);
            }
        }
        throw new HttpResponseError(request.method, url, response.status, message);
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
    const response = await stream(HTTP.METHOD.HEAD, url, options);
    response.body.destroy();
    return response;
}

/**
 * Download content from the given URL.
 * Defaults to "GET" method.
 *
 * @param {String} url URL to download
 * @param {Object} options Fetch options
 * @returns {*} HTTP response
 */
async function streamGet(url, options) {
    return stream(HTTP.METHOD.GET, url, options);
}

/**
 * Issue a POST request
 * 
 * @param {String} url URL to send request to
 * @param {Object} options Fetch options
 * @returns {*} received JSON
 */
async function issuePostJSON(url, options) {
    const response = await stream(HTTP.METHOD.POST, url, options);
    return response.json();
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
    const response = await stream(HTTP.METHOD.PUT, url, options);
    response.body.destroy();
    return response;
}


module.exports = {
    issueHead,
    streamGet,
    issuePostJSON,
    issuePut,
    testSetResponseBodyOverride,
    testHasResponseBodyOverrides
};
