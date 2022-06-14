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

const MAX_BUFFER_SIZE = require('buffer').constants.MAX_LENGTH;
const MAX_PERCENTAGE_ALLOWED_MEMORY_USE = 0.8; // 80%
const DEFAULT_TRANSFER_BUFFER_POOL_SIZE = 100 * 1024 * 1024; // 100 Mb
const BUFFER_POOL_ALLLOC_START_INDEX = 0; // "lowest" buffer pool index (buffer block address)


const ALLOCATION_PROMISE_INTERNAL = Symbol("allocationinternal");
/**
 * Represents a promise to get an allocated memory block 
 * used as buffer for a file transfer
 */
class DeferredTransferMemoryBlockAllocation {
    constructor(requestedMemoryBufferBlockSize) {
        this[ALLOCATION_PROMISE_INTERNAL] = {};

        this[ALLOCATION_PROMISE_INTERNAL].requestedSize = requestedMemoryBufferBlockSize;
        this[ALLOCATION_PROMISE_INTERNAL].allocationPromise = null;
    }

    /**
     * Get the requested buffer (memory) size
     */
    get requestedSize() {
        return this[ALLOCATION_PROMISE_INTERNAL].requestedSize;
    }

    /**
     * Promises a future memory allocation from the buffer pool
     * @returns {Promise} Promise of a future allocation, which will resolve when enough 
     * memory is available to allocate the needed memory blocks from the buffer pool
     */
    async promiseTransferMemoryBlockAllocation() {
        const self = this;
        return new Promise(function (resolve, reject) {
            self.resolve = resolve;
            self.reject = reject;
        });
    }

    /**
     * Resolves the deferred allocation by returning a buffer memory block having the 
     * size requested by the allocation
     * @param {*} bufferMemoryBlock buffer memory block which has been allocated 
     * for use once the deferred allocation resolves
     */
    resolve(bufferMemoryBlock) { //  eslint-disable-line no-unused-vars
        /* 
        Will be overwritten to keep reference to the promise's resolve function
        from the `promiseTransferMemoryBlockAllocation` call
        */
    }

    /**
     * Rejects the deferred allocation
     * @param {*} value value used to reject the promise
     */
    reject(value) { //  eslint-disable-line no-unused-vars
        /* 
        Will be overwritten to keep reference to the promise's reject function
        from the `promiseTransferMemoryBlockAllocation` call
        */
    }
}

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

        if (referencedMemoryFromBufferPool && size !== referencedMemoryFromBufferPool.length) {
            throw new Error(`Requested buffer memory block size mismatch. Could not allocate Transfer Memory Block (requested: ${size}, allocated: ${referencedMemoryFromBufferPool.length})`);
        }
        this[INTERNAL].referencedMemoryFromBufferPool = referencedMemoryFromBufferPool;
    }

    /**
     * Get the buffer size (size of allocated memory block)
     * @returns {Integer} Size of the allocated buffer (memory block) 
     */
    get size() {
        return this[INTERNAL].size;
    }

    /**
     * Set the memory block size. Used by Transfer Memory Block allocator
     * @param {Integer} value Size of allocated memory block
     */
    set size(value) {
        this[INTERNAL].size = value;
    }

    /**
     * Get the start index from the buffer pool (lowest index/memory
     * location usable for this Transfer Memory Block)
     * @returns {Integer} Start index of the allocated buffer 
     * (memory block) in the buffer pool
     */
    get startIndex() {
        return this[INTERNAL].bufferPoolStartIndex;
    }

    /**
     * the start index from the buffer pool (lowest index/memory
     * location usable for this Transfer Memory Block). 
     * Used by Transfer Memory Block allocator.
     * -1 means `unallocated` (or `deallocated`)
     * @param {Integer} value Start index in buffer pool
     */
    set startIndex(value) {
        this[INTERNAL].bufferPoolStartIndex = value;
    }

    /**
     * Get the end index from the buffer pool (highest index/memory
     * location usable for this Transfer Memory Block)
     * @returns {Integer} End index of the allocated buffer 
     * (memory block) in the buffer pool
     */
    get endIndex() {
        return this.startIndex + this.size - 1;
    }

    /**
     * Get the buffer representing the memory block from the pooled
     * buffer allocated for this Transfer Memory Block.
     * Modifying this memory block (buffer slice) will modify the memory 
     * in the original Buffer because the allocated memory of this memory block 
     * and the original buffer pool overlap.
     */
    get buffer() {
        return this[INTERNAL].referencedMemoryFromBufferPool;
    }

    /**
     * Set the buffer to use for memory access. 
     * Used by Transfer Memory Block allocator
     * @param {Buffer} value Buffer to use for memory access 
     */
    set buffer(value) {
        return this[INTERNAL].referencedMemoryFromBufferPool = value;
    }
}

