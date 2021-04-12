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

const { Block } = require("./block");
const { streamGet, issuePut } = require("../fetch");
const { parseResourceHeaders } = require("../headers");
const { downloadStream } = require("../stream");
const { retry } = require("../retry");
const { PassThrough } = require("stream");
const contentRange = require("content-range");

const DEFAULT_BLOCK_SIZE = 100*1024*1024;
const REQUEST_HEADER_IF_MATCH = "if-match";
const REQUEST_HEADER_IF_UNMODIFIED_SINCE = "if-unmodified-since";
const RESPONSE_HEADER_LAST_MODIFIED = "last-modified";
const RESPONSE_HEADER_CONTENT_RANGE = "content-range";
const RESPONSE_HEADER_CONTENT_LENGTH = "content-length";
const RANGE_UNIT_BYTES = "bytes";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_PARTIAL_CONTENT = 206;

function isRandomBlockReadSupported(url) {
    // azure, s3, 
    return true;
}

function parseETagHeader(headers) {
    const etag = headers.get("etag");
    if (etag && !etag.startsWith("W/")) {
        return etag;
    } else {
        return undefined;
    }
}

function parseContentLengthHeader(headers) {
    const contentLength = headers.get(RESPONSE_HEADER_CONTENT_LENGTH);
    if (contentLength) {
        const parsed = parseInt(contentLength);
        if (typeof parsed === "number" && !isNaN(parsed)) {
            return parsed;
        }
        return undefined;
    }
    return undefined;
}

function parseContentRangeHeader(headers) {
    const contentRange = headers.get(RESPONSE_HEADER_CONTENT_RANGE);
    if (contentRange) {
        return contentRange.parse(contentRange);
    }
    return undefined;
}

function rangeRequestHeader(unit, first, last) {
    return `${unit}=${first}-${last}`;
}

async function readBlock(stream, block) {
    const buf = Buffer.allocUnsafe(block.size);
    let bufOffset = 0;
    for await (const chunk of stream) {
        if ((bufOffset + chunk.length) > block.size) {
            // too much data
        }
        bufOffset += chunk.copy(buf, bufOffset);
    }
    if (bufOffset < block.size) {
        // truncated -- retry
    }
    block.buffer = buf;
    return block;
}

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

async function* downloadAzureBlocks(url, options) {
    const blockSize = options.blockSize || DEFAULT_BLOCK_SIZE;

    if (!isRandomBlockReadSupported(url)) {
        throw Error(`Not supported for: ${url}`);
    }

    const firstBlock = await downloadAzureBlock(url, 0, blockSize);
    yield firstBlock;

    const totalSize = firstBlock.totalSize;
    let offset = firstBlock.size;
    while (offset < totalSize) {

        const block = await downloadAzureBlock()

    }


}

// async function* downloadStreamBlocks(url, options) {
//     const offset = options.start || 0;
//     const blockSize = options.blockSize || DEFAULT_BLOCK_SIZE;

//     const headers = {};
//     if (offset > 0) {
//         headers.range = `bytes=${offset}-`
//     }

//     const response = await streamGet(url, {
//         compress: false,
//         headers
//     });

//     const p = new PassThrough({ readableHighWaterMark: blockSize });
//     response.body.pipe(p);
//     for await (const chunk of response.body) {

//     }
    
//     readableHighWaterMark.body 
// }

// async function* downloadBlocks(url, filepath, options) {
//     const blockSize = options.blockSize || DEFAULT_BLOCK_SIZE;

//     if (isRandomBlockReadSupported(url)) {
//         // attempt to acquire the first block
//         const response = await retry(async () => {
//             return streamGet(url, {
//                 compress: false,
//                 headers: {
//                     range: `bytes=0-${blockSize-1}`
//                 }
//             })
//         }, options);

//         if (response.status === 200 || response.status === 206) {
//             response.headers["content-range"];

//             // read in memory, yield block
//             // yield incomplete blocks
//         }

//     } else {
//         const response = await retry(async () => {
//             return streamGet(url, {
//                 compress: false
//             })
//         }, options);

//         const expectedBytes = parseResourceHeaders(response.headers).size;
//         if (expectedBytes && expectedBytes < blockSize) {
//             // read in memory, yield block
//         } else {
//             // store to disk


//         }



//         response.headers[""]
 
