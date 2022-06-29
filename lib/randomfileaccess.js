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

const PRIVATE = Symbol("PRIVATE");
const { FileHandle, FileFlags } = require("./filehandle");
const { TransferMemoryBuffer } = require("./transfer-memory-allocator");
const { streamToPooledBuffer } = require("./stream-util");

const FILE_ACCESS_DEFAULT_MAX_CONCURRENCY = 3;
const FILE_ACCESS_DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10mb

/**
 * @typedef {Object} WriteResponse
 * @property {Number} bytesWritten the number of bytes written
 * @property {Buffer} buffer the buffer written
 */

/**
 * @typedef {Object} SubRange
 * @property {Number} low Low-end of the range
 * @property {Number} high High-end of the range (included)
 * @property {Number} length Length of the range
 */

/**
 * @typedef {Object} OpenExtendFileResult
 * @property {FileHandle} handle File handle
 * @property {FileFlags} flags Open flags
 */
/**
 * Open a file handle in the given mode, grow the file up to the expected target size
 * 
 * @param {String|URL} path File path
 * @param {FileFlags} flags File open flags
 * @param {Number} [size=0] expected size of the file, only applied when writing
 * @returns {FileHandle} File handle
 */
async function openExtendFile(path, flags, size = 0) {
    const handle = await FileHandle.open(path, flags);
    try {
        if (flags === FileFlags.WRITEONLY) {
            await handle.truncate(size);
        }
        return handle;
    } catch (err) {
        await handle.close({ silent: true });
        throw err;
    }
}

/**
 * Get the file handle from cache, or open it if it's not already opened.
 * 
 * This is concurrency resilient.
 * 
 * @param {String|URL} path Path of file:// uri
 * @param {FileFlags} flags True if the path should be opened as read-only
 * @param {Number} totalLength Total length of the file (write-only)
 * @returns {FileHandle} File handle
 */
async function getOrOpen(fileHandles, path, flags, totalLength) {
    // store the promises so a concurrent read/write
    // will end up with the same fileHandlePromise
    let fileHandlePromise = fileHandles.get(path);
    if (!fileHandlePromise) {
        fileHandlePromise = openExtendFile(path, flags, totalLength);
        fileHandles.set(path, fileHandlePromise);
    }

    // acquire the file handle
    const handle = await fileHandlePromise;
    if (handle.flags !== flags) {
        throw Error(`${path}: Attempt to open with "${flags}" flags, previously opened with "${handle.flags} flags`);
    }
    return handle;
}

/**
 * Random file access 
 * 
 * This class holds the file handles for both "read" (upload) and "write" (download) so 
 * independent {Transfer} function instances can read and write the same file concurrently.
 */
class RandomFileAccess {
    /**
     * Construct Random File Access
     */
    constructor(minMemoryBlockSize, maxConcurrent) {
        this[PRIVATE] = {
            fileHandles: new Map()
        };

        if(!minMemoryBlockSize || minMemoryBlockSize < 0){
            minMemoryBlockSize = FILE_ACCESS_DEFAULT_PART_SIZE;
        }
        if(!maxConcurrent || maxConcurrent < 0){
            maxConcurrent = FILE_ACCESS_DEFAULT_MAX_CONCURRENCY;
        }

        console.log("minMemoryBlockSize: ", minMemoryBlockSize);
        maxConcurrent = 3; 
        console.log("maxConcurrent: (hardcoded)", maxConcurrent);
        this[PRIVATE].bufferMemoryAllocator = new TransferMemoryBuffer(minMemoryBlockSize * maxConcurrent);
    }

    get bufferMemoryAllocator(){
        return this[PRIVATE].bufferMemoryAllocator;
    }

    /**
     * Close the given file
     * If no path is provided, all files will be closed.
     * 
     * @param {String|URL} [path] Path to close
     */
    async close(path) {
        if (path) {
            const { fileHandles } = this[PRIVATE];
            const fileHandlePromise = fileHandles.get(path);
            
            if (fileHandlePromise) {
                fileHandles.delete(path);
                const handle = await fileHandlePromise;
                await handle.close({ silent: true });
            }
        } else {
            const closingFileHandles = this[PRIVATE].fileHandles;
            this[PRIVATE].fileHandles = new Map();
            for (const fileHandlePromise of closingFileHandles.values()) {
                const handle = await fileHandlePromise;
                await handle.close({ silent: true });
            }
        }
    }

    /**
     * Write a section to a file
     * 
     * @param {String|URL} path Path of the file to write to
     * @param {SubRange} range Range of bytes to write
     * @param {Buffer} buffer Buffer of bytes to write
     * @param {Number} totalSize Total size of the file written
     * @returns {WriteResponse} Bytes written and the buffer 
     */
    async write(path, range, buffer, totalSize) {
        if(buffer.buffer && Buffer.isBuffer(buffer.buffer)){
            // for backwards compatibility accept a buffer or a TransferMemoryBlock and get its buffer
            buffer = buffer.buffer;
        }

        const { fileHandles } = this[PRIVATE];
        const handle = await getOrOpen(fileHandles, path, FileFlags.WRITEONLY, totalSize);
        return handle.write(buffer, 0, buffer.length, range.low);
    }

    /**
     * Write an HTTP stream response (block) to a section to a file
     * 
     * @param {String|URL} path Path of the file to write to
     * @param {SubRange} range Range of bytes to write
     * @param {Object} httpStreamData HTTP stream data
     * @param {Number} totalSize Total size of the file written
     * @returns {WriteResponse} Bytes written and the buffer 
     */
    async writeHttpStreamToFile(path, range, httpStreamData, totalSize) {
        const bufferMemoryBlock = await streamToPooledBuffer(httpStreamData.method, httpStreamData.sourceUrl, httpStreamData.responseStatus, httpStreamData.responseBody, httpStreamData.contentLength, this.bufferMemoryAllocator);

        await this.write(path, range, bufferMemoryBlock.buffer, totalSize);

        this.releaseFileBufferMemory(bufferMemoryBlock);
    }

    /**
     * Read a section of a file
     * 
     * @param {String|URL} path Path of the file to read from
     * @param {SubRange} range Range of bytes to read
     * @returns {TransferMemoryBlock} Transfer memory block containing a buffer of bytes read
     */
    async read(path, range) {
        const { fileHandles } = this[PRIVATE];

        const bufferMemoryBlock = await this[PRIVATE].bufferMemoryAllocator.obtainBuffer(range.length);
        const handle = await getOrOpen(fileHandles, path, "r");
        await handle.read(bufferMemoryBlock.buffer, 0, range.length, range.low);
        
        return bufferMemoryBlock;
    }

    /**
     * Releases memory held by a buffer used to read from a file
     * @param {TransferMemoryBlock} bufferMemoryBlock 
     */
    releaseFileBufferMemory(bufferMemoryBlock){
        this[PRIVATE].bufferMemoryAllocator.releaseBuffer(bufferMemoryBlock);
    }
}

module.exports = {
    RandomFileAccess
};