// ------------------------------------------------------------------------------
const PRIVATE = Symbol("private");
/**
 * Keeps track of memory usable for transfers, and allocates available 
 * memory as needed/when requested by transfers
 */
class TransferMemoryBuffer {
    /**
     * Constructs a transfer memory buffer
     * @param {*} suggestedSize Suggested size for the memory reserved 
     * for buffering transfer data, in bytes. The memory allocator will
     * try to allocate memory with size `suggestedSize`, but if not 
     * enough memory is available, 80% of available memory will be 
     * allocated instead
     */
    constructor(suggestedSize) {
        this[PRIVATE] = {};

        let bufferSize;
        if (suggestedSize) {
            console.log(`Suggested Transfer Memory Buffer pool size is ${suggestedSize} bytes`);
            bufferSize = parseInt(suggestedSize, 10);
        } else {
            console.log(`Using default size for Transfer Memory Buffer: ${DEFAULT_TRANSFER_BUFFER_POOL_SIZE} bytes`);
            bufferSize = DEFAULT_TRANSFER_BUFFER_POOL_SIZE;
        }

        // if (!bufferSize || !Number.isInteger(bufferSize)) {
        //     throw new Error("Suggested Transfer Memory Buffer toal suggested size must be an integer");
        // }
        if (bufferSize <= 0) {
            throw new Error("Transfer Memory Buffer total suggested size must be larger than 0");
        }

        const availableFreeMemory = os.freemem();
        const highMemoryMark = Math.floor(availableFreeMemory * MAX_PERCENTAGE_ALLOWED_MEMORY_USE);
        if (bufferSize > highMemoryMark) {
            // use 80% of available memory
            this[PRIVATE].totalSize = Math.min(highMemoryMark, MAX_BUFFER_SIZE);
            console.log(`Not enough memory available (${availableFreeMemory} bytes available, ${bufferSize} bytes requested) to use suggested size for Transfer Memory Buffer pool size. Using ${MAX_PERCENTAGE_ALLOWED_MEMORY_USE * 100}% of available memory instead: ${this[PRIVATE].totalSize} bytes as Transfer Memory Buffer pool size`);
        } else {
            console.log(`Using suggested size of ${bufferSize} bytes for Transfer Memory Buffer pool size`);
            this[PRIVATE].totalSize = Math.min(bufferSize, MAX_BUFFER_SIZE);
        }
        this[PRIVATE].availablePooledBufferSize = this[PRIVATE].totalSize;

        // create buffer that will be used as buffer pool
        this[PRIVATE].pooledBuffer = Buffer.allocUnsafe(this[PRIVATE].totalSize);
        this[PRIVATE].minIndex = BUFFER_POOL_ALLLOC_START_INDEX;
        this[PRIVATE].maxIndex = BUFFER_POOL_ALLLOC_START_INDEX + this[PRIVATE].totalSize - 1;

        // create list to keep track of allocated buffer blocks from the larger buffer `pooledBuffer`
        this[PRIVATE].allocatedBlocks = yallist.create([]);

        // allocations waiting for enough memory to be available
        this[PRIVATE].pendingAllocations = yallist.create([]);
    }

