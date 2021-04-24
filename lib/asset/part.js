
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
    * @param {Range} range Content range
    * @param {Blob|Buffer|LocalFile} [contents] Contents with first byte of part is at offset 0
     */
    constructor(asset, uri, range, contents) {
        this[PRIVATE] = {
            asset,
            uri, 
            range,
            contents
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
     * Content range in bytes
     * 
     * @returns {Range} Content range in bytes
     */
    get range() {
        return this[PRIVATE].range;
    }

    /**
     * Part contents 
     * 
     * Blob, Buffer, and LocalFile all have slice methods, so we can avoid tracking 
     * a separate offset and make sure that the first byte of the part always starts
     * at offset 0.
     * 
     * @returns {Blob|Buffer|LocalFile} Contents, with first byte of part starting at offset 0
     */
    get contents() {
        return this[PRIVATE].contents;
    }
}

module.exports = {
    Part
};