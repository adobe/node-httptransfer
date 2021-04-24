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

const PRIVATE = Symbol("PRIVATE");
const { Range } = require("../range");
const { stat } = require("fs").promises;
const path = require("path");
const mime = require("mime-types");

/**
 * Normalize content type using the definition of the File API.
 * Any invalid characters will result in an empty string.
 * 
 * @param {String} contentType Content-type
 */
function normalizeContentType(contentType) {
    if (typeof contentType === "string") {
        const hasInvalidChars = Array.from(contentType).find(c => (c < 0x20) || (c > 0x7E));
        if (!hasInvalidChars) {
            return contentType.toLowerCase();
        }
    }
    return "";
}

/**
 * Read-only local file representation that (mostly) follows the File and Blob interfaces
 * as described in https://w3c.github.io/FileAPI/#file-constructor
 */
class LocalFileImpl {
    /**
     * Construct a local file representation
     * 
     * @param {String} fileName Filename (and path) of the local file
     * @param {Number} lastModified Last modified time in milliseconds since epoch
     * @param {Number} size Size of the file in milliseconds
     * @param {String} contentType Mime-type of the file, or an empty string if none can be found
     * @param {Range} range Range in bytes
     */
    constructor(fileName, lastModified, size, contentType, range) {
        this[PRIVATE].fileName = fileName;
        this[PRIVATE].lastModified = lastModified;
        this[PRIVATE].size = size;
        this[PRIVATE].contentType = contentType;
        this[PRIVATE].range = range;
    }

    /**
     * Date and time represented as the number of milliseconds since the Unix Epoch (which is the equivalent of Date.now()
     * 
     * @returns {Number} Milliseconds since epoch
     */
    get lastModified() {
        return this[PRIVATE].lastModified;
    }

    /**
     * Filename without path information
     * 
     * @returns {String} Filename without path information
     */
    get name() {
        return path.basename(this[PRIVATE].fileName);
    }

    /**
     * Number of bytes in the byte sequence
     * 
     * @returns {Number} Number of bytes in the byte sequence
     */
    get size() {
        return this[PRIVATE].size;
    }

    /**
     * Parsable mime-type or an empty string if the mime-type couldn't be determined.
     * 
     * @returns {String} ASCII-encoded string in lower case representing the media type
     */
    get type() {
        return this[PRIVATE].contentType;
    }

    /**
     * Return a local file blob with bytes ranging from the optional start parameter
     * up to, but not including the optional end parameter.
     * 
     * @param {Number} [start] Starting point of the byte sequence
     * @param {Number} [end] Ending point of the byte sequence
     * @param {String} [contentType] ASCII-encoded string in lower case representing the media type
     */
    slice(start, end, contentType) {
        const {
            fileName,
            lastModified,
            size,
            range
        } = this[PRIVATE];
        return new LocalFileImpl(
            fileName,
            lastModified,
            size,
            normalizeContentType(contentType),
            range.slice(start, end)
        );
    }
}

/**
 * Open a local file
 * 
 * @param {String} fileName Name of the file
 * @returns {LocalFile} Local file representation
 */
async function LocalFile(fileName) {
    const { size, mtimeMs: lastModified } = await stat(fileName);
    const contentType = mime.lookup(fileName) || "";
    return new LocalFileImpl(fileName, lastModified, size, contentType, new Range(0, size));
}

module.exports = {
    LocalFile
};