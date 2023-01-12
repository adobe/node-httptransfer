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
const { Interval } = require("./interval");
const { TransferAsset } = require("./transferasset");

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
     * @param {Interval} contentRange Rage for this part
     * @param {Headers} [targetHeaders] Headers to send when storing content in the target urls
     */
    constructor(transferAsset, targetUrls, contentRange, targetHeaders) {
        if (!(transferAsset instanceof TransferAsset)) {
            throw new IllegalArgumentError("'transferAsset' must of be of type TransferAsset", transferAsset);
        }
        if (!Array.isArray(targetUrls) || (targetUrls.length === 0)) {
            throw new IllegalArgumentError("'targetUrls' must be a non-empty array", targetUrls);
        }
        if (!(contentRange instanceof Interval)) {
            throw new IllegalArgumentError("'contentRange' must be of type Interval", contentRange);
        }
        this[PRIVATE] = {
            transferAsset,
            targetUrls,
            contentRange,
            targetHeaders
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
     * @returns {Interval} Content range in bytes
     */
    get contentRange() {
        return this[PRIVATE].contentRange;
    }

    /**
     * Headers to send when interacting with the source
     * 
     * @returns {Headers} Headers to send when interacting with the source
     */
    get sourceHeaders() {
        return this[PRIVATE].transferAsset.source.headers;
    }

    /**
     * Headers to send when storing content in the target urls
     *
     * @returns {Headers} Headers to send when storing content in the target urls
     */
    get targetHeaders() {
        return this[PRIVATE].targetHeaders;
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
