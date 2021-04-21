
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
const path = require("path");
const PRIVATE = Symbol("PRIVATE");

/**
 * Describes a target AEM asset
 */
class AEMAsset {
    /**
     * Construct a target AEM asset
     * 
     * @param {URL} folderUri URI of the folder where the AEM asset is stored
     * @param {String} filename Name of the filename stored in AEM
     * @param {String} title Title of the filename stored in AEM
     * @param {String} contentType Content type of the asset
     * @param {Number} contentLength Content length in bytes
     */
    constructor(folderUri, filename, title, contentType, contentLength) {
        if (!isHttpProtocol(folderUri)) {
            throw Error(`folderUri must have a http or https protocol: ${folderUri}`);
        }
        this[PRIVATE] = {
            folderUri,
            filename,
            title,
            contentType,
            contentLength
        };
    }

    /**
     * Asset URI (https)
     */
    get uri() {
        const url = new URL(this.folderUri);
        url.pathname = path.join(url.pathname, this.filename);
        return url.toString();
    }

    /**
     * Folder URI (https)
     * 
     * @returns {String} Folder URI (https)
     */
    get folderUri() {
        return this[PRIVATE].folderUri;
    }

    /**
     * Filename stored in the AEM
     *
     * @returns {String} Filename that matches the JCR limitations
     */
    get filename() {
        return this[PRIVATE].filename;
    }

    /**
     * Title of the file stored in AEM
     * 
     * @returns {String} Title of the asset (supports any character)
     */
    get title() {
        return this[PRIVATE].title;
    }

    /**
     * Content type
     * 
     * @returns {String} Content type of the asset
     */
    get contentType() {
        return this[PRIVATE].contentType;
    }

    /**
     * Content length in bytes
     * 
     * @returns {Number} Content length in bytes
     */
    get contentLength() {
        return this[PRIVATE].contentLength;
    }
}

module.exports = {
    AEMAsset
};