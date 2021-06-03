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

require("core-js/stable");

const fs = require("fs");
const logger = require("./logger");
const { urlToPath } = require("./util");

/**
 * File open flags
 */
const FileFlags = {
    READONLY: "readonly",  // Open for reading, fails if file doesn't exist
    WRITEONLY: "writeonly" // Open for writing, extend the file if size is provided
};

/**
 * Abstraction around the lower-level file descriptor.
 * 
 * This code is intended to support ES2015 through Babel, which is why it
 * is using older APIs.
 */
class FileHandle {
    /**
     * Construct a file handle
     * 
     * Recommend using `FileHandle.open` to open the actual file.
     * 
     * @param {String} path File path
     * @param {FileFlags} flags File flags
     * @param {Number} fd File descriptor
     */
    constructor(path, flags, fd) {
        /**
         * File path
         * @type {String}
         */
        this.path = path;
        /**
         * File open flags
         * @type {FileFlags}
         */
        this.flags = flags;
        /**
         * File descriptor
         */
        this.fd = fd;
    }

    /**
     * Open a file handle
     * 
     * @param {String|URL} path File path, or file:// url
     * @param {FileFlags} flags File flags to open (readonly, writeonly)
     * @returns {FileHandle} file handle
     */
    static async open(path, flags) {
        return new Promise((resolve, reject) => {
            const filePath = urlToPath(path).path;
            const openFlags = (flags === FileFlags.WRITEONLY) ? "w" : "r";
            fs.open(filePath, openFlags, (err, fd) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(new FileHandle(filePath, flags, fd));
                }
            });
        });
    }

    /**
     * Close the file handle
     * 
     * @param {Object} [options] Close options
     * @param {Boolean} [options.silent] If true, any errors are logged instead of thrown
     */
    async close(options) {
        const self = this;
        const silent = options && options.silent;
        return new Promise((resolve, reject) => {
            fs.close(self.fd, err => {
                if (err && silent) {
                    logger.warn(`Unable to close file handle of ${self.path}`, err);
                } else if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Truncate/extend a file to the given length
     * 
     * @param {Number} length New length
     */
    async truncate(length) {
        const self = this;
        return new Promise((resolve, reject) => {
            fs.ftruncate(self.fd, length, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Read data from file
     * 
     * @param {Buffer} buffer Buffer where data will be written to
     * @param {Number} offset Offset in the buffer where to start writing
     * @param {Number} length Number of bytes to read
     * @param {Number} position Position in the file where to begin reading
     * @returns {Numbers} Number of bytes actually read
     */
    async read(buffer, offset, length, position) {
        const self = this;
        return new Promise((resolve, reject) => {
            fs.read(self.fd, buffer, offset, length, position, (err, bytesRead) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(bytesRead);
                }
            });
        });
    }

    /**
     * Write data to file
     * 
     * @param {Buffer} buffer Buffer where data will be read from
     * @param {Number} offset Offset in the buffer where to start reading
     * @param {Number} length Number of bytes to write
     * @param {Number} position Position in the file where to begin writing
     * @returns {Numbers} Number of bytes actually written
     */
    async write(buffer, offset, length, position) {
        const self = this;
        return new Promise((resolve, reject) => {
            fs.write(self.fd, buffer, offset, length, position, (err, bytesWritten) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(bytesWritten);
                }
            });
        });
    }
}

module.exports = {
    FileHandle, FileFlags
};