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

const { dirname: urlPathDirname, basename: urlPathBasename } = require("path").posix;

const { Asset } = require("./asset");
const { AssetMetadata } = require("./assetmetadata");
const { AssetMultipart } = require("./assetmultipart");
const { AssetVersion } = require("./assetversion");
const { MIMETYPE } = require("../constants");

const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} TransferAssetOptions
 * @property {AssetMetadata} [metadata] Asset metadata
 * @property {Boolean} [acceptRanges] True if (read) byte range requests are supported
 * @property {AssetVersion} [version] Asset version
 * @property {AssetMultipart} [multipartTarget] Asset multi-part target
 */
/**
 * Reflects a unit of content to be transferred, refers to the complete asset.
 */
class TransferAsset {
    /**
     * Construct a transfer asset
     * 
     * @param {Asset} source Source asset
     * @param {Asset} target Target asset
     * @param {TransferAssetOptions} [options] Transfer asset options
     */
    constructor(source, target, options) {
        if (!(source instanceof Asset)) {
            throw Error(`source is required to be of type Asset: ${source}`);
        }
        if (!(target instanceof Asset)) {
            throw Error(`target is required to be of type Asset: ${target}`);
        }
        if (options && options.metadata && !(options.metadata instanceof AssetMetadata)) {
            throw Error(`metadata is required to be of type AssetMetadata: ${options.metadata}`);
        }
        if (options && options.version && !(options.version instanceof AssetVersion)) {
            throw Error(`version is required to be of type AssetVersion: ${options.version}`);
        }
        if (options && options.multipartTarget && !(options.multipartTarget instanceof AssetMultipart)) {
            throw Error(`multipartTarget is required to be of type AssetMultipart: ${options.multipartTarget}`);
        }
        this[PRIVATE] = {
            source,
            target,
            metadata: options && options.metadata,
            acceptRanges: !!(options && options.acceptRanges),
            version: options && options.version,
            multipartTarget: options && options.multipartTarget
        };
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
        if (!(metadata instanceof AssetMetadata)) {
            throw Error(`metadata is required to be of type AssetMetadata: ${metadata}`);
        }
        this[PRIVATE].metadata = metadata;
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
        this[PRIVATE].acceptRanges = !!acceptRanges;
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
        if (!(version instanceof AssetVersion)) {
            throw Error(`version is required to be of type AssetVersion: ${version}`);
        }
        this[PRIVATE].version = version;
    }

    /**
     * Multi-part target urls
     * 
     * @returns {AssetMultipart} Asset multi-part target
     */
    get multipartTarget() {
        return this[PRIVATE].multipartTarget;
    }

    /**
     * Create a file event information for events sent by the module.
     *
     * @returns {*} File event data.
     */
    get eventData() {
        const data = {
            fileName: decodeURI(urlPathBasename(this.target.url.pathname)),
            fileSize: this.metadata.contentLength,
            targetFolder: decodeURI(urlPathDirname(this.target.url.pathname)),
            targetFile: decodeURI(this.target.url.pathname)
        };

        if (this.metadata.contentType) {
            data.mimeType = this.metadata.contentType || MIMETYPE.APPLICATION_OCTET_STREAM;
        }

        return data;
    }

    /**
     * Multi-part target urls
     * 
     * @param {AssetMultipart} multipart Asset multi-part target
     */
    set multipartTarget(multipart) {
        if (!(multipart instanceof AssetMultipart)) {
            throw Error(`multipartTarget is required to be of type AssetMultipart: ${multipart}`);
        }
        this[PRIVATE].multipartTarget = multipart;
    }

    /**
     * String representation of transfer asset
     * 
     * @returns {String} String representation of transfer asset
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
    TransferAsset
};
