/*
 * Copyright 2021 Adobe. All rights reserved.
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

const { IllegalArgumentError } = require("../error");

const PRIVATE = Symbol("PRIVATE");

/**
 * Version of the asset to ensure that subsequent blocks are from the same asset
 */
class AssetVersion {
    /**
     * Construct a source or target asset
     * 
     * @param {Number} [lastModified] Last modified time in milliseconds since epoch
     * @param {String} [etag] ETag of the asset
     */
    constructor(lastModified, etag) {
        if (lastModified && !Number.isFinite(lastModified)) {
            throw new IllegalArgumentError("'lastModified' must be a number", lastModified);
        }
        if (etag && (typeof etag !== "string")) {
            throw new IllegalArgumentError("'etag' must be a string", etag);
        }
        this[PRIVATE] = {
            lastModified,
            etag
        };
    }

    /**
     * Last modified time in milliseconds since epoch
     * 
     * @returns {Number} Last modified time in milliseconds since epoch
     */
    get lastModified() {
        return this[PRIVATE].lastModified;
    }

    /**
     * ETag of the asset
     * 
     * @returns {String} ETag of the asset
     */
    get etag() {
        return this[PRIVATE].etag;
    }
}

module.exports = {
    AssetVersion
};