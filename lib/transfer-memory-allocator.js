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
const BUFFER_POOL_ALLLOC_START_INDEX = 0;

console.log('### TMN - WIP:')

const INTERNAL = Symbol("internal");
/**
 * Represents a memory block used as buffer for a file transfer
 */
class TransferMemoryBlock {
    /**
     * Construct a memory block used as buffer for a (file) transfer
     */
    constructor(size, startIndex, referencedMemoryFromBufferPool) {
        this[INTERNAL] = {};

        this[INTERNAL].size = size;
        this[INTERNAL].bufferPoolStartIndex = startIndex;
        this[INTERNAL].referencedMemoryFromBufferPool = referencedMemoryFromBufferPool;
    }

    /**
     * Get the buffer size (size of allocated memory block)
     * @returns {Integer} Size of the allocated buffer (memory block) 
     */
    get size(){
        return this[INTERNAL].size;
    }

    /**
     * Get the start index from the buffer pool (lowest index/memory
     * location usable for this Transfer Memory Block)
     * @returns {Integer} Start index of the allocated buffer 
     * (memory block) in the buffer pool
     */
    get startIndex(){
        return this[INTERNAL].bufferPoolStartIndex;
    }

    /**
     * Get the end index from the buffer pool (highest index/memory
     * location usable for this Transfer Memory Block)
     * @returns {Integer} End index of the allocated buffer 
     * (memory block) in the buffer pool
     */
    get endIndex(){
        return this.startIndex + this.size - 1;
    }

    /**
     * Get the buffer representing the memory block from the pooled
     * buffer allocated for this Transfer Memory Block.
     * Modifying this memory block (buffer slice) will modify the memory 
     * in the original Buffer because the allocated memory of this memory block 
     * and the original buffer pool overlap.
     */
    get buffer(){
        return this[INTERNAL].referencedMemoryFromBufferPool;
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
     * for buffering transfer data, in bytes
     */
    constructor(suggestedSize) {
        this[PRIVATE] = {};

        let bufferSize;
        if(suggestedSize){
            console.log(`Suggested Transfer Memory Buffer pool size is ${suggestedSize} bytes`);
            bufferSize = suggestedSize;
        } else {
            console.log(`Using default size for Transfer Memory Buffer: ${suggestedSize} bytes`);
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
        this[PRIVATE].availablePooledBufferSize = this[PRIVATE].totalSize;

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
     * Returns the total size of memory usable for transfers
     * (total = used + available memory)
     */
    get availablePoolSize(){
        return this[PRIVATE].availablePooledBufferSize;
    }

    /**
     * Gets a buffer from the pooled Transfer Memory Buffer
     * reserved for a transfer. The returned buffer is a slice
     * of the pooled buffer. 
     * The reserved buffer slice must be released/returned to the 
     * pooled buffer explicitly once done with its use for a transfer
     * @param {*} bufferSize size, in bytes, needed for the buffer
     */
    // TMN TODO: Turn async (generator or using events)
    obtainBuffer(bufferSize){
        if(bufferSize > this[PRIVATE].totalSize){
            console.log(`Requested ${bufferSize} bytes for transfer part, which is larger than max available memory of ${this[PRIVATE].totalSize} bytes for transfers`);
            return null; // throw?
        }

        let bufferBlock;
        if(this[PRIVATE].allocatedBlocks.length === 0){
            // no block allocated yet, allocating first one
            const allocatedBufferBlock = this[PRIVATE].pooledBuffer.subarray(
                BUFFER_POOL_ALLLOC_START_INDEX, 
                BUFFER_POOL_ALLLOC_START_INDEX+bufferSize
            );
            bufferBlock = new TransferMemoryBlock(bufferSize, BUFFER_POOL_ALLLOC_START_INDEX, allocatedBufferBlock);
        } else {
            if(bufferSize > this[PRIVATE].availablePooledBufferSize){
                console.log(`Not enough memory available currently to allocate buffer block of size ${bufferSize} bytes (${this[PRIVATE].availablePooledBufferSize} bytes available)`)
            } else {
                bufferBlock = this.findNextAvailableBufferBlock(bufferSize);
            }
        }

        if(bufferBlock){
            this[PRIVATE].availablePooledBufferSize -= bufferBlock.size;
            this[PRIVATE].allocatedBlocks.push(bufferBlock);
        } else {
            console.log("Could not allocate a buffer block");
        }

        return bufferBlock;
    }

    findNextAvailableBufferBlock(bufferSize){
        console.log("### TMN findNextAvailableBufferBlock")
        let foundBufferBlock = null;

        let currentNode = this[PRIVATE].allocatedBlocks.head;
        while(foundBufferBlock === null && currentNode !== null){
            const nextNode = currentNode.next;
            if(nextNode === null){
                // no next node, end of list: create new buffer block after the current Node
                const nodeMemoryBlockData = currentNode.value;
                const bufferBlockStartIndex = nodeMemoryBlockData.endIndex + 1;
                const allocatedBufferBlock = this[PRIVATE].pooledBuffer.subarray(
                    bufferBlockStartIndex, 
                    bufferBlockStartIndex+bufferSize
                );
                foundBufferBlock = new TransferMemoryBlock(bufferSize, bufferBlockStartIndex, allocatedBufferBlock);
            } else {
                const currentNodeEndIndex = currentNode.value.endIndex;
                const nextNodeStartIndex = nextNode.value.startIndex;
                if(nextNodeStartIndex > (currentNodeEndIndex + 1)){
                    // memory not contiguous, check if requested size can fit here
                    console.log("Found possible new memory location");
                    const possibleStartIndex = -1;
                    const availableSize = -1;
                }
            }

            // continue searching
            currentNode = nextNode;
        }

        if(foundBufferBlock === null){
            console.log("No suitable buffer block found in buffer pool");
        }

        return foundBufferBlock;
    }

    /**
     * Dumps information about currently used buffer memory blocks
     * (For debug/test purposes only)
     * ### TMN TO-DO: Remove once done debugging
     */
    dumpBufferBlockUsedMemory(){
        let currentNode = this[PRIVATE].allocatedBlocks.head;
        while(currentNode !== null){
            const nextNode = currentNode.next;
            const currentNodeData = currentNode.value;

            console.log("");
            console.log('************')
            console.log('++++++++++++')
            console.log("Memory block size: ", currentNodeData.size);
            console.log("Memory block buffer start index (included): ", currentNodeData.startIndex);
            console.log("Memory block buffer end index (included): ", currentNodeData.endIndex);
            console.log('++++++++++++')
            console.log('************')
            console.log("");

            // continue searching
            currentNode = nextNode;
        }
    }

    /**
     * Releases a buffer back to the pooled Transfer Memory Buffer
     */
    releaseBuffer(allocatedBufferBlock){
        if(this[PRIVATE].allocatedBlocks.length === 1){
            // only one block allocated, no need to search in the list
            const releasedBlock = this[PRIVATE].allocatedBlocks.pop();
            this[PRIVATE].availablePooledBufferSize += releasedBlock.size;
        } else {
            // search block in list and release it
            console.log(allocatedBufferBlock);
        }
    }
}

module.exports = {
    TransferMemoryBlock,
    TransferMemoryBuffer
};