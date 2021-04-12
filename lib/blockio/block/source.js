
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

const { isSupportedProtocol } = require("../util");
const PRIVATE = Symbol("PRIVATE");

/**
 * Source of a given block
 */
class BlockSource {
    constructor(uri, contentType, lastModified, etag, offset, size) {
        this[PRIVATE] = {
            uri,
            contentType,
            lastModified,
            etag,
            offset: offset || 0,
            size
        };
    }

    /**
     * Source URI, can be http/https or file
     */
    get uri() {
        return this[PRIVATE].uri;
    }

    /**
     * Content type
     */
    get contentType() {
        return this[PRIVATE].contentType;
    }

    /**
     * Last modified date and time
     */
    get lastModified() {
        return this[PRIVATE].lastModified;
    }

    /**
     * ETag
     */
    get etag() {
        return this[PRIVATE].etag;
    }

    /**
     * Offset (bytes) of the block in the source
     */
    get offset() {
        return this[PRIVATE].offset;
    }

    /**
     * Size (bytes) of the block in the source
     */
    get size() {
        return this[PRIVATE].size;
    }
}

/**
 * Create a source where the block of bytes will be read from
 * 
 * @param {URL} uri URI where the block will be read from (http, https, file)
 * @param {number} [lastModified] Last modified date of the URI
 * @param {string} [etag] ETag of the URI
 * @param {number} [offset=0] Offset of the block of bytes
 * @param {number} size Size of the block of bytes
 * @returns Source of a block
 */
function createBlockSource(uri, lastModified, etag, offset, size) {
    if (!isSupportedProtocol(uri)) {
        throw Error(`URI must have a http, https, or file protocol: ${uri}`);
    }
    return new BlockSource(uri, lastModified, etag, offset, size);
}

module.exports = {
    createBlockSource
};