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
 * Describes a source or target asset
 */
class AssetMetadata {
    /**
     * Construct a source or target asset
     * 
     * @param {String} [filename] Name of the file to be uploaded
     * @param {String} [contentType] Content type of the asset
     * @param {Number} contentLength Content length in bytes
     */
    constructor(filename, contentType, contentLength) {
        if (filename && typeof filename !== "string") {
            throw new IllegalArgumentError("'filename' must be a string", filename);
        }
        if (contentType && typeof contentType !== "string") {
            if(contentType.type){
                contentType = contentType.type;
            } else {
                throw new IllegalArgumentError("'contentType' must be a string", contentType);
            }
        }
        if (contentLength && !Number.isFinite(contentLength) || (contentLength < 0)) {
            throw new IllegalArgumentError("'contentLength' must be a non-negative number", contentLength);
        }
        this[PRIVATE] = {
            filename,
            contentType,
            contentLength
        };
    }

    /**
     * Name of the file to be uploaded
     * 
     * @returns {String} Name of the file to be uploaded
     */
    get filename() {
        return this[PRIVATE].filename;
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
}

module.exports = {
    AssetMetadata
};