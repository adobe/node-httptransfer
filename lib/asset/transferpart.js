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
 * @typedef {Object} Headers
 */
/**
 * Reflects a unit of content to be transferred, refers to part of an asset.
 */
class TransferPart {
    /**
     * Construct a transfer part
     * 
     * @param {TransferAsset} transferAsset Transfer asset
     * @param {URL[]} targetUrls Target urls for this part
     * @param {DRange} contentRange Range for this part
     * @param {Headers} [headers] Headers to send when storing content in the target urls
     */
    constructor(transferAsset, targetUrls, contentRange, headers) {
        this[PRIVATE] = {
            transferAsset,
            targetUrls,
            contentRange,
            headers
        };
    }

    /**
     * Transfer asset
     * 
     * @returns {TransferAsset} Transfer asset
     */
    get transferAsset() {
        return this[PRIVATE].transferAsset;
    }

    /**
     * Target asset URLs
     * 
     * The bytes presented by contentRange should be stored in the target
     * asset urls returned by this getter.
     * 
     * @returns {String[]|URL[]} Target asset URLs
     */
    get targetUrls() {
        return this[PRIVATE].targetUrls;
    }

    /**
     * Content range reflected in this transfer part.
     * 
     * Note that the range is inclusive, meaning that the high-end of the range is included.
     * 
     * @returns {DRange} Content range in bytes
     */
    get contentRange() {
        return this[PRIVATE].contentRange;
    }

    /**
     * Headers to send when storing content in the target urls
     * 
     * @returns {Headers} Headers to send when storing content in the target urls
     */
    get headers() {
        return this[PRIVATE].headers;
    }

    /**
     * Source asset
     * 
     * @returns {Asset} Source asset, or undefined
     */
    get source() {
        return this[PRIVATE].transferAsset.source;
    }

    /**
     * Asset metadata
     * 
     * @returns {AssetMetadata} Asset metadata
     */
    get metadata() {
        return this[PRIVATE].transferAsset.metadata;
    }
}

module.exports = {
    TransferPart
};
