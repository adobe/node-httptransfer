/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2019 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/

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
