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

const { HTTP } = require("../constants");
const PRIVATE = Symbol("PRIVATE");
const { getContentRange, getContentLength } = require("./headers");
const { HttpResponseError, HttpContentRangeError, HttpContentLengthMissing } = require("./error");
const { streamGet } = require("../fetch");
const { HttpStreamError } = require("../error");

const INITIAL_BUFFER_SIZE = 1024*1024;
const SEEK_BUFFER_SIZE = 1024*1024;

/**
 * Create partial GET request headers
 * 
 * @param {Part} part Part to request
 * @returns {*} Request headers
 */
function partialGetRequestHeaders(part) {
    const headers = { };
    const { start, end, version } = part;

    if (start && end) {
        headers[HTTP.HEADER.RANGE] = `${HTTP.RANGE.BYTES}=${start}-${end-1}`;
    } else if (start) {
        headers[HTTP.HEADER.RANGE] = `${HTTP.RANGE.BYTES}=${start}-`;
    } else if (end) {
        headers[HTTP.HEADER.RANGE] = `${HTTP.RANGE.BYTES}=0-${end-1}`;
    }    

    if (version && version.etag) {
        headers[HTTP.HEADER.IF_MATCH] = version.etag;
    } else if (version && version.lastModified) {
        headers[HTTP.HEADER.IF_UNMODIFIED_SINCE] = version.lastModified;
    }
    return headers;
}

/**
 * @typedef {Object} BufferOffset
 * @property {Buffer} buffer Buffer object
 * @property {Number} offset Offset after the last added chunk of data
 */
/**
 * Add a chunk to a large buffer. 
 * Will resize the buffer to make space for the chunk if required.
 * 
 * @param {Buffer} buffer Large buffer
 * @param {Number} bufferOffset Current offset in buffer
 * @param {Buffer} chunk Chunk to add
 * @returns {BufferOffset} Buffer and offset
 */
function addChunk(buffer, bufferOffset, chunk) {
    const requiredLength = bufferOffset + chunk.length;
    if (requiredLength > buffer.length) {
        // TODO: only works for arrays, need better
        const currentBuffer = buffer.slice(0, bufferOffset);
        buffer = Buffer.concat(currentBuffer, chunk);
    } else {
        chunk.copy(buffer, bufferOffset);
    }
    bufferOffset += chunk.length;
    return { buffer, bufferOffset };
}

/**
 * Http Read Client
 */
class HttpClient {
    /**
     * Construct a client around a response
     * 
     * @param {String|URL} uri URL that was requested
     * @param {Number} start Starting offset
     * @param {Number} end Ending offset (exclusive)
     * @param {Number} totalLength Total length
     * @param {Response} response Axios response
     */
    constructor(uri, start, end, totalLength, response) {
        this[PRIVATE] = {
            uri,
            start,
            end,
            totalLength,
            response,
            offset: start,
            streamOffset: start,
            buffer: Buffer.allocUnsafe(INITIAL_BUFFER_SIZE),
            bufferOffset: 0
        };
    }

    async issueHead() {

    }

    async issuePut() {

    }

    async issueGet() {
        
    }

    /**
     * Offset in the content
     * 
     * @returns {Number} Current offset in the content
     */
    get offset() {
        return this[PRIVATE].offset;
    }

    /**
     * Ending offset of the content (exclusive)
     * 
     * @returns {Number} Ending offset (exclusive)
     */
    get end() {
        return this[PRIVATE].end;
    }

    /**
     * Total length of the content 
     * 
     * @returns {Number} Total length of the content
     */
    get totalLength() {
        return this[PRIVATE].totalLength;
    }

    /**
     * Read bytes from the stream until we reach the given offset
     * 
     * @param {Number} offset Offset to seek to
     */
    async seek(offset) {
        if (offset >= this[PRIVATE].end) {
            throw Error(`Attempt to seek ${this[PRIVATE].uri} beyond the response size. Requested offset: ${offset}. Stream start: ${this[PRIVATE].start}, Stream end: ${this[PRIVATE].end}`);
        }
        let currentOffset = this[PRIVATE].offset;
        console.warn(`Seeking in stream ${this[PRIVATE].uri} from ${currentOffset} to ${offset}`);
        while (currentOffset < offset) {
            await this.read(Math.min(SEEK_BUFFER_SIZE, offset - currentOffset));
            currentOffset = this[PRIVATE].offset;
        }
    }

