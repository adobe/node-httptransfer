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
 * Asset to be transferred
 */
class TransferAsset {
    /**
     * Construct an asset intended to be transferred
     * 
     * @param {Asset} [source] Source reference
     * @param {Asset|AEMAsset|AEMMultipartAsset} [target] Target reference
     */
    constructor(source, target) {
        this[PRIVATE] = {
            source,
            target
        };
    }

    /**
     * Source reference
     * 
     * @returns {Asset} Source reference, or undefined
     */
    get source() {
        return this[PRIVATE].source;
    }

    /**
     * Target reference 
     * 
     * @returns {Asset|AEMAsset|AEMMultipartAsset} Target reference, or undefined
     */
    get target() {
        return this[PRIVATE].target;
    }

    /**
     * Content type
     * 
     * @returns {String} Content type of the asset
     */
    get contentType() {
        const { source, target } = this[PRIVATE];
        if (source) {
            return source.contentType;
        } else if (target) {
            return target.contentType;
        } else {
            return undefined;
        }
    }

    /**
     * Content length in bytes
     * 
     * @returns {Number} Content length in bytes
     */
    get contentLength() {
        const { source, target } = this[PRIVATE];
        if (source) {
            return source.contentLength;
        } else if (target) {
            return target.contentLength;
        } else {
            return undefined;
        }
    }
}

module.exports = {
    TransferAsset
};