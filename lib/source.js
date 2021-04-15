
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

const { isHttpOrFileProtocol } = require("./util");
const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} ContentType
 * @property {string} type Mimetype
 * @property {*} parameters Parameters
 */
/**
 * Describes the (partial) source asset.
 */
class Source {
    /**
     * Construct a (partial) source asset
     * 
    * @param {URL} uri URI where the block will be read from (http, https, file)
    * @param {ContentType} contentType Content type of the asset
    * @param {number} lastModified Last modified date of the URI
    * @param {string} etag ETag of the URI
    * @param {number} totalSize Total size of the content in bytes
    * @param {number} [start=0] Start offset of the block of bytes
    * @param {number} [end] End offset of the block of bytes, defaults to remainder of the content (exclusive)
     */
    constructor(uri, contentType, lastModified, etag, totalSize, start, end) {
        if (!isHttpOrFileProtocol(uri)) {
            throw Error(`URI must have a http, https, or file protocol: ${uri}`);
        }
        this[PRIVATE] = {
            uri,
            contentType,
            lastModified,
            etag,
            totalSize,
            start: start || 0,
            end: end || (totalSize - start)
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
     * 
     * @returns {ContentType} Parsed content-type header, or undefined
     */
    get contentType() {
        return this[PRIVATE].contentType;
    }

    /**
     * Last modified date
     * 
     * @returns {Number} Parsed last-modified header, in milliseconds since epoch, or undefined
     */
    get lastModified() {
        return this[PRIVATE].lastModified;
    }

    /**
     * ETag
     * 
     * @returns {String} ETag identifier of the content, or undefined
     */
    get etag() {
        return this[PRIVATE].etag;
    }

    /**
     * Total size (bytes) of the content
     * 
     * @returns {Number} Total size of the content in bytes, or undefined
     */
    get totalSize() {
        return this[PRIVATE].totalSize;
    }

    /**
     * Start offset (bytes) of the block in the source
     * 
     * @returns {Number} Offset of the block in bytes
     */
    get start() {
        return this[PRIVATE].start;
    }

    /**
     * End offset (bytes) of the block in the source
     * 
     * @returns {Number} End offset of the block in bytes
     */
    get end() {
        return this[PRIVATE].end;
    }

    /**
     * Length (byes) of the block in source
     * 
     * @returns {Number} Length of the block in bytes
     */
    get length() {
        return this[PRIVATE].end - this[PRIVATE].start;
    }

    /**
     * Slice 
     * 
     * @param {number} [start=0] Start offset of the block of bytes
     * @param {number} [end] End offset of the block of bytes, defaults to remainder of the content (exclusive)
     * @returns {Source} Partial source asset
     */
    slice(start, end) {
        return new Source(
            this.uri,
            this.contentType,
            this.lastModified,
            this.etag,
            this.totalSize,
            start,
            end
        );
    }
}

module.exports = {
    Source
};