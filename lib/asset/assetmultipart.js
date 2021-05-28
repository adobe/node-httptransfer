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

const { IllegalArgumentError } = require("../error");
const { isPositiveNumber, isValidWebUrl } = require("../util");

const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} Headers
 */
/**
 * Describes multi-part target, allowing the asset can be uploaded in parts/blocks.
 * 
 * This is supported in the AEM upload API as well as Azure and AWS.
 */
class AssetMultipart {
    /**
     * Construct a source or target asset
     * 
     * @param {URL[]} targetUrls Target urls to upload parts
     * @param {Number} minPartSize Minimum part size
     * @param {Number} maxPartSize Maximum part size
     * @param {Headers} [headers] Optional headers to upload to the given target urls
     * @param {URL} [completeUrl] AEM complete upload url
     * @param {String} [uploadToken] Upload token used by AEM complete upload
     */
    constructor(targetUrls, minPartSize, maxPartSize, headers, completeUrl, uploadToken) {
        if (!Array.isArray(targetUrls) || (targetUrls.length === 0)) {
            throw new IllegalArgumentError("'targetUrls' must be a non-empty array", targetUrls);
        } else if (!isPositiveNumber(minPartSize)) {
            throw new IllegalArgumentError("'minPartSize' must be a positive number", minPartSize);
        } else if (!isPositiveNumber(maxPartSize) || (maxPartSize < minPartSize)) {
            throw new IllegalArgumentError(`'maxPartSize' must be larger or equal to 'minPartSize' (minPartSize=${minPartSize})`, maxPartSize);
        } else if (completeUrl && !isValidWebUrl(completeUrl)) {
            throw new IllegalArgumentError("'completeUrl' must be a http/https url", completeUrl);
        }
        this[PRIVATE] = {
            targetUrls,
            minPartSize,
            maxPartSize,
            headers,
            completeUrl: completeUrl && new URL(completeUrl),
            uploadToken
        };
    }

    /**
     * Target urls
     * 
     * @returns {URL[]} Target urls to upload parts
     */
    get targetUrls() {
        return this[PRIVATE].targetUrls;
    }

    /**
     * Minimum part size
     * 
     * @returns {Number} Minimum part size
     */
    get minPartSize() {
        return this[PRIVATE].minPartSize;
    }

    /**
     * Maximum part size
     * 
     * @returns {Number} Minimum part size
     */
    get maxPartSize() {
        return this[PRIVATE].maxPartSize;
    }

    /**
     * Optional headers to use to upload the asset to the urls
     */
    get headers() {
        return this[PRIVATE].headers;
    }

    /**
     * AEM complete upload URL after upload has finished
     * 
     * @returns {URL} Completion URL
     */
    get completeUrl() {
        return this[PRIVATE].completeUrl;
    }

    /**
     * Upload token used by AEM complete upload
     * 
     * @returns {String} Upload token
     */
    get uploadToken() {
        return this[PRIVATE].uploadToken;
    }
}

module.exports = {
    AssetMultipart
};