    get allocatedBlocks() {
        // TODO: Investigate performance hits and evaluate using a different data structure
        return this[PRIVATE].allocatedBlocks;
    }

    /**
     * Returns the total size of memory usable for transfers
     * (total = used + available memory)
     */
    get poolSize() {
        return this[PRIVATE].pooledBuffer.length;
    }

    /**
     * Returns the total size of memory usable for transfers
     * (total = used + available memory)
     */
    get availablePoolSize() {
        return this[PRIVATE].availablePooledBufferSize;
    }

    /**
     * Gets a buffer from the pooled Transfer Memory Buffer
     * reserved for a transfer. The returned buffer is a slice
     * of the pooled buffer. 
     * The reserved buffer slice must be released/returned to the 
     * pooled buffer explicitly once done with its use for a transfer
     * @param {Integer} bufferSize size, in bytes, needed for the buffer
     */
    async obtainBuffer(bufferSize) {
        if (!bufferSize || bufferSize <= 0) {
            throw new Error("Requested buffer size must be larger than 0");
        }

        if (bufferSize > this[PRIVATE].totalSize) {
            throw new Error(`Requested ${bufferSize} bytes for transfer part, which is larger than max available memory of ${this[PRIVATE].totalSize} bytes for transfers`);
        }

        let bufferBlock;
        if (bufferSize > this[PRIVATE].availablePooledBufferSize) {
            const allocationPromise = new DeferredTransferMemoryBlockAllocation(bufferSize);
            this[PRIVATE].pendingAllocations.push(allocationPromise);
            bufferBlock = allocationPromise.promiseTransferMemoryBlockAllocation();
        } else {
            bufferBlock = this.findNextAvailableBufferBlock(bufferSize);
            if (bufferBlock === null) {
                // not enough contiguous memory available, defer allocation
                const allocationPromise = new DeferredTransferMemoryBlockAllocation(bufferSize);
                this[PRIVATE].pendingAllocations.push(allocationPromise);
                bufferBlock = allocationPromise.promiseTransferMemoryBlockAllocation();
            }
        }

        if (bufferBlock && bufferBlock.size && Number.isInteger(bufferBlock.size)) {
            this[PRIVATE].availablePooledBufferSize -= bufferBlock.size;
        }

        return bufferBlock;
    }

