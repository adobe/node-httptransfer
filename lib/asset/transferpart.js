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
 * Part of content intended to be transferred
 */
class TransferPart {
    /**
     * Construct a transfer part
     * 
     * @param {Part} [source] Source reference
     * @param {Part} [target] Target reference
     * @param {Buffer} [buffer] Contents of the part
     */
    constructor(source, target, buffer) {
        this[PRIVATE] = {
            source,
            target,
            buffer
        };
    }

    /**
     * Source reference
     * 
     * @returns {Part} Source reference, or undefined
     */
    get source() {
        return this[PRIVATE].source;
    }

    /**
     * Target reference
     * 
     * @returns {Part} Target reference, or undefined
     */
    get target() {
        return this[PRIVATE].target;
    }

    /**
     * Part content
     * 
     * @returns {Buffer} Part content, or undefined
     */
    get buffer() {
        return this[PRIVATE].buffer;
    }

    /**
     * Length of the part in bytes
     * 
     * @returns {Number} Length of the part in bytes, or undefined if no length can be found
     */
    get length() {
        const { source, target, buffer } = this[PRIVATE];
        if (buffer) {
            return buffer.length;
        } else if (source) {
            return source.length;
        } else if (target) {
            return target.length;
        } else {
            return undefined;
        }
    }
}


module.exports = {
    TransferPart
};
