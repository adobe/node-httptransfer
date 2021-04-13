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

const filterObject = require('filter-obj');
const fs = require('fs').promises;
const fse = require('fs-extra');
const path = require('path');
const { downloadStream, uploadStream } = require('../stream');
const { createReadStream, createWriteStream } = require('../util');
const { retry } = require('../retry');
const { HttpStreamError } = require('../error');

async function downloadAzureBlock(url, start, size, lastBlock) {
    // uncompressed range request
    // make sure that the block we are requesting is part of the same content
    const headers = {
        range: rangeRequestHeader(RANGE_UNIT_BYTES, start, start+size-1)
    };
    if (lastBlock && lastBlock.etag) {
        headers[REQUEST_HEADER_IF_MATCH] = lastBlock.etag;
    } else if (lastBlock && lastBlock.lastModified) {
        headers[REQUEST_HEADER_IF_UNMODIFIED_SINCE] = lastBlock.lastModified;
    }
    const response = await streamGet(url, {
        compress: false,
        headers
    });

    // parse headers
    const lastModified = response.headers.get(RESPONSE_HEADER_LAST_MODIFIED);
    const etag = parseETagHeader(response.headers);
    const contentLength = parseContentLengthHeader(response.headers);
    const contentRange = parseContentRangeHeader(response.headers);
    // check if support for bytes ranges
    // return blocksource and stream

    if (response.status === HTTP_STATUS_PARTIAL_CONTENT) {
        // content-range and/or content-length -- relationship?
        if (!contentRange) {
            // missing
        } else if (contentRange.unit !== RANGE_UNIT_BYTES) {
            // unsupported unit
        } else if (contentRange.first !== start) {
            // doesn't start at the requested offset
        } else if (!contentLength) {
            // content-length missing
        } else if (contentLength > size) {
            // larger than the requested size
        }

        const block = new Block(lastModified, etag, start, contentLength, contentRange.length);
        await readBlock(response.body, block);
        return block;
    } else if (response.status === HTTP_STATUS_OK) {
        if (start !== 0) {
            // doesn't start at the requested offset
        } else if (!contentLength) {
            // content-length missing
        } else if (contentLength > size) {
            // larger than the requested size
        }

        const block = new Block(lastModified, etag, start, contentLength, contentLength);
        await readBlock(response.body, block);
        return block;
    } else {
        // unsupported response
    }
}

/**
 * @typedef {Object} DownloadFileBlockOptions
 *
 * @property {Number} [blockSize] Size of the block to download
 * @property {Number} [firstBlockSize] Size of the first block to download
 * @property {Object} [headers] An object containing request headers
 * @property {Boolean} [mkdirs] True if the directory of the filepath should be created
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
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
 * @param {*} options 
 * @returns {Block} block of content 
 */
async function* downloadFileBlocks(url, options) {

}

/**
 * @typedef {Object} DownloadFileOptions
 *
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
    return retry(async options => {
        if (options && options.mkdirs) {
            await fse.ensureDir(path.dirname(filepath));
        }

        // 



        const writeStream = await createWriteStream(filepath);
        const transferred = await downloadStream(url, writeStream, options);
        const { size } = await fs.stat(filepath);
        if (size !== transferred) {
            throw new HttpStreamError("GET", url, 200, `Response truncated at ${size} bytes, received ${transferred} bytes`);
        }
    }, options);
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
