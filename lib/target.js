
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

const { isSupportedProtocol } = require("./blockio/util");
const PRIVATE = Symbol("PRIVATE");

/**
 * Source of a given block
 */
class Target {
    /**
     * Create a target where a block of bytes will be written to
     * 
     * @param {URL} uri URI where the block will be stored (http, https, file)
     * @param {string} contentType Content type to use when storing the block
     */
    constructor(uri, contentType) {
        if (!isSupportedProtocol(uri)) {
            throw Error(`URI must have a http, https, or file protocol: ${uri}`);
        }    
        this[PRIVATE] = {
            uri,
            contentType
        };
    }

    /**
     * Source URI, can be http/https or file
     */
    get uri() {
        return this[PRIVATE].uri;
    }

    /**
     * Content type to use when storing the block
     */
    get contentType() {
        return this[PRIVATE].contentType;
    }
}

module.exports = {
    Target
};