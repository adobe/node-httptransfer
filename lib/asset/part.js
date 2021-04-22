
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
 * Source or target part
 * 
 * NOTE: For target http/https urls the the asset is split over multiple URLs 
 * each containing a single part. 
 */
class Part {
    /**
     * Construct a source or target asset
     * 
    * @param {Asset|AEMMultipartAsset} asset Asset reference
    * @param {String|URL} uri URI of the source or target asset
    * @param {Number} [start=0] Start offset of the block in bytes
    * @param {Number} [end] End offset of the block in bytes (exclusive)
     */
    constructor(asset, uri, start, end) {
        this[PRIVATE] = {
            asset,
            uri, 
            start: start || 0,
            end: end || asset.length
        };
    }

    /**
     * Asset reference
     */
    get asset() {
        return this[PRIVATE].asset;
    }

    /**
     * Asset version
     */
    get version() {
        return this[PRIVATE].asset && this[PRIVATE].asset.version;
    }

    /**
     * Start offset of the block in bytes
     * 
     * @returns {Number} Start offset of the block in bytes
     */
    get start() {
        return this[PRIVATE].start;
    }

    /**
     * End offset of the block in bytes (exclusive)
     * 
     * @returns {Number} End offset of the block in bytes (exclusive)
     */
    get end() {
        return this[PRIVATE].end;
    }

    /**
     * Length of the block in bytes
     * 
     * @returns {Number} Length of the block in bytes
     */
    get length() {
        return this[PRIVATE].end - this[PRIVATE].start;
    }
}

module.exports = {
    Part
};