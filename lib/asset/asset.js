
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

const { isHttpOrFileProtocol } = require("../util");
const { AssetMetadata } = require("./assetmetadata");
const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} Headers
 */
/**
 * Describes a source or target asset
 */
class Asset {
    /**
     * Construct a source or target asset
     * 
     * @param {URL|String} uri URI of the asset (http, https, or file)
     * @param {String} [title] Title of the asset
     * @param {Headers} [headers] Headers to send to request or store the asset 
     * @param {AssetMetadata} [metadata] Asset metadata
     */
    constructor(uri, title, headers, metadata) {
        if (!isHttpOrFileProtocol(uri)) {
            throw Error(`folderUri must have a http or https protocol: ${uri}`);
        }
        if (title && (typeof title !== "string")) {
            throw Error(`asset title of invalid type: ${title}`);
        }
        if (metadata && !(metadata instanceof AssetMetadata)) {
            throw Error(`asset metadata is of invalid type: ${metadata}`);
        }
        this[PRIVATE] = {
            uri,
            title,
            headers: Object.assign({}, headers),
            metadata
        };
    }

    /**
     * Asset URI (http, https, file)
     * 
     * @returns {URL|String} Asset URI (http, https, file)
     */
    get uri() {
        return this[PRIVATE].uri;
    }

    /**
     * Asset Title
     * 
     * URIs have restrictions in AEM that prevents some characters from being used
     * in the node name. Use title as a way to communicate the original name without
     * those restrictions.
     * 
     * @returns {String} Asset Title
     */
    get title() {
        return this[PRIVATE].title;
    }

    /**
     * Asset Metadata
     * 
     * @returns {AssetMetadata} Asset Metadata
     */
    get metadata() {
        return this[PRIVATE].metadata;
    }

    /**
     * Change Asset Metadata
     * 
     * @param {AssetMetadata} metadata Asset metadata
     */
    set metadata(metadata) {
        this[PRIVATE].metadata = metadata;
    }

    /**
     * Headers to send to request or store the asset 
     * 
     * @returns {Headers} Headers to send to request or store the asset 
     */
    get headers() {
        return this[PRIVATE].headers;
    }
}

module.exports = {
    Asset
};