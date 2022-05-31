/*
 * Copyright 2022 Adobe. All rights reserved.
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

console.log('### TMN - WIP:')

const INTERNAL = Symbol("internal");
/**
 * Represents a memory block used as buffer for a file transfer
 */
class TransferMemoryBlock {
    /**
     * Construct a memory block used as buffer for a (file) transfer
     */
    constructor() {
        this[INTERNAL] = {};
    }
}

// ------------------------------------------------------------------------------
const PRIVATE = Symbol("internal");
/**
 * Keeps track of memory usable for transfers, and allocates available 
 * memory as needed/when requested by transfers
 */
class TransferMemoryBuffer {
    /**
     * Constructs a transfer memory buffer
     * @param {*} suggestedSize Suggested size for the memory reserved 
     * for buffering transfer data
     */
    constructor(suggestedSize) {
        this[PRIVATE] = {};
        this[PRIVATE].totalSize = suggestedSize || 100000000;

        this[PRIVATE].pooledBuffer = Buffer.allocUnsafe(this[PRIVATE].totalSize);
        this[PRIVATE].allocatedBlocks = [];
    }

    /**
     * Returns the total size of memory usable for transfers
     * (total = used + available memory)
     */
    get poolSize(){
        return this[PRIVATE].pooledBuffer.length;
    }

    /**
     * Gets a buffer from the pooled Transfer Memory Buffer
     * reserved for a transfer. The returned buffer is a slice
     * of the pooled buffer. 
     * The reserved buffer slice must be released/returned to the 
     * pooled buffer explicitly once done with its use for a transfer
     */
    obtainBuffer(){
    }

    /**
     * Releases a buffer back to the pooled Transfer Memory Buffer
     */
    releaseBuffer(){
    }
}

module.exports = {
    TransferMemoryBlock,
    TransferMemoryBuffer
};