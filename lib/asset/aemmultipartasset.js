
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

const { isHttpProtocol } = require("../util");
const PRIVATE = Symbol("PRIVATE");

/**
 * Describes a target asset uploaded in multiple blocks
 */
class AEMMultipartAsset {
    /**
     * Construct a source or target AEM asset
     * 
     * @param {Asset} asset Asset representation
     * @param {String[]|URL[]} uris URL for every part to be uploaded (https)
     * @param {Number} minPartSize Minimum part size
     * @param {Number} maxPartSize Maximum part size
     * @param {String} [completeUri] Completion URI
     * @param {String} [uploadToken] Upload token 
     */
    constructor(asset, uris, minPartSize, maxPartSize, completeUri, uploadToken) {
        this[PRIVATE] = {
            uris,
            minPartSize,
            maxPartSize,
            asset,
            completeUri,
            uploadToken
        };
    }

    /**
     * AEM Asset
     * 
     * @returns {AEMAsset} Asset
     */
    get asset() {
        return this[PRIVATE].asset;
    }

    /**
     * URL for every part to be uploaded (https)
     * 
     * @returns {String[]|URL[]} URL for every part to be uploaded (https)
     */
    get uris() {
        return this[PRIVATE].folderUri;
    }

    /**
     * Minimum part size
     * 
     * @returns {Number} Minimum part size in bytes
     */
    get minPartSize() {
        return this[PRIVATE].minPartSize;
    }

    /**
     * Maximum part size
     * 
     * @returns {Number} Maximum part size in bytes
     */
    get maxPartSize() {
        return this[PRIVATE].maxPartSize;
    } 

    /**
     * Completion URI
     * 
     * @returns {String} Completion URI, or undefined
     */
    get completeUri() {
        return this[PRIVATE].completeUri;
    }
    
    /**
     * Upload token
     * 
     * @returns {String} Upload token, or undefined
     */
    get uploadToken() {
        return this[PRIVATE].uploadToken;
    }
}

module.exports = {
    AEMMultipartAsset
};