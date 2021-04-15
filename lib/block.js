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

const { Source } = require("./source");

const PRIVATE = Symbol("PRIVATE");

/**
 * Block of content intended to be uploaded, downloaded, or transferred.
 */
class Block {
    /**
     * Construct a block
     * 
     * @param {BlockSource} [source] Source of the block
     * @param {BlockTarget} [target] Target of the block
     * @param {Buffer} [buffer] Contents of the block
     */
    constructor(source, target, buffer) {
        this[PRIVATE] = {
            source,
            target,
            buffer
        };
    }

    /**
     * @returns {BlockSource} Source of the block
     */
    get source() {
        return this[PRIVATE].source;
    }

    /**
     * @returns {BlockTarget} Target of the block
     */
    get target() {
        return this[PRIVATE].target;
    }

    /**
     * @returns {Buffer} Content of the block
     */
    get buffer() {
        return this[PRIVATE].buffer;
    }

    /**
     * @returns {Number} Length of the block (bytes), or undefined if it only defines a target
     */
    get length() {
        const { source, buffer } = this[PRIVATE];
        if (buffer) {
            return buffer.length;
        } else if (source) {
            return source.length;
        } else {
            return undefined;
        }
    }
}

/**
 * Create a block that has been or intended to be read
 * 
 * @param {Source} source Source of the block
 * @param {Buffer} [buffer] Optional buffer of downloaded content
 * @returns Block that has been or intended to be read
 */
function createSourceBlock(source, buffer) {
    return new Block(source, undefined, buffer);
}

/**
 * Create a block that is intended to be written
 * 
 * @param {Target} target Target of the block
 * @param {Buffer} [buffer] Optional buffer of content
 * @returns Block that is intended to be written
 */
function createTargetBlock(target, buffer) {
    return new Block(undefined, target, buffer);
}

/**
 * Create a block that is intended to be transferred
 * 
 * @param {Source} source Source of the block
 * @param {Target} target Target of the block
 * @param {Buffer} [buffer] Optional buffer of transferred content
 * @returns Block that is intended to be transferred
 */
function createTransferBlock(source, target, buffer) {
    return new Block(source, target, buffer);
}

module.exports = {
    createSourceBlock,
    createTargetBlock,
    createTransferBlock
};