    /**
     * Read a part of the contents
     * 
     * @param {Number} size Number of bytes to read
     */
    async read(size) {
        const { uri, response, totalLength } = this[PRIVATE];
        let { streamOffset, buffer, bufferOffset } = this[PRIVATE];

        // read until the requested number of bytes are read, the stream ends,
        // or the stream prematurely closes
        try {
            while ((bufferOffset < size) && (streamOffset < totalLength)) {
                const { value: chunk, done } = await response.data.next();
                if (done) {
                    break;
                }
                ({buffer, bufferOffset} = addChunk(buffer, bufferOffset, chunk));
                streamOffset += chunk.length;
            }    
        } catch (err) {
            throw new HttpStreamError(HTTP.METHOD.GET, uri, response.status, err.message);
        }

        // check for premature end of stream
        if ((bufferOffset < size) && (streamOffset < totalLength)) {
            throw new HttpStreamError(HTTP.METHOD.GET, uri, response.status, `Response truncated at ${offset} bytes, received ${bufferOffset} bytes`);
        }

        // Create a buffer only containing the requested bytes
        // Update the internal buffer to move remaining content to the front of the buffer
        const bytesRead = Math.min(bufferOffset, size);
        const result = Buffer.from(buffer.slice(0, bytesRead));
        buffer.copy(buffer, 0, bytesRead, bufferOffset);
        bufferOffset -= bytesRead;

        // Update state
        this[PRIVATE].buffer = buffer;
        this[PRIVATE].bufferOffset = bufferOffset;
        this[PRIVATE].streamOffset = streamOffset;
        this[PRIVATE].offset += bytesRead;

        return result;
    }
}

/**
 * Create HTTP read client to read a given part
 * 
 * @param {Part} part Part to read
 * @param {Headers} headers Headers to pass to the server
 * @returns {HttpReadClient} HTTP read client
 */
async function createHttpReadClient(part, headers) {
    const response = await streamGet(part.uri, {
        compress: false,
        headers: Object.assign(
            {}, 
            headers, 
            partialGetRequestHeaders(part)
        )
    });

    let start, end, totalLength;
    if (response.status === HTTP.STATUS.OK) {
        const contentLength = getContentLength(response.headers);
        if (!contentLength) {
            throw new HttpContentLengthMissing(HTTP.METHOD.GET, part.uri, response.status, "missing content-length");
        }

        start = 0;
        end = contentLength;
        totalLength = contentLength;
    } else if (response.status === HTTP.STATUS.PARTIAL_CONTENT) {
        // parse content-range, must exist for a 206 (partial content) status
        const contentRange = getContentRange(response.headers);
        if (!contentRange) {
            throw new HttpContentRangeError(HTTP.METHOD.GET, part.uri, response.status, "missing content-range");
        } else if (contentRange.unit !== HTTP.RANGE.BYTES) {
            throw new HttpContentRangeError(HTTP.METHOD.GET, part.uri, response.status, `unsupported range type: ${contentRange}`);
        }

        start = contentRange.first;
        end = contentRange.last + 1; // http range is inclusive, our range is exclusive hence the + 1
        totalLength = contentRange.length;
    } else {
        throw new HttpResponseError(HTTP.METHOD.GET, part.uri, response.status);
    }

    // Ensure that the client starts at the requested offset
    // If the server does not support range requests, we need to seek to the requested offset
    const client = new HttpReadClient(part.uri, start, end, totalLength, response);
    if (client.offset < start) {
        await client.seek(start);
    } else if (client.offset > start) {
        throw new HttpResponseError(HTTP.METHOD.GET, part.uri, response.status, )
    }
    return client;
}

module.exports = {
    createHttpReadClient
};