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

require("core-js/stable");

const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} Headers
 */
/**
 * Describes a source or target asset
 */
class Asset {
    /**
     * Construct a source or target asset
     * 
     * @param {URL|String|Blob} url URL of the asset (http, https, or file), can also be a Blob for browser uploads
     * @param {Headers} [headers] Headers to send to request or store the asset 
     */
    constructor(url, headers) {
        if (typeof url === "string" || url instanceof URL) {
            this[PRIVATE] = {
                url: new URL(url),
                headers
            };
        } else {
            this[PRIVATE] = {
                url: "blob://",
                blob: url,
                headers
            };
        }
    }

    /**
     * Asset URL (http, https, file)
     * 
     * Will return a blob:// reference if the asset is a file selected in a browser.
     * 
     * @returns {URL} Asset URL (http, https, file)
     */
    get url() {
        return this[PRIVATE].url;
    }

    /**
     * Asset Blob for browser based uploads
     * 
     * @returns {Blob} Asset Blob
     */
    get blob() {
        return this[PRIVATE].blob;
    }

    /**
     * Headers to send to request or store the asset 
     * 
     * @returns {Headers} Headers to send to request or store the asset 
     */
    get headers() {
        return this[PRIVATE].headers;
    }
}

module.exports = {
    Asset
};