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
const { partialGet, streamGet } = require("./fetch");
const { createSourceBlock, createTransferBlock } = require("./block");
const { Target } = require("./target");
const { map_concurrent_unordered } = require("./generator/map_concurrent_unordered");
const { pathToFileURL } = require("url");
const { getETag, getContentRange, getContentLength, getLastModified, getContentType } = require("./headers");
const { Source } = require("./source");
const { HttpResponseError, HttpContentRangeError, HttpSeekError, HttpPartialReadError } = require("./error");
const { HTTP } = require("./constants");

const DEFAULT_BLOCK_SIZE = 100*1024*1024;

async function blockGet(url, options) {
    const response = streamGet(url, options);

    const contentLength = getContentLength(response.headers);
    const contentType = getContentType(response.headers);
    const lastModified = getLastModified(response.headers);
    const etag = getETag(response.headers);

    // It's valid for the server to either return a 206 (partial content) 
    // or 200 (OK) if range requests are not requested or not supported
    if (response.status === HTTP.STATUS.PARTIAL_CONTENT) {
        // parse content-range, must exist for a 206 (partial content) status
        const contentRange = getContentRange(response.headers);
        if (!contentRange) {
            throw new HttpContentRangeError(HTTP.METHOD.GET, url, response.status, "missing content-range");
        } else if (contentRange.unit !== HTTP.RANGE.BYTES) {
            throw new HttpContentRangeError(HTTP.METHOD.GET, url, response.status, `unsupported range type: ${contentRange}`);
        }

        return {
            source: new Source(
                url, 
                contentType, 
                lastModified, 
                etag, 
                contentRange.length,
                contentRange.first, 
                contentRange.last + 1 // content-range is inclusive, our range exclusive
            ),
            stream: response.body
        };
    } else if (response.status === HTTP.STATUS.OK) {
        return {
            source: new Source(
                url, 
                contentType, 
                lastModified, 
                etag, 
                contentLength, 
                0, 
                contentLength
            ),
            status: response.status,
            stream: response.body
        };
    } else {
        throw new HttpResponseError(HTTP.METHOD.GET, url, response.status);
    }
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
        const currentBuffer = buffer.slice(0, bufferOffset)
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
 * Open a block stream. 
 * 
 * Will request a partial portion is the URL supports random access reads (e.g. S3, Azure). 
 * Otherwise it will return  
 * 
 * @param {String} url URL to access
 * @param {Number} preferredSize Preferred number of bytes 
 * @param {*} options Fetch options
 * @returns {SourceStream} Source stream
 */
async function openBlockStream(url, preferredSize, options) {
    return retry(async () => {
        if (isRandomAccessSupported(url)) {
            return partialGet(url, 0, preferredSize, undefined, {
                timeout: options.timeout,
                header: options.headers
            });
        } else {
            return blockGet(url, {
                timeout: options.timeout,
                headers: options.headers
            });
        }
    }, options);
}

async function readBlockRetry(source, start, end, stream, streamOffset, streamEnd, options) {
    return retry(async () => {
        try {
            // re-establish stream due to retry
            if (!stream) {
                const { source: newSource, stream: newStream } = await partialGet(
                    source.uri, 
                    start, 
                    streamEnd, 
                    source
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
        const { block, stream: s  } = await readBlockRetry(source, offset, endBlockOffset, stream, offset, end, options);

        // const block = await retry(async () => {
        //     try {
        //         // re-establish stream due to retry
        //         if (!stream) {
        //             const { source: newSource, stream: newStream } = await partialGet(source.uri, offset, end, source);
        //             stream = newStream;
        //             streamOffset = newSource.start;
        //         }

        //         // download block
        //         return await readBlock(source, offset, endBlockOffset, stream, streamOffset);
        //     } catch (e) {
        //         stream = undefined;
        //         throw e;
        //     }
        // }, options);

        offset += block.buffer.length;
        streamOffset = offset;
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
    const { source, stream } = openBlockStream(url, firstBlockSize, options);
    const targetUri = pathToFileURL(filepath);

    const transferQueue = map_concurrent_unordered(
        downloadFileBlocks(source, stream, blockSize, options),
        async ({ source, buffer }) => {
            const target = new Target(targetUri, source.contentType, source.start, source.end);
            if (!buffer) {
                // retry(async () => {
                //     const { source: partialSource , stream: partialStream} = await partialGet(source.uri, source.start, source.end, source, options);
                //     readBlock(source, source.start, source.end, partialStream, partialSource.start);    
                // });
                // read!
            }
            return createTransferBlock(source, target);
        },
        { max_concurrent: maxConcurrent }
    );

    for await (const block of transferQueue) {
        console.log(`Transfer ${block.source.start}-${block.source.end} from ${block.source.uri} to ${block.target.uri}`);
    }
}

// /**
//  * @typedef {Object} UploadFileOptions
//  *
//  * @property {String} [method] HTTP method (defaults to 'PUT')
//  * @property {Number} [timeout] Socket timeout
//  * @property {Object} [headers] An object containing request headers
//  * @property {Number} [start] Offset of the first byte in the file to upload (inclusive)
//  * @property {Number} [end] Offset of the last byte in the file to upload (inclusive)
//  * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
//  * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
//  * @property {Boolean} [retryEnabled=true] retry on failure enabled
//  * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
//  *
//  * Note that the start and end offsets are not passed to the server. This is intentional.
//  * Range upload requests are not widely supported, although could be added optionally.
//  */
// /**
//  * Upload a file to an url
//  *
//  * @param {String} filepath Source file path
//  * @param {String} url Target URL
//  * @param {UploadFileOptions} [options] Upload options
//  * @returns {Promise} resolves when upload completes
//  */
// async function uploadFile(filepath, url, options) {
//     return retry(async options => {
//         // determine the content length
//         let contentLength;
//         let readStream;
//         if (options && options.end) {
//             const start = options.start || 0;
//             contentLength = options.end - start + 1;
//             readStream = await createReadStream(filepath, {
//                 start: start,
//                 end: options.end
//             });
//         } else {
//             const { size } = await fs.stat(filepath);
//             contentLength = size;
//             readStream = await createReadStream(filepath);
//         }

//         // extract upload options
//         const uploadOptions = filterObject(
//             options || {},
//             ['method', 'timeout', 'headers']
//         );
//         uploadOptions.headers = { ...uploadOptions.headers, 'content-length': contentLength};

//         // upload file
//         return uploadStream(readStream, url, uploadOptions);
//     }, options);
// }

module.exports = {
    downloadFile,
    // uploadFile
};