    /**
     * Looks for a contiguous memory space with enough space to allocate a
     * transfer memory block from the pooled buffer (looks for a memory block with
     * the lowest buffer index possible)
     * @param {Integer} bufferSize Size needed for the memory block
     * @returns An available buffer transfer memory block
     */
    findNextAvailableBufferBlock(bufferSize) {
        let foundBufferBlock = null;

        if (this[PRIVATE].allocatedBlocks.length === 0) {
            // no block allocated yet, allocating first one
            const allocatedBufferBlock = this[PRIVATE].pooledBuffer.subarray(
                BUFFER_POOL_ALLLOC_START_INDEX,
                BUFFER_POOL_ALLLOC_START_INDEX + bufferSize
            );
            foundBufferBlock = new TransferMemoryBlock(bufferSize, BUFFER_POOL_ALLLOC_START_INDEX, allocatedBufferBlock);
            this[PRIVATE].allocatedBlocks.push(foundBufferBlock);
        } else {
            let currentNode = this[PRIVATE].allocatedBlocks.head;
            while (foundBufferBlock === null && currentNode !== null) {

                const nextNode = currentNode.next;
                if (nextNode === null) {
                    // no next node, end of list: 
                    // 2 options: 
                    // - either available space is at the end of the list
                    // - or available space is at the very beginning of the list 
                    const nodeMemoryBlockData = currentNode.value;
                    const candidateBufferBlockIndex = nodeMemoryBlockData.endIndex + 1;

                    let bufferBlockStartIndex;
                    let allocatedBufferBlock;

                    if (candidateBufferBlockIndex > this[PRIVATE].maxIndex) {
                        // need to allocate at beginning of list
                        bufferBlockStartIndex = this[PRIVATE].minIndex;
                        const candidateEndIndex = bufferBlockStartIndex + bufferSize - 1;

                        const currentAllocatedBlockHead = this[PRIVATE].allocatedBlocks.head;
                        if (candidateEndIndex < currentAllocatedBlockHead.value.startIndex) {
                            allocatedBufferBlock = this[PRIVATE].pooledBuffer.subarray(
                                bufferBlockStartIndex,
                                bufferBlockStartIndex + bufferSize
                            );
                        }

                        if (allocatedBufferBlock && allocatedBufferBlock.length === bufferSize) {
                            foundBufferBlock = new TransferMemoryBlock(bufferSize, bufferBlockStartIndex, allocatedBufferBlock);
                            this[PRIVATE].allocatedBlocks.unshift(foundBufferBlock);
                        }
                    } else {
                        // new end node
                        bufferBlockStartIndex = nodeMemoryBlockData.endIndex + 1;
                        allocatedBufferBlock = this[PRIVATE].pooledBuffer.subarray(
                            bufferBlockStartIndex,
                            bufferBlockStartIndex + bufferSize
                        );

                        if (allocatedBufferBlock && allocatedBufferBlock.length === bufferSize) {
                            foundBufferBlock = new TransferMemoryBlock(bufferSize, bufferBlockStartIndex, allocatedBufferBlock);
                            this[PRIVATE].allocatedBlocks.push(foundBufferBlock);
                        }
                    }
                } else {
                    const currentNodeEndIndex = currentNode.value.endIndex;
                    const nextNodeStartIndex = nextNode.value.startIndex;
                    if (nextNodeStartIndex > (currentNodeEndIndex + 1)) {
                        // memory not contiguous, check if requested size can fit here
                        const availableSpace = nextNodeStartIndex - (currentNodeEndIndex + 1);
                        if (bufferSize <= availableSpace) {
                            const bufferBlockStartIndex = currentNodeEndIndex + 1; /* smallest possible next available index (lowest memory start value) */
                            const allocatedBufferBlock = this[PRIVATE].pooledBuffer.subarray(
                                bufferBlockStartIndex,
                                bufferBlockStartIndex + bufferSize
                            );

                            foundBufferBlock = new TransferMemoryBlock(bufferSize, bufferBlockStartIndex, allocatedBufferBlock);

                            // add node into linked list, to keep order
                            const newNode = new yallist.Node();
                            newNode.value = foundBufferBlock;

                            currentNode.next = newNode;
                            newNode.next = nextNode;

                            nextNode.prev = newNode;
                            newNode.prev = currentNode;

                            newNode.list = this[PRIVATE].allocatedBlocks;
                            ++this[PRIVATE].allocatedBlocks.length;
                        }
                    }
                }

                // continue searching
                currentNode = nextNode;
            }
        }

        return foundBufferBlock;
    }

    /**
     * Attempts to remove an element from the pending allocations,
     * if possible
     */
    maybeAllocateFromPendingAllocations() {
        if (this[PRIVATE].pendingAllocations.length <= 0) {
            return;
        }

        let possibleNextAllocation = this[PRIVATE].pendingAllocations.head;
        let nextAllocation = null;
        let bufferMemoryBlock;

        while (possibleNextAllocation !== null &&
            this[PRIVATE].availablePooledBufferSize > 0) {
            const allocationRequest = possibleNextAllocation.value;

            if (allocationRequest.requestedSize <= this[PRIVATE].availablePooledBufferSize) {
                // trying to obtain a buffer block for that allocation
                bufferMemoryBlock = this.findNextAvailableBufferBlock(allocationRequest.requestedSize);
                if (bufferMemoryBlock) { // could allocate, can stop going through list
                    nextAllocation = possibleNextAllocation;

                    const resolvedAllocation = possibleNextAllocation.value;

                    possibleNextAllocation = possibleNextAllocation.next;
                    this[PRIVATE].pendingAllocations.removeNode(nextAllocation);

                    this[PRIVATE].availablePooledBufferSize -= bufferMemoryBlock.size;
                    resolvedAllocation.resolve(bufferMemoryBlock);
                } else {
                    possibleNextAllocation = possibleNextAllocation.next;
                }
            } else {
                possibleNextAllocation = possibleNextAllocation.next;
            }
        }
    }

