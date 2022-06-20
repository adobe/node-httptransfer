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

require("core-js/stable");

const { sep, dirname: filePathDirname, basename: filePathBasename } = require("path");
const fs = require("fs");
const validUrl = require("valid-url");

/**
 * Get the file stats (asynchronously)
 * 
 * @param {String} path File path
 * @returns {fs.Stats} File stats
 */
function getFileStats(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if (err) {
                reject(err);
            } else {
                resolve(stats);
            }
        });
    });
}

/**
 * Check if the given value is a http/https url
 * 
 * @param {*} value Value to check 
 * @returns {Boolean} True if the value is a http/https url
 */
function isValidWebUrl(value) {
    if (value instanceof URL) {
        return value.protocol === "https:" || value.protocol === "http:";
    } else if (typeof value === "string") {
        return validUrl.isWebUri(value);
    } else {
        return false;
    }
}

/**
 * Check if the provided URL has a file protocol
 * 
 * @param {URL|string} url URI to review
 * @returns {Boolean} True if the URL has a file protocol
 */
function isFileProtocol(url) {
    return url && new URL(url).protocol === 'file:';
}

/**
 * Check if value is a positive number
 * 
 * @param {Number} value Value to check
 * @returns {Boolean} True if value is a positive number
 */
function isPositiveNumber(value) {
    return value && Number.isFinite(value) && value > 0;
}

/**
 * Ensures that all path separators in a given path are forward
 * slashes. The method will replace any backward slashes with
 * forward slashes.
 *
 * @param {String} path Path to be processed.
 * @returns {String} Path whose separators are forward slashes.
 */
function ensureForwardSlashes(path) {
    return path.replaceAll(/\\/g, '/');
}

/**
 * Retrieves the parent directory path of a given file path.
 * The separators in the returned path will always be forward
 * slashes, regardless of the operating system.
 *
 * @param {String} path Path to be processed.
 * @returns {String} Path whose separators are forward slashes.
 */
function urlPathDirname(path) {
    return ensureForwardSlashes(filePathDirname(path));
}

/**
 * @typedef {Object} PathInformation Information about the URL's path.
 * @property {string} path Full path from the URL.
 * @property {string} name Name of the item from the URL's path.
 * @property {string} parentPath Full path of the item's parent.
 *
 * Converts one of several potential URL values to its path.
 *
 * For example:
 *
 * If the value is a file URL (i.e. begins with file://), then the method
 * will return the URL's pathname. The method takes into account windows-style
 * paths, which might be preceeded with a leading forward slash. In addition,
 * the path will have the correct path separators, depending on the operating
 * system (i.e. backslash for windows, forward slash for posix). The path
 * will have also been URI decoded.
 *
 * Otherwise the value is assumed to be an HTTP URL, and the URL's URI decoded
 * pathname is returned.
 * @param {URL|string} path Value whose path should be retrieved.
 * @returns {PathInformation} Information about the URL's path.
 */
function urlToPath(path) {
    const url = new URL(path);
    let urlPath = decodeURIComponent(url.pathname);
    let parentPath = urlPathDirname(urlPath);
    const name = filePathBasename(urlPath);

    if (url.protocol === "file:") {
        // windows paths will have a forward slash followed by
        // the drive letter. strip off the leading forward slash
        // if it appears to be a windows path (i.e. starts with "/C:/")
        if (/^\/[a-zA-Z]:\//g.exec(urlPath)) {
            urlPath = urlPath.substr(1);
        }
        urlPath = urlPath.replace(/\//g, sep);
        parentPath = filePathDirname(urlPath);
    }

    return {
        path: urlPath,
        name,
        parentPath,
    };
}

function getMinimumMultipartPartSizeForTransfer(options, preferredPartSize){
    let minMemoryBlockSize = preferredPartSize;
    if(options && options.uploadFiles && options.uploadFiles.length > 0){
        let minMultipartPartSize = -1;
        // find max minPartSize from the uploadFiles array (as it defines the largest minimal memory block)
        options.uploadFiles.forEach(current => {
            minMultipartPartSize = Math.max(minMultipartPartSize, current.minPartSize);
        });
        minMemoryBlockSize = Math.max(minMemoryBlockSize, minMultipartPartSize);
    }
    return minMemoryBlockSize;
}

module.exports = {
    getFileStats,
    isValidWebUrl,
    isFileProtocol,
    urlPathDirname,
    urlToPath,
    isPositiveNumber,
    getMinimumMultipartPartSizeForTransfer
};
