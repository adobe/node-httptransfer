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

const DRange = require("drange");
const PRIVATE = Symbol("PRIVATE");
const { calculatePartSize, splitParts } = require("../aempartsize");

/**
 * Reflects a unit of content to be transferred, can be a part of or 
 * a complete asset.
 */
class TransferPart {
    /**
     * Construct a transfer record
     * 
     * @param {Asset} source Source asset
     * @param {Asset} target Target asset
     * 
     * @also
     * 
     * @param {TransferPart} base Base transfer record
     * @param {URL[]} targetUrls Target urls for this record
     * @param {DRange} contentRange Range for this record
     */
    constructor(source, target, contentRange) {
        if (source instanceof TransferPart) {
            const base = source;
            const targetUrls = target;
            this[PRIVATE] = {
                source: base.source,
                target: base.target,
                targetUrls,
                metadata: base.metadata,
                contentRange,
                acceptRanges: base.acceptRanges,
                version: base.version,
                completeUrl: base.completeUrl,
                uploadToken: base.uploadToken
            };
        } else {
            this[PRIVATE] = {
                source,
                target,
                acceptRanges: false
            };
        }
    }

    /**
     * Source asset
     * 
     * @returns {Asset} Source asset, or undefined
     */
    get source() {
        return this[PRIVATE].source;
    }

    /**
     * Target asset 
     * 
     * @returns {Asset} Target asset, or undefined
     */
    get target() {
        return this[PRIVATE].target;
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
     * Asset metadata
     * 
     * @returns {AssetMetadata} Asset metadata
     */
    get metadata() {
        return this[PRIVATE].metadata;
    }

    /**
     * Asset metadata
     * 
     * @param {AssetMetadata} Asset metadata
     */
    set metadata(metadata) {
        this[PRIVATE].metadata = metadata;
    }

    /**
     * Content range reflected in this transfer record, defaults to complete asset if no 
     * range is defined and the asset metadata is provided.
     * 
     * Note that the range is inclusive, meaning that the high-end of the range is included.
     * 
     * @returns {DRange} Content range in bytes
     */
    get contentRange() {
        if (this[PRIVATE].contentRange) {
            return this[PRIVATE].contentRange;
        } else if (this[PRIVATE].metadata) {
            const { contentLength } = this[PRIVATE].metadata;
            return new DRange(0, contentLength - 1);
        } else {
            return undefined;
        }
    }
    
    /**
     * Check if (read) byte range requests are supported
     * 
     * @returns {Boolean} True if byte range requests are supported 
     */
    get acceptRanges() {
        return this[PRIVATE].acceptRanges;
    }

    /**
     * Check if (read) range requests are supported
     * 
     * @param {Boolean} acceptRanges True if byte range requests are supported
     */
    set acceptRanges(acceptRanges) {
        this[PRIVATE].acceptRanges = acceptRanges;
    }

    /**
     * Asset version
     * 
     * @returns {AssetVersion} Asset version
     */
    get version() {
        return this[PRIVATE].version;
    }

    /**
     * Asset version
     * 
     * @param {AssetVersion} version Asset version
     */
    set version(version) {
        this[PRIVATE].version = version;
    }

    /**
     * Completion URL after upload has finished
     * 
     * @returns {URL} Complete URL
     */
    get completeUrl() {
        return this[PRIVATE].completeUrl;
    }

    /**
     * Completion URL after upload has finished
     * 
     * @param {URL} completeUrl Complete URL
     */
    set completeUrl(completeUrl) {
        this[PRIVATE].completeUrl = completeUrl;
    }

    /**
     * Upload token used by AEM complete upload
     * 
     * @returns {String} Upload token
     */
    get uploadToken() {
        return this[PRIVATE].uploadToken;
    }

    /**
     * Upload token used by AEM complete upload
     * 
     * @param {String} uploadToken Upload token
     */
    set uploadToken(uploadToken) {
        this[PRIVATE].uploadToken = uploadToken;
    }

    /**
     * Split transfer record in to smaller parts if possible
     * 
     * @generator
     * @param {String[]} targetUrls Target URLs
     * @param {Number} minPartSize Minimum part size
     * @param {Number} maxPartSize Maximum part size
     * @param {Number} preferredPartSize Preferred part size
     * @yield {TransferPart} Smaller transfer records
     */
    *split(targetUrls, minPartSize, maxPartSize, preferredPartSize) {
        if (this.acceptRanges) {
            const partSize = calculatePartSize(targetUrls.length, this.metadata.contentLength, maxPartSize, {
                minPartSize,
                preferredPartSize
            });
            for (const { url, range } of splitParts(targetUrls, this.metadata.contentLength, partSize)) {
                yield new TransferPart(this, [url], range);
            }    
        } else {
            yield new TransferPart(this, targetUrls, this.contentRange);
        }
    }

    /**
     * String representation of transfer record
     * 
     * @returns {String} String representation of transfer record
     */
    toString() {
        return JSON.stringify({
            source: {
                url: this.source.url,
                title: this.source.title,
                headers: this.source.headers
            },
            target: {
                url: this.target.url,
                title: this.target.title,
                headers: this.target.headers                
            },
            targetUrl: this.targetUrls,
            metadata: this.metadata && {
                filename: this.metadata.filename,
                contentType: this.metadata.contentType,
                contentLength: this.metadata.contentLength
            },
            contentRange: this.contentRange,
            acceptRanges: this.acceptRanges,
            version: this.version && {
                lastModified: this.version.lastModified,
                etag: this.version.etag
            },
            uploadToken: this.uploadToken
        });        
    }
}

module.exports = {
    TransferPart: TransferPart
};