    /**
     * Releases a buffer back to the pooled Transfer Memory Buffer
     * @param {TransferMemoryBlock} allocatedBufferBlock buffer memory block to release
     */
    releaseBuffer(allocatedBufferBlock) {
        if (!allocatedBufferBlock
            || !allocatedBufferBlock.buffer
            || !Buffer.isBuffer(allocatedBufferBlock.buffer)
            || allocatedBufferBlock.size < 0
            || allocatedBufferBlock.startIndex < 0) {
            return;
        }

        let releasedSize = 0;
        let blockToRelease = null;
        if (this[PRIVATE].allocatedBlocks.length === 1) {
            // only one block allocated, no need to search in the list
            blockToRelease = this[PRIVATE].allocatedBlocks.pop();
            releasedSize = blockToRelease.size;
        } else {
            // search block in list and release it
            let currentNode = this[PRIVATE].allocatedBlocks.head;
            while (blockToRelease === null && currentNode !== null) {
                const nextNode = currentNode.next;
                const currentNodeValue = currentNode.value;

                if (currentNodeValue.size === allocatedBufferBlock.size
                    && currentNodeValue.startIndex === allocatedBufferBlock.startIndex
                    && currentNodeValue.endIndex === allocatedBufferBlock.endIndex
                    && !currentNodeValue.released) {
                    // found block to release
                    blockToRelease = currentNode;
                } else {
                    // continue searching for block to release
                    currentNode = nextNode;
                }
            }
            if (blockToRelease) {
                // release allocated memory buffer block
                releasedSize = blockToRelease.value.size;
                this[PRIVATE].allocatedBlocks.removeNode(blockToRelease);
            }
        }

        if (blockToRelease) {
            // make sure any direct reference to previously held memory is lost
            if (allocatedBufferBlock) {
                allocatedBufferBlock.size = 0;
                allocatedBufferBlock.startIndex = -1;
                allocatedBufferBlock.buffer = null;
            }

            if (releasedSize <= 0) {
                console.log(`A transfer memory block was released, but no actual memory was released: size of block was (${releasedSize}) bytes`);
            } else {
                this[PRIVATE].availablePooledBufferSize += releasedSize;
                this.maybeAllocateFromPendingAllocations();
            }
        }
    }

    /**
     * Dumps information about currently used buffer memory blocks
     * into an array of memory block objects
     */
    dumpBufferBlockUsedMemory() {
        let currentNode = this[PRIVATE].allocatedBlocks.head;

        const bufferBlockMemoryArray = [];

        while (currentNode !== null) {
            const nextNode = currentNode.next;
            const currentNodeData = currentNode.value;

            bufferBlockMemoryArray.push(
                {
                    memoryBlockSize: currentNodeData.size,
                    memoryBlockStartIndex: currentNodeData.startIndex,
                    memoryBlockEndIndex: currentNodeData.endIndex
                }
            );

            // continue searching
            currentNode = nextNode;
        }

        return bufferBlockMemoryArray;
    }

    /**
     * Dumps information about currently waiting allocations
     */
    dumpWaitingAllocations() {
        let currentNode = this[PRIVATE].pendingAllocations.head;

        const waitingAllocations = [];

        while (currentNode !== null) {
            const nextNode = currentNode.next;
            const currentNodeData = currentNode.value;

            waitingAllocations.push(
                {
                    requestedSize: currentNodeData.requestedSize
                }
            );

            currentNode = nextNode;
        }

        return waitingAllocations;
    }
}

module.exports = {
    TransferMemoryBuffer
};