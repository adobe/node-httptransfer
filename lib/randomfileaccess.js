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
const { open } = require("fs").promises;

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
 * Open a file handle in the given mode, grow the file up to the expected target size
 * 
 * @param {String|URL} path File path
 * @param {"r"|"w"} flags Mode to open the file
 * @param {Number} [size] expected size of the file
 * @returns {FileHandle} File handle
 */
async function openFile(path, flags, size) {
    const handle = await open(path, flags);
    try {
        if ((flags === "w") && size) {
            await handle.truncate(size);
        }    
        return { handle, flags, size };
    } catch (err) {
        await handle.close();
        throw err;
    }
}

/**
 * Get the file handle from cache, or open it if it's not already opened.
 * 
 * This is concurrency resilient.
 * 
 * @param {String|URL} path Path of file:// uri
 * @param {String} flags Flags
 * @param {Number} totalLength Total length of the file (write-only)
 * @returns {FileHandle} File handle
 */
async function getOrOpen(fileHandles, path, flags, totalLength) {    
    // store the promises so a concurrent read/write
    // will end up with the same fileHandlePromise
    let fileHandlePromise = fileHandles.get(path);
    if (!fileHandlePromise) {
        fileHandlePromise = openFile(path, flags, totalLength);
        fileHandles.set(path, fileHandlePromise);
    }

    // acquire the file handle
    const result = await fileHandlePromise;
    if (result.flags !== flags) {
        throw Error(`${path}: Attempt to open with "${flags}" flags, previously opened with "${result.flags} flags`);
    }
    return result.handle;
}

/**
 * Closes a file silently
 * 
 * @param {String|URL} path File path
 * @param {Promise} fileHandlePromise File handle promise
 */
async function closeFile(path, fileHandlePromise) {
    try {
        const { handle } = await fileHandlePromise;
        await handle.close();    
    } catch (err) {
        console.error(`Unable to close file handle of ${path}`, err);
    }
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
    constructor() {
        this[PRIVATE] = {
            fileHandles: new Map()
        };
    }

    /**
     * Close the given file
     * 
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
                await closeFile(path, fileHandlePromise);
            }    
        } else {
            const closingFileHandles = this[PRIVATE].fileHandles;
            this[PRIVATE].fileHandles = new Map();
            for (const [path, fileHandlePromise] of closingFileHandles) {
                await closeFile(path, fileHandlePromise);
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
        const { fileHandles } = this[PRIVATE];
        const handle = await getOrOpen(fileHandles, path, "w", totalSize);
        return handle.write(buffer, 0, buffer.length, range.low);
    }

    /**
     * Read a section of a file
     * 
     * @param {String|URL} path Path of the file to read from
     * @param {SubRange} range Range of bytes to read
     * @returns {Buffer} Buffer of bytes read
     */
    async read(path, range) {
        const { fileHandles } = this[PRIVATE];
        const handle = await getOrOpen(fileHandles, path, "r");
        const buffer = Buffer.allocUnsafe(range.length);
        const { bytesRead } = await handle.read(buffer, 0, range.length, range.low);
        return buffer.slice(0, bytesRead);
    }
}

module.exports = {
    RandomFileAccess
};