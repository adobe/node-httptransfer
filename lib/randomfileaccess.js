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
    console.log(`Opening file ${path}, extend size is ${size} (with flags ${flags})`);

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
        console.log(`Opening file ${path} with flags ${flags} and total write-only length ${totalLength}`);
        fileHandlePromise = openExtendFile(path, flags, totalLength);
        fileHandles.set(path, fileHandlePromise);
    } else {
        console.log(`Reusing existing filehandle promise for file ${path} (requested flags ${flags} and total write-only length ${totalLength})`);
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
                console.log(`Closing file handle for ${path}`);
                fileHandles.delete(path);
                const handle = await fileHandlePromise;
                await handle.close({ silent: true });
            }
        } else {
            console.log("Closing all file handles");
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
        const { fileHandles } = this[PRIVATE];
        const handle = await getOrOpen(fileHandles, path, FileFlags.WRITEONLY, totalSize);
        console.log(`Writing buffer of size ${buffer.length} to file`);
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

        console.log(`Getting file handle for reading file ${path}`);
        const handle = await getOrOpen(fileHandles, path, "r");

        const buffer = Buffer.allocUnsafe(range.length);
        console.log(`Allocating ${range.length} for reading from file ${path}`);

        const { bytesRead } = await handle.read(buffer, 0, range.length, range.low);
        console.log(`Read ${bytesRead} from file ${path}`);
        return buffer.slice(0, bytesRead);
    }
}

module.exports = {
    RandomFileAccess
};