//         const expectedBytes = parseResourceHeaders(response.headers).size;
//         let actualBytes = 0;
//         return new Promise((resolve, reject) => {
//             response.body
//                 .on("data", chunk => {
//                     actualBytes += chunk.length;
//                 })
//                 .on("error", err => {
//                     reject(new HttpStreamError("GET", url, response.status, err.message));
//                 })
//                 .pipe(writeStream)
//                 .on("error", err => {
//                     reject(new HttpStreamError("GET", url, response.status, err.message));
//                 })
//                 .on("finish", () => {
//                     // for now, we manually check bytes length since there is no stream error event handling in `node-fetch-npm`
//                     // there is already a fix in node-fetch v3: https://github.com/node-fetch/node-fetch/blob/master/src/index.js#L226-L230
//                     // the fix comes from this issue: https://github.com/node-fetch/node-fetch/issues/309
//                     // we plan to switch to node-fetch when v3 release is stable
//                     if (expectedBytes && (actualBytes !== expectedBytes)) {
//                         reject(new HttpStreamError("GET", url, response.status, `Unexpected stream-size. Received ${actualBytes} bytes, expected ${expectedBytes} bytes`));
//                     }
//                     resolve(actualBytes);
//                 });
//         });

//     }



// }

// const https = require("http2");
// const https = require("https");
// const net = require("net");

// const SOCKET_TIMEOUT = 1000;
const READ_BUFFER_SIZE = 128*1024;

// class Agent extends https.Agent {
//     createConnection(options, callback) {
//         return super.createConnection(Object.assign({}, options, {
//             highWaterMark: READ_BUFFER_SIZE,
//             readableHighWaterMark: READ_BUFFER_SIZE
//         }, callback));
//     }
// }

// const agent = new https.Agent({ keepAlive: true });
// const agent = new Agent({ keepAlive: true });

/**
 * 
 * @param {string} url http url
 * @param {number} offset Offset of the block to download
 * @param {number} size Size of the block to download
 * @returns {Buffer} buffer
 */
async function downloadBuffer(url, offset, size) {
    return new Promise((resolve, reject) => {
        const buf = Buffer.allocUnsafe(size);
        let bufOffset = 0;
        const req = https.request(url, {
            agent,
            method: "get",
            headers: {
                range: `bytes=${offset}-${offset+size-1}`
            },
            // createConnection(options, callback) {
            //     console.log("createConnection", options, callback);
            //     // relies on https://github.com/nodejs/node/pull/30135
            //     // options.
            //     const socket = net.createConnection({
            //         host: options.host || options.hostname,
            //         port: options.port || options.defaultPort,
            //         readableHighWaterMark: READ_BUFFER_SIZE
            //     }, (err, stream) => {
            //         console.log(err, stream);
            //         callback(err, stream);
            //     });
            //     return socket;
            //     // return net.createConnection(Object.assign({}, options, {
            //     //     readableHighWaterMark: READ_BUFFER_SIZE
            //     // }, callback));
            // }
            // timeout: SOCKET_TIMEOUT 
        }, res => {
            // res.readableHighWaterMark = READ_BUFFER_SIZE;
            console.log(res.socket.readableHighWaterMark);
            console.log(res.readableHighWaterMark);

            console.log("2");
            const { statusCode } = res;
            const contentType = res.headers["content-type"];

            console.log("status", statusCode);
            console.log("contentType", contentType);

            res.on("data", chunk => {
                console.log(`offset: ${bufOffset+offset}, length: ${chunk.length}`);
                bufOffset += chunk.copy(buf, bufOffset);
            });
            res.on("end", () => {
                resolve(buf.slice(0, bufOffset));
            });
            res.on("error", err => {
                reject(err);
            });
        });
        // req.on("abort", () => {
        //     console.log(`${url}: abort`);
        // });
        // req.on("connect", () => {
        //     console.log(`${url}: connect`);
        // });
        // req.on("continue", () => {
        //     console.log(`${url}: continue`);
        // });
        // req.on("information", info => {
        //     console.log(`${url}: ${JSON.stringify(info)}`);
        // });
        // req.on("response", () => {
        //     console.log(`${url}: response`);
        // });
        // req.on("socket", () => {
        //     console.log(`${url}: socket`);
        // });
        // req.on("timeout", () => {
        //     console.log(`${url}: timeout`);
        // });
        // req.on("upgrade", () => {
        //     console.log(`${url}: upgrade`);
        // });
        req.on("error", err => {
            console.error(`${url}: error ${err.message}`);
            reject(err);
        });
        console.log("3");
        req.end();
    });
}

/**
 * Download a block of content from a remote URL to the local file path
 * 
 * @param {string} url http url
 * @param {string} filepath Local path file 
 * @param {number} offset Offset of the block to download
 * @param {number} size Size of the block to download
 */
async function downloadBlock(url, filepath, offset, size) {
    // return new Promise((resolve, re))
    // https.request({
    //     url: 
    // })

}

async function uploadBlock(filepath, url, offset, size) {

}

module.exports = {
    downloadBuffer,
    downloadBlock,
    uploadBlock,
    downloadAzureBlock
}
