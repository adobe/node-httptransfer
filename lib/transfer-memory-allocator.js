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

const os = require('os');
const yallist = require('yallist');

const MAX_PERCENTAGE_ALLOWED_MEMORY_USE = 0.8;
const DEFAULT_TRANSFER_BUFFER_POOL_SIZE = 100000000;

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
     * @param {*} suggestedSizeBytes Suggested size for the memory reserved 
     * for buffering transfer data in bytes
     */
    constructor(suggestedSizeBytes) {
        this[PRIVATE] = {};

        let bufferSize;
        if(suggestedSizeBytes){
            console.log(`Suggested Transfer Memory Buffer pool size is ${suggestedSizeBytes} bytes`);
            bufferSize = suggestedSizeBytes;
        } else {
            console.log(`Using default size for Transfer Memory Buffer: ${suggestedSizeBytes} bytes`);
            bufferSize = DEFAULT_TRANSFER_BUFFER_POOL_SIZE;
        }

        const availableFreeMemory = os.freemem();
        if(bufferSize > (availableFreeMemory * MAX_PERCENTAGE_ALLOWED_MEMORY_USE)){
            // use 80% of available memory
            this[PRIVATE].totalSize = Math.floor(availableFreeMemory * MAX_PERCENTAGE_ALLOWED_MEMORY_USE);
            console.log(`Not enough memory available (${availableFreeMemory} bytes available, ${bufferSize} bytes requested) to use suggested size for Transfer Memory Buffer pool size. Using 80% of available memory instead: ${this[PRIVATE].totalSize} bytes as Transfer Memory Buffer pool size`);
        } else {
            console.log(`Using suggested size of ${bufferSize} bytes for Transfer Memory Buffer pool size`);
            this[PRIVATE].totalSize = bufferSize;
        }

        // create buffer that will be used as buffer pool
        this[PRIVATE].pooledBuffer = Buffer.allocUnsafe(this[PRIVATE].totalSize);

        // create list to keep track of allocated buffer blocks from the larger buffer `pooledBuffer`
        this[PRIVATE].allocatedBlocks = yallist.create([]);
    }

    get allocatedBlocks(){
        // TODO: Choose better data structure (but we have to start somewhere, so...)
        return this[PRIVATE].allocatedBlocks;
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
    async obtainBuffer(){
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