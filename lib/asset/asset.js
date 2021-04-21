
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

const { isHttpOrFileProtocol } = require("../util");
const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} Headers
 */
/**
 * @typedef {Object} AssetVersion
 * @description Version of the asset to ensure that subsequent blocks are from the same asset
 * @property {Number} lastModified Last modified date of the stored asset
 * @property{String} etag ETag of the stored asset
 */
/**
 * Describes a source or target asset
 */
class Asset {
    /**
     * Construct a source or target asset
     * 
     * @param {URL|String} uri URI of the asset (http, https, or file)
     * @param {String} contentType Content type of the asset
     * @param {Number} contentLength Content length in bytes
     * @param {Headers} [headers] Headers to send to request or store the asset 
     * @param {AssetVersion} [version] Asset version
     */
    constructor(uri, contentType, contentLength, headers, version) {
        if (!isHttpOrFileProtocol(uri)) {
            throw Error(`folderUri must have a http or https protocol: ${uri}`);
        }
        this[PRIVATE] = {
            uri,
            contentType,
            contentLength,
            headers: Object.assign({}, headers),
            version
        };
    }

    /**
     * Asset URI (http, https, file)
     * 
     * @returns {URL|String} Asset URI (http, https, file)
     */
    get uri() {
        return this[PRIVATE].uri;
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
     * Headers to send to request or store the asset 
     * 
     * @returns {Headers} Headers to send to request or store the asset 
     */
    get headers() {
        return this[PRIVATE].headers;
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
    Asset
};