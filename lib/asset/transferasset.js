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

const { Asset } = require("./asset");
const { AssetMetadata } = require("./assetmetadata");
const { AssetMultipart } = require("./assetmultipart");
const { AssetVersion } = require("./assetversion");
const { NameConflictPolicy } = require("./nameconflictpolicy");
const { IllegalArgumentError } = require("../error");
const { urlToPath } = require("../util");

const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} TransferAssetOptions
 * @property {AssetMetadata} [metadata] Asset metadata
 * @property {Boolean} [acceptRanges] True if (read) byte range requests are supported (truthy)
 * @property {AssetVersion} [version] Asset version
 * @property {AssetMultipart} [multipartTarget] Asset multi-part target
 * @property {NameConflictPolicy} [nameConflictPolicy] Name conflict policy, defaults to {@link NameConflictPolicy#defaultPolicy}
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
            throw new IllegalArgumentError("'source' must be of type Asset", source);
        }
        if (!(target instanceof Asset)) {
            throw new IllegalArgumentError("'target' must be of type Asset", target);
        }
        if (options && options.metadata && !(options.metadata instanceof AssetMetadata)) {
            throw new IllegalArgumentError("'metadata' must be of type AssetMetadata", options.metadata);
        }
        if (options && options.version && !(options.version instanceof AssetVersion)) {
            throw new IllegalArgumentError("'version' must be of type AssetVersion", options.version);
        }
        if (options && options.multipartTarget && !(options.multipartTarget instanceof AssetMultipart)) {
            throw new IllegalArgumentError("'multipartTarget' must be of type AssetMultipart", options.multipartTarget);
        }
        if (options && options.nameConflictPolicy && !(options.nameConflictPolicy instanceof NameConflictPolicy)) {
            throw new IllegalArgumentError("'nameConflictPolicy' must be of type NameConflictPolicy", options.nameConflictPolicy);
        }
        this[PRIVATE] = {
            source,
            target,
            metadata: options && options.metadata,
            acceptRanges: !!(options && options.acceptRanges),
            version: options && options.version,
            multipartTarget: options && options.multipartTarget,
            nameConflictPolicy: (options && options.nameConflictPolicy) || NameConflictPolicy.defaultPolicy()
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
            throw new IllegalArgumentError("'metadata' must be of type AssetMetadata", metadata);
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
            throw new IllegalArgumentError("'version' must be of type AssetVersion", version);
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
     * Multi-part target urls
     * 
     * @param {AssetMultipart} multipart Asset multi-part target
     */
    set multipartTarget(multipart) {
        if (!(multipart instanceof AssetMultipart)) {
            throw new IllegalArgumentError("'multipartTarget' must be of type AssetMultipart", multipart);
        }
        this[PRIVATE].multipartTarget = multipart;
    }

    /**
     * Name conflict policy
     * 
     * @returns {NameConflictPolicy} Name conflict policy
     */
    get nameConflictPolicy() {
        return this[PRIVATE].nameConflictPolicy;
    }

    /**
     * Name conflict policy
     * 
     * @param {NameConflictPolicy} conflictPolicy Name conflict policy
     */
    set nameConflictPolicy(conflictPolicy) {
        if (!(conflictPolicy instanceof NameConflictPolicy)) {
            throw new IllegalArgumentError("'nameConflictPolicy' must be of type NameConflictPolicy", conflictPolicy);
        }
        this[PRIVATE].nameConflictPolicy = conflictPolicy;
    }

    /**
     * Create a file event information for events sent by the module.
     *
     * @returns {*} File event data.
     */
    get eventData() {
        const sourcePath = urlToPath(this.source.url);
        const targetPath = urlToPath(this.target.url);
        const data = {
            fileName: targetPath.name,
            fileSize: this.metadata && this.metadata.contentLength,
            targetFolder: targetPath.parentPath,
            targetFile: targetPath.path,
            sourceFolder: sourcePath.parentPath,
            sourceFile: sourcePath.path,
        };

        if (this.metadata && this.metadata.contentType) {
            data.mimeType = this.metadata.contentType;
        }

        return data;
    }

    /**
     * Retrieves the timestamp of when the asset started transferring. Will be 0 if no
     * start time is available.
     *
     * @returns {number} Timestamp.
     */
    get transferStartTime() {
        const { transferStart = 0 } = this[PRIVATE];
        return transferStart;
    }

    /**
     * Sets the timestamp of when the asset started transferring.
     *
     * @param {number} startTime Timestamp.
     */
    set transferStartTime(startTime) {
        this[PRIVATE].transferStart = startTime;
    }

    /**
     * Retrieves the timestamp of when the asset finished transferring. Will be 0 if no
     * end time is available.
     *
     * @returns {number} Timestamp.
     */
    get transferEndTime() {
        const { transferEnd = 0 } = this[PRIVATE];
        return transferEnd;
    }

    /**
     * Sets the timestamp of when the asset finished transferring.
     *
     * @param {number} startTime Timestamp.
     */
    set transferEndTime(endTime) {
        this[PRIVATE].transferEnd = endTime;
    }

    /**
     * Retrieves the total amount of time, in milliseconds, that it took for all
     * the asset's parts to transfer. Will be 0 if duration information is not
     * available.
     *
     * @returns {number} Time span in milliseconds.
     */
    get uploadDuration() {
        const { transferStartTime, transferEndTime } = this;
        if (transferStartTime && transferEndTime) {
            return transferEndTime - transferStartTime;
        }
        return 0;
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
                headers: this.source.headers
            },
            target: {
                url: this.target.url,
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
