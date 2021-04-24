
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

/**
 * @typedef {Object} AssetVersion
 * @description Version of the asset to ensure that subsequent blocks are from the same asset
 * @property {Number} lastModified Last modified date of the stored asset
 * @property{String} etag ETag of the stored asset
 */
/**
 * Describes a source or target asset
 */
class AssetMetadata {
    /**
     * Construct a source or target asset
     * 
     * @param {String} contentType Content type of the asset
     * @param {Number} contentLength Content length in bytes
     * @param {Boolean} rangeSupport True if range reads are supported
     * @param {AssetVersion} [version] Asset version
     */
    constructor(contentType, contentLength, rangeSupport, version) {
        if (contentType && (typeof contentType !== "string")) {

        }
        if ()

        this[PRIVATE] = {
            contentType,
            contentLength,
            rangeSupport,
            version
        };
    }

    /**
     * Content type
     * 
     * @returns {String} Content type of the asset
     */
    get contentType() {
        return this[PRIVATE].contentType;
    }

    /**
     * Content length in bytes
     * 
     * @returns {Number} Content length in bytes
     */
    get contentLength() {
        return this[PRIVATE].contentLength;
    }

    /**
     * Range read support
     * 
     * @returns {Boolean} True if range request support
     */
    get rangeReadSupport() {
        return this[PRIVATE].rangeReadSupport;
    }

    /**
     * Version of the stored asset (etag, lastModified)
     * 
     * @returns {AssetVersion} Version of the stored asset (etag, lastModified)
     */
    get version() {
        return this[PRIVATE].version;
    }
}

module.exports = {
    AssetMetadata
};