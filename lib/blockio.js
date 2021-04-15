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

'use strict';

const fse = require('fs-extra');
const path = require('path');
const { retry } = require('./retry');
const { streamGet } = require("./fetch");
const { createSourceBlock, createTransferBlock } = require("./block");
const { Target } = require("./target");
const { map_concurrent_unordered } = require("./generator/map_concurrent_unordered");
const { pathToFileURL } = require("url");
const { getETag, getContentRange, getContentLength, getLastModified, getContentType } = require("./headers");
const { Source } = require("./source");
const { HttpResponseError, HttpContentRangeError, HttpSeekError, HttpPartialReadError, HttpContentLengthMissing } = require("./error");
const { HTTP } = require("./constants");

const DEFAULT_BLOCK_SIZE = 100*1024*1024;

/**
 * Check if a url is available for random access
 * 
 * @param {String} url http/https string
 * @returns True if the url is enabled for random access
 */
function isRandomAccessSupported(url) {
    return true;
}

/**
 * Create partial GET request headers
 * 
 * @param {Number} [start=0] Start offset of the block of bytes
 * @param {Number} [end] End offset of the block of bytes, defaults to remainder of the content (exclusive)
 * @param {Source} [previousSource] Previous source to ensure data is from the same version of the asset
 * @returns {*} Request headers
 */
function partialGetRequestHeaders(start, end, previousSource) {
    const headers = { };

    if (start && end) {
        headers[HTTP.HEADER.RANGE] = `${HTTP.RANGE.BYTES}=${start}-${end-1}`;
    } else if (start) {
        headers[HTTP.HEADER.RANGE] = `${HTTP.RANGE.BYTES}=${start}-`;
    } else if (end) {
        headers[HTTP.HEADER.RANGE] = `${HTTP.RANGE.BYTES}=0-${end-1}`;
    }    

    if (previousSource && previousSource.etag) {
        headers[HTTP.HEADER.IF_MATCH] = previousSource.etag;
    } else if (previousSource && previousSource.lastModified) {
        headers[HTTP.HEADER.IF_UNMODIFIED_SINCE] = previousSource.lastModified;
    }
    return headers;
}

/**
 * Open a stream to download 
 * 
 * @param {String} url URL to download
 * @param {Number} [start=0] Start offset of the block of bytes
 * @param {Number} [end] End offset of the block of bytes, defaults to remainder of the content (exclusive)
 * @param {Source} [previousSource] Previous source to ensure data is from the same version of the asset
 * @param {Object} [options] Fetch options
 * @returns {{source, status, stream}} HTTP response
 */
async function openGetStream(url, start, end, previousSource, options) {
    const headers = partialGetRequestHeaders(start, end, previousSource);
    const response = await streamGet(url, Object.assign({}, options, {
        compress: false,
        headers
    }));

    const contentType = getContentType(response.headers);
    const lastModified = getLastModified(response.headers);
    const etag = getETag(response.headers);

    // It's valid for the server to either return a 206 (partial content) 
    // or 200 (OK) if range requests are not requested or not supported
    let sourceStart, sourceEnd, sourceTotalSize;
    if (response.status === HTTP.STATUS.PARTIAL_CONTENT) {
        // parse content-range, must exist for a 206 (partial content) status
        const contentRange = getContentRange(response.headers);
        if (!contentRange) {
            throw new HttpContentRangeError(HTTP.METHOD.GET, url, response.status, "missing content-range");
        } else if (contentRange.unit !== HTTP.RANGE.BYTES) {
            throw new HttpContentRangeError(HTTP.METHOD.GET, url, response.status, `unsupported range type: ${contentRange}`);
        }

        sourceStart = contentRange.first;
        sourceEnd = contentRange.last;
        sourceTotalSize = contentRange.length;
    } else if (response.status === HTTP.STATUS.OK) {
        const contentLength = getContentLength(response.headers);
        if (!contentLength) {
            throw new HttpContentLengthMissing(HTTP.METHOD.GET, url, response.status, "missing content-length");
        }

        sourceStart = 0;
        sourceEnd = contentLength;
        sourceTotalSize = contentLength;
    } else {
        throw new HttpResponseError(HTTP.METHOD.GET, url, response.status);
    }

    return {
        source: new Source(
            url, 
            contentType, 
            lastModified, 
            etag, 
            sourceTotalSize, 
            sourceStart, 
            sourceEnd
        ),
        status: response.status,
        stream: response.body
    };
}

/**
 * Seek in stream.
 * 
 * This may happen when we have already read a number of bytes from a source that 
 * does not support range request.
 * 
 * @param {Source} source Source reference
 * @param {Number} targetOffset Offset to seek to (index after the last read chunk)
 * @param {Readable} stream Readable stream
 * @param {Number} streamOffset Offset within source where the stream is pointing to
 * @returns {Buffer} Read chunk
 */
async function seekStream(source, targetOffset, stream, streamOffset) {
    console.warn(`Seeking in stream ${source.uri} from ${streamOffset} to ${targetOffset}`);
    let offset = streamOffset;
    for await (const chunk of stream) {
        if ((offset + chunk.length) > targetOffset) {
            return chunk.slice(offset - targetOffset);
        }
        offset += chunk.length;
    }
    throw new HttpSeekError(
        HTTP.METHOD.GET, 
        source.uri, 
        `Start offset: ${streamOffset}, Target offset: ${targetOffset}, Current offset: ${offset}`
    );
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
        const currentBuffer = buffer.slice(0, bufferOffset);
        buffer = Buffer.concat(currentBuffer, chunk);
    } else {
        chunk.copy(buffer, bufferOffset);
    }
    bufferOffset += chunk.length;
    return { buffer, bufferOffset };
}

/**
 * Read a block of content from the given stream
 * 
 * This function will seek the stream to get the stream at the same point 
 * as offset. This is used when the server does not support range requests.
 * 
 * This function may read more data from the stream if the requested number of bytes
 * is not a multiple of the chunks received from the stream.
 * 
 * @param {Source} source Source reference
 * @param {Number} start Start offset after the last read block from source
 * @param {Number} end End offset to stop reading 
 * @param {Readable} stream Readable stream
 * @param {Number} streamOffset Offset within source where the stream is pointing to
 * @returns {Block} downloaded block
 */
async function readBlock(source, start, end, stream, streamOffset) {
    let buffer = Buffer.allocUnsafe(end - start);
    let bufferOffset = 0;

    // make sure offset and streamOffset point at the same point
    if (streamOffset > start) {
        throw new HttpSeekError(
            HTTP.METHOD.GET, 
            source.uri, 
            `Stream offset beyond target offset. Stream offset: ${streamOffset}, Target offset: ${start}`
        );
    } else if (streamOffset < start) {
        const chunk = await seekStream(source, start, stream, streamOffset);
        ({buffer, bufferOffset} = addChunk(buffer, bufferOffset, chunk));
    }

    // add chunks to the buffer until buffer is full
    for await (const chunk of stream) {
        ({buffer, bufferOffset} = addChunk(buffer, bufferOffset, chunk));
        if (bufferOffset === buffer.length) {
            break;
        }
    }

    // partial block read
    if ((end - start) > bufferOffset) {
        throw new HttpPartialReadError(HTTP.METHOD.GET, source.uri, `${bufferOffset} bytes read, out of ${end - start} expected`);
    } else if ((end - start) < bufferOffset) {
        console.warn(`GET '${source.uri}' read more than requested: ${bufferOffset} bytes read, out of ${end - start} expected`);
    }

    // partial source block
    const partialSource = source.slice(start, start + bufferOffset);
    const partialBuffer = buffer.slice(0, bufferOffset);
    return createSourceBlock(partialSource, partialBuffer);
}


async function readBlockRetry(source, start, end, stream, streamOffset, streamEnd, options) {
    return retry(async () => {
        try {
            // re-establish stream due to retry
            if (!stream) {
                const { source: newSource, stream: newStream } = await openGetStream(
                    source.uri, 
                    start, 
                    streamEnd, 
                    source,
                    options
                );
                stream = newStream;
                streamOffset = newSource.start;
            }

            // download block
            const block = await readBlock(source, start, end, stream, streamOffset);
            return {
                block,
                stream,
                streamOffset: streamOffset + block.length
            };
        } catch (e) {
            stream = undefined;
            throw e;
        }
    }, options);
}

/**
 * Stream blocks of content from a given source from start to end.
 * 
 * Supports seeking the stream from streamOffset to get to the start offset.
 * Supports retry of by restarting the stream from the end of the last yielded block.
 * 
 * @generator
 * @param {Source} source Source of the content (http/https)
 * @param {Number} start Start offset to read from
 * @param {Number} end End offset to stop reading (exclusive)
 * @param {Readable} stream Readable stream
 * @param {Number} streamOffset Offset the stream is currently pointing at
 * @param {Number} blockSize Number of bytes for each block
 * @param {RetryOptions} options Retry options
 * @yields {Block} Source block
 */
async function* streamBlocks(source, start, end, stream, streamOffset, blockSize, options) {
    let offset = start;
    while (offset < end) {
        const endBlockOffset = Math.min(offset + blockSize, end);
        const { 
            block, 
            stream: newStream, 
            streamOffset: newStreamOffset  
        } = await readBlockRetry(source, offset, endBlockOffset, stream, streamOffset, end, options);

        offset += block.buffer.length;
        stream = newStream;
        streamOffset = newStreamOffset;
        yield block;
    }
}

/**
 * Download a file as a set of blocks. 
 * 
 * If the source supports random access block I/O (e.g. Azure/S3) then the first block
 * will be downloaded and yielded and the remainder will be yielded unresolved so they can be 
 * downloaded concurrently.
 * 
 * If the source supports a range-header, then each downloaded block will be yielded and in case
 * of an intermediate failure it will restart from the last yielded block.
 * 
 * If the source does not support a range-header, and size<=blockSize the entire source is yielded
 * otherwise on retry it will seek to the last yielded block.
 * 
 * @generator
 * @param {URL} url URL to download the blocks from
 * @param {DownloadFileOptions} options Fetch options
 * @yields {Block} block of content 
 */
async function* downloadFileBlocks(source, stream, blockSize, options) {
    if (source.length === source.totalSize) {
        // partial get not supported, return the entire file as a stream of blocks
        yield* streamBlocks(source, 0, source.totalSize, stream, 0, blockSize, options);
    } else {
        // partial response, stream all the blocks returned
        let offset = 0;
        for await (const block of streamBlocks(source, 0, source.length, stream, 0, blockSize, options)) {
            offset = block.source.end;
            yield block;
        }

        // random access future requests for the rest
        while (offset < source.totalSize) {
            const endOffset = Math.min(offset + blockSize, source.totalSize);
            const partialSource = source.slice(offset, endOffset);
            yield createSourceBlock(partialSource);
            offset = endOffset;
        }
    }
}

/**
 * @typedef {Object} DownloadFileOptions
 *
 * @property {Number} [blockSize] Size of the block to download
 * @property {Number} [firstBlockSize] Size of the first block to download
 * @property {Number} [timeout] Socket timeout
 * @property {Object} [headers] An object containing request headers
 * @property {Boolean} [mkdirs] True if the directory of the filepath should be created
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Download a file from an url
 *
 * @param {String|URL} url Source URL
 * @param {String} filepath Target file path
 * @param {DownloadFileOptions} [options] Download options
 * @returns {Promise} resolves when download completes
 */
async function downloadFile(url, filepath, options) {
    if (options && options.mkdirs) {
        await fse.ensureDir(path.dirname(filepath));
    }

    const maxConcurrent = (options && options.maxConcurrent) || 1;
    const blockSize = (options && options.blockSize) || DEFAULT_BLOCK_SIZE;
    const firstBlockSize = (options && options.firstBlockSize) || blockSize;

    const { source, stream } = retry(async () => {
        if (isRandomAccessSupported(url)) {
            return openGetStream(url, 0, firstBlockSize, undefined, options);
        } else {
            return openGetStream(url, undefined, undefined, undefined, options);
        }
    }, options);

    const targetUri = pathToFileURL(filepath);

    const transferQueue = map_concurrent_unordered(
        downloadFileBlocks(source, stream, blockSize, options),
        async ({ source, buffer }) => {
            const target = new Target(targetUri, source.contentType, source.start, source.end);
            if (!buffer) {
                buffer = retry(async () => {
                    const {
                        source: partialSource,
                        stream: partialStream
                    } = await openGetStream(source.uri, source.start, source.end, source, options);
                    const block = readBlock(source, source.start, source.end, partialStream, partialSource.start);
                    if (block.length > source.length) {
                        console.warn(`Read too much: expected: ${source.length}, received: ${block.length}`);
                        // warn!
                        return block.buffer.slice(0, source.length);
                    } else {
                        return block.buffer;
                    }
                });
            }
            return createTransferBlock(source, target);
        },
        { max_concurrent: maxConcurrent }
    );

    for await (const block of transferQueue) {
        console.log(`Transfer ${block.source.start}-${block.source.end} from ${block.source.uri} to ${block.target.uri}`);
    }
}


module.exports = {
    downloadFile
};
