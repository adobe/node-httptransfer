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

const { open } = require("fs").promises;
const LRU = require("lru-cache");

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
 * Random file access 
 */
class RandomFileAccess {
    constructor(options) {
        this.cache = new LRU();
    }

    async clear() {        
        this.cache.clear();
    }

    /**
     * Close and remove the given file from the cache
     * 
     * @param {String|URL} path 
     */
    async close(path) {
        const p = await this.cache.get(path);
        if (p) {
            this.cache.del(path);
            await p.handle.close();
        }
    }

    /**
     * Write a buffer of bytes to the given file.
     * 
     * @param {String|URL} path Path of the file to write to
     * @param {Number} offset Offset to write at
     * @param {Buffer} buffer Buffer of bytes to write
     * @param {Number} totalLength Total length of the content written
     */
    async write(path, offset, buffer, totalLength) {
        const { handle } = await this._getOrOpen(path, "w", totalLength);
        try {
            await handle.write(buffer, 0, buffer.length, offset);
        } catch (err) {
            this.cache.del(path);
            await handle.close();
            throw err;
        }
    }

    /**
     * @typedef {Object} SubRange
     * @property {Number} low Low-end of the range
     * @property {Number} high High-end of the range (included)
     * @property {Number} length Length of the range
     */
    /**
     * Read a section of a file
     * 
     * @param {String|URL} path Path of the file to read from
     * @param {SubRange} range Range of bytes to read
     * @returns {Buffer} Buffer of bytes read
     */
    async read(path, range) {
        const { handle } = await this._getOrOpen(path, "r");
        try {
            const buffer = Buffer.allocUnsafe(range.length);
            const { bytesRead } = await handle.read(buffer, 0, range.length, range.low);
            return buffer.slice(0, bytesRead);
        } catch (err) {
            this.cache.del(path);
            await handle.close();
            throw err;
        }
    }

    /**
     * Get the file handle from cache, or open it if it's not already opened.
     * 
     * This is concurrent resilient since the cache holds promises, 
     * 
     * @param {String|URL} path Path of file:// uri
     * @param {String} flags Flags
     * @param {Number} totalLength Total length of the file (write-only)
     * @returns 
     */
    async _getOrOpen(path, flags, totalLength) {
        let p = this.cache.get(path);
        if (!p) {
            p = openFile(path, flags, totalLength);
            this.cache.set(path, p);
        }
        const result = await p;
        if (result.flags !== flags) {
            throw Error(`${path}: Attempt to open with "${flags}" flags, previously opened with "${result.flags} flags`);
        }
        return result;
    }
}

module.exports = {
    RandomFileAccess
};