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

const { AsyncGeneratorFunction } = require("../generator/function");
const { Interval } = require("../asset/interval");
const { HTTP } = require("../constants");
const { IllegalArgumentError } = require("../error");
const { Pipeline } = require("../generator/pipeline");
const { StreamReader } = require("./streamreader");
const { ReadRangeFilter } = require("./readrangefilter");
const { TransferPart } = require("../asset/transferpart");
const { getContentRange, getContentLength } = require("../headers");
const logger = require("../logger");
const { retry } = require("../retry");
const { streamGet } = require("../fetch");

const DEFAULT_PART_SIZE = 10*1024*1024; // 10MB

/**
 * Get the request headers 
 * 
 * @param {TransferAsset} transferAsset Transfer asset
 * @param {SubRange} range Range to acquire of the part
 */
function getRequestHeaders(transferAsset, range) {
    const requestHeaders = {};
    
    // range request
    if (transferAsset.acceptRanges) {
        requestHeaders[HTTP.HEADER.RANGE] = `${HTTP.RANGE.BYTES}=${range.low}-${range.high}`;
    }

    // ensure we are receiving parts of the same version
    const version = transferAsset.version;
    if (version && version.etag) {
        requestHeaders[HTTP.HEADER.IF_MATCH] = version.etag;
    } else if (version && version.lastModified) {
        const lastModified = new Date(version.lastModified).toUTCString();
        requestHeaders[HTTP.HEADER.IF_UNMODIFIED_SINCE] = lastModified;
    } else {
        logger.warn(`Downloading ${transferAsset.source.url}, range: ${range} without version information`);
    }

    return Object.assign({}, requestHeaders, transferAsset.sourceHeaders);
}

/**
 * Acquire the start/end range of the content in the response
 * 
 * @param {Headers} headers HTTP headers
 * @returns {Interval} Content range
 */
function getResponseContentRange(headers) {
    const contentRange = getContentRange(headers);
    if (contentRange) {
        return new Interval(contentRange.start, contentRange.end + 1);
    } else {
        const contentLength = getContentLength(headers);
        if (contentLength) {
            return new Interval(0, contentLength);
        }
    }
}

/**
 * @typedef {Object} HttpDownloadOptions
 *
 * @property {Number} [partSize=10MB] Part size
 * @property {Number} [queueCapacity=1] Queue capacity
 * @property {Number} [retryReconnectMaxCount=5] number of attempts to reconnect the stream
 * @property {Number} [retryMaxCount] number of retry attempts, overrides retryMaxDuration
 * @property {Number} retryMaxDuration time to retry until throwing an error
 * @property {Number} retryInitialDelay time between retries, used by exponential backoff (ms)
 * @property {Number} retryBackoff backoff factor for wait time between retries (defaults to 2.0)
 * @property {Boolean} retryAllErrors whether or not to retry on all http error codes or just >=500
 * @property {Integer} socketTimeout Optional socket timeout in milliseconds (defaults to 30000ms)
 */
/**
 * Download a part, reconnects when a stream error or the stream closes prematurely.
 */
class HttpDownload extends AsyncGeneratorFunction {
    /**
     * Construct HttpDownload function
     * 
     * @Param {HttpDownloadOptions} [options] Options
     */
    constructor(options) {
        super();

        const partSize = (options && options.partSize) || DEFAULT_PART_SIZE;
        if (!Number.isFinite(partSize) || partSize < 1) {
            throw new IllegalArgumentError(`partSize must be 1 or higher`, partSize);
        }

        const queueCapacity = (options && options.queueCapacity) || 1;
        if (!Number.isFinite(queueCapacity) || queueCapacity < 1) {
            throw new IllegalArgumentError(`queueCapacity must be 1 or higher`, queueCapacity);
        }

        const retryReconnectMaxCount = (options && options.retryReconnectMaxCount) || 5;
        if (!Number.isFinite(retryReconnectMaxCount) || retryReconnectMaxCount < 1) {
            throw new IllegalArgumentError(`retryReconnectMaxCount must be 1 or higher`, retryReconnectMaxCount);
        }

        this.partSize = partSize;
        this.queueCapacity = queueCapacity;
        this.retryReconnectMaxCount = retryReconnectMaxCount;
        this.options = options;
    }

    /**
     * Download each part in chunks of `partSize` bytes. Some chunks might be smaller, 
     * if a reconnect happens mid-stream or the last chunk is downloaded.
     * 
     * @generator
     * @param {TransferPart[]|Generator||AsyncGenerator} items Items to process
     * @param {Object[]} [...args] Additional arguments
     * @yields {Buffer} Read buffer
     */
    async* execute(transferParts, controller) {
        for await (const transferPart of transferParts) {
            if (!(transferPart instanceof TransferPart)) {
                throw new IllegalArgumentError(`must be of type TransferPart`, transferPart);
            }

            const transferAsset = transferPart.transferAsset;
            let partRange = transferPart.contentRange.clone();

            let i = 0; 
            while (!partRange.empty && (i < this.retryReconnectMaxCount)) {
                // download, acquiring a potential subset of content
                logger.info(`Download ${transferPart.source.url}, range: ${partRange}`);
                const response = await retry(async () => {
                    return streamGet(transferPart.source.url, {
                        headers: getRequestHeaders(transferAsset, partRange)
                    });
                }, this.options);

                // validate received content range
                const contentRange = getResponseContentRange(response.headers);
                if (!contentRange.includes(partRange)) {
                    throw new IllegalArgumentError(`content must include part ${partRange}`, contentRange);
                }

                // read in partSize chunks, filter out only the range we are interested in
                const pipeline = new Pipeline(
                    new StreamReader({
                        partSize: this.partSize,
                        queueCapacity: this.queueCapacity
                    }),
                    new ReadRangeFilter(contentRange.start, partRange)
                );
  
                // pass along every downloaded chunk
                for await (const chunk of pipeline.execute([response.body], controller)) {
                    logger.info(`Downloaded ${transferPart.source.url}, offset: ${partRange.start}, length: ${chunk.length}`);
                    yield chunk;
                    partRange = new Interval(partRange.start + chunk.length, partRange.end);
                }

                ++i;
            }
        }
    }
}

module.exports = {
    HttpDownload
};
