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

const logger = require("./logger");
const { issueHead } = require("./fetch");
const { retry } = require("./retry");
const { HTTP, MIMETYPE } = require("./constants");
const { parse: parseContentRange } = require("content-range");
const { parse: parseContentType } = require("content-type");
const { parse: parseContentDisposition } = require("content-disposition");
const DEFAULT_MS_HEADERS_SOCKET_TIMEOUT = process.env.DEFAULT_MS_SOCKET_TIMEOUT || 60000; // socket timeout

async function getHeaders(url, options={}) {
    const timeoutValue = options.timeout || DEFAULT_MS_HEADERS_SOCKET_TIMEOUT;
    const { requestOptions = {} } = options;
    const fetchOptions = {
        timeout: timeoutValue,
        headers: { ...options.headers },
        ...requestOptions
    };

    if (options.doGet) {
        fetchOptions.method = HTTP.METHOD.GET;
        fetchOptions.headers.range = "bytes=0-0";
    }

    const response = await issueHead(url, fetchOptions);
    return response.headers;
}

/**
 * Last modified header in milliseconds since epoch
 * 
 * @param {Headers} headers HTTP headers
 * @returns {number} Last-modified time stamp in milliseconds since epoch
 */
function getLastModified(headers) {
    const lastModified = Date.parse(headers.get(HTTP.HEADER.LAST_MODIFIED));
    if (Number.isFinite(lastModified)) {
        return lastModified;
    } else {
        return undefined;
    }
}

/**
 * Non-weak ETag identifier
 * 
 * @param {Headers} headers HTTP headers
 * @returns {string} Non-weak ETag identifier
 */
function getETag(headers) {
    const etag = headers.get(HTTP.HEADER.ETAG);
    if (etag && !etag.startsWith("W/")) {
        return etag;
    } else {
        return undefined;
    }
}

/**
 * @typedef {Object} ContentDisposition
 * @property {'attachment'|'inline'|string} type Type
 * @property {*} parameters Parameters
 */
/**
 * Parsed content-disposition header
 * 
 * @param {Headers} headers HTTP headers
 * @returns {ContentDisposition} Parsed content-disposition header
 */
function getContentDisposition(headers) {
    const value = headers.get(HTTP.HEADER.CONTENT_DISPOSITION);
    if (value) {
        try {
            const parsed = parseContentDisposition(value, {
                fallback: false
            });
            return parsed;
        } catch (e) {
            logger.warn(`Unable to parse 'content-disposition' header: ${value}`, e.message || e);
        }
    }
    return undefined;
}

/**
 * Filename from the content-disposition header
 * 
 * @param {Headers} headers HTTP headers
 * @returns {string} Filename from the content-disposition header
 */
function getFilename(headers) {
    const value = getContentDisposition(headers);
    return value && value.parameters && value.parameters.filename;
}

/**
 * @typedef {Object} ContentType
 * @property {string} type Mimetype
 * @property {*} parameters Parameters
 */
/**
 * Parsed content-type header
 * 
 * @param {Headers} headers HTTP headers
 * @returns {ContentType} Parsed content-type header
 */
function getContentType(headers) {
    const value = headers.get(HTTP.HEADER.CONTENT_TYPE);
    if (value) {
        try {
            return parseContentType(value);
        } catch (e) {
            logger.warn(`Unable to parse 'content-type' header: ${value}`, e.message || e);
        }
    }
    return undefined;
}

/**
 * Mime-type
 * 
 * @param {Headers} headers HTTP headers
 * @returns {string} Mime-type
 */
function getMimetype(headers) {
    const value = getContentType(headers);
    return value && value.type;
}

/**
 * @typedef {Object} ContentRange
 * @property {String} unit Units (bytes)
 * @property {Number} [start] Starting offset
 * @property {Number} [end] Ending offset (inclusive)
 * @property {Number} [size] Total size of the content
 */
/**
 * Retrieve and parse Content-Range from the HTTP headers
 * 
 * @param {Headers} headers HTTP headers
 * @returns {ContentRange} Content range
 */
function getContentRange(headers) {
    const contentRange = headers.get(HTTP.HEADER.CONTENT_RANGE);
    if (contentRange) {
        return parseContentRange(contentRange);
    } else {
        return undefined;
    }
}

/**
 * Retrieve and parse Content-Length from the HTTP headers
 * 
 * @param {Headers} headers HTTP headers
 * @returns {number} Content length or undefined
 */
function getContentLength(headers) {
    const value = headers.get(HTTP.HEADER.CONTENT_LENGTH);
    if (value) {
        const parsed = parseInt(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}

/**
 * Retrieve the content length from the Content-Range or Content-Length header
 * 
 * @param {Headers} headers HTTP headers
 * @returns Content length from the Content-Range or Content-Length header
 */
function getSize(headers) {
    const contentRange = getContentRange(headers);
    const contentLength = getContentLength(headers);
    return (contentRange && contentRange.size) || contentLength;
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
        mimetype: getMimetype(headers) || MIMETYPE.APPLICATION_OCTET_STREAM,
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
 * @property {Object} requestOptions Options that will be passed to fetch (either node-fetch-npm or native fetch, depending on the context)
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
    getHeaders,
    parseResourceHeaders,
    getResourceHeaders,
    getContentRange,
    getContentLength,
    getContentType,
    getETag,
    getFilename,
    getLastModified,
    getSize
};
