/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/* eslint-env mocha */

'use strict';

const stream = require('stream');
const { StringDecoder } = require('string_decoder');

/**
 * Readable that provides characters from a string in UTF8 encoding one 
 * character at a time.
 */
class StringReadable extends stream.Readable {

    constructor(str) {
        super();
        this.data = Buffer.from(str, 'utf8');
        this.position = 0;
    }

    _read() {
        if (this.position < this.data.length) {
            this.push(this.data.slice(this.position, this.position + 1));
            ++this.position;
        } else {
            // end of stream
            this.push(null);
        }
    }

}

/**
 * Writable that collects UTF8 characters in to a string.
 */
class StringWritable extends stream.Writable {

    constructor() {
        super();
        this.data = '';
        this.decoder = new StringDecoder('utf8');
    }

    _write(chunk, encoding, callback) {
        if (encoding === 'buffer') {
            chunk = this.decoder.write(chunk);
        }
        this.data += chunk;
        callback();
    }

    _final(callback) {
        this.data += this.decoder.end();
        callback();
    }

}

/**
 * Create a readable that emits the provided error on first read.
 * 
 * @param {Error} error Error to emit on first read
 */
function createErrorReadable(error) {
    return new stream.Readable({
        read() {
            process.nextTick(() => this.emit('error', error));
        }
    });
}

/**
 * Create a writable that emits the provided error on first read.
 * 
 * @param {Error} error Error to emit on first read
 */
function createErrorWritable(error) {
    return new stream.Writable({
        write(chunk, encoding, callback) {
            callback(error);
        }
    });
}

module.exports = {
    StringReadable,
    StringWritable,
    createErrorReadable,
    createErrorWritable
}
