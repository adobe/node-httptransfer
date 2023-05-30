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

const logger = require("../logger");
const { AsyncGeneratorFunction } = require("../generator/function");
const { isFileProtocol, streamToBuffer } = require("../util");
const { issuePut, streamGet } = require("../fetch");
const { retry } = require("../retry");
const { HTTP } = require("../constants");
const { TransferEvents } = require("../controller/transfercontroller");

const MAX_MEMORY_BUFFER = 100 * 1024 * 1024;

/**
 * @callback RetryOnHttpResponseErrorCallback
 * @param {HttpResponseError} error Contains information about the request error
 * @returns {Boolean} True if the request should be retried, False otherwise
 */

/**
 * @typedef {Object} TransferOptions
 *
 * @property {Number} [timeout=3000] Optional socket timeout
 * @property {Number} [retryMaxCount] number of retry attempts, overrides retryMaxDuration
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {RetryOnHttpResponseErrorCallback} [retryOnHttpResponseError=false] Optional function determining whether to retry a request based on the HttpResponseError
 * @property {Object} [requestOptions] Options that will be passed to fetch (either node-fetch-npm or native fetch, depending on the context)
 */
/**
 * Transfer parts
 */
class Transfer extends AsyncGeneratorFunction {
    /**
     * Construct a transfer function
     * 
     * @param {RandomFileAccess} randomFileAccess Random file access instance
     * @param {import('../asset/httprequestgenerator').HttpRequestGenerator} requestGenerator Used by the transfer process
     *  to control various information about the HTTP being sent.
     * @param {TransferOptions} [options] Transfer options
     */
    constructor(randomFileAccess, requestGenerator, options) {
        super();
        this.requestGenerator = requestGenerator;
        this.randomFileAccess = randomFileAccess;
        this.options = options;
    }
    /**
     * Transfer a part
     * 
     * @param {TransferPart} transferPart Part to transfer
     * @param {TransferController} controller Transfer controller
     * @returns {TransferPart} 
     */
    async* execute(transferParts, controller) {
        for await (const transferPart of transferParts) {
            const { transferAsset } = transferPart;
            if (!transferAsset.transferStartTime) {
                controller.notify(TransferEvents.TRANSFER_ASSET, this.name, transferPart);
                transferAsset.transferStartTime = Date.now();
            }
            try {
                controller.notify(TransferEvents.TRANSFER, this.name, transferPart);

                const targetUrl = Array.isArray(transferPart.targetUrls) && (transferPart.targetUrls.length === 1) && transferPart.targetUrls[0];
                const contentRanges = transferPart.contentRange.subranges();
                if (contentRanges.length !== 1) {
                    throw Error(`'contentRanges' must be a single range: ${contentRanges}`);
                }

                const contentRange = contentRanges[0];
                if (contentRange.length > MAX_MEMORY_BUFFER) {
                    throw Error(`'contentRange.length' too large, not supported yet: ${transferPart.source.url}`);
                }

                console.log(`Transferred content range: ${contentRange}`);
                if (isFileProtocol(transferPart.source.url) && targetUrl) {
                    console.log("Source has protocol 'file'");

                    const buf = await this.randomFileAccess.read(transferPart.source.url, contentRange);

                    if (contentRange) {
                        if (buf && buf.length) {
                            console.log(`Read file ${transferPart.source.url} for content range low ${contentRange.low}, to high ${contentRange.high}, read ${buf.length} bytes`);
                        } else {
                            console.log(`Nothing read from file for content range low ${contentRange.low}, to high ${contentRange.high}`);
                        }
                    } else {
                        if (buf && buf.length) {
                            console.log(`Read file ${transferPart.source.url} (no content range), read ${buf.length} bytes`);
                        } else {
                            console.log(`Nothing read from file (no content range)`);
                        }
                    }

                    await retry(async () => {
                        const body = this.requestGenerator.createPartHttpBody({
                            transferPart,
                            partData: buf,
                            contentRange
                        });
                        const requestOptions = {
                            body,
                            timeout: this.options && this.options.timeout,
                            headers: Object.assign(
                                this.requestGenerator.createPartHttpHeaders({
                                    transferPart,
                                    httpBody: body,
                                    contentRange
                                }),
                                transferPart.targetHeaders
                            ),
                            ...this.options.requestOptions
                        };
                        // to stay backwards compatible, AEMmultiPart upload supports methods `POST` instead of `PUT`
                        if (this.options && this.options.method) {
                            requestOptions.method = this.options.method;
                        }
                        await issuePut(targetUrl, requestOptions);
                    }, this.options);
                } else if (transferPart.source.blob && targetUrl) {
                    console.log(`Source is blob, transferring ranges low ${contentRange.low}, to high ${contentRange.high}`);
                    const blob = transferPart.source.blob.slice(contentRange.low, contentRange.high + 1);
                    await retry(async () => {
                        const body = this.requestGenerator.createPartHttpBody({
                            transferPart,
                            partData: blob,
                            contentRange
                        });
                        const requestOptions = {
                            body,
                            timeout: this.options && this.options.timeout,
                            headers: Object.assign(
                                this.requestGenerator.createPartHttpHeaders({
                                    transferPart,
                                    httpBody: body,
                                    contentRange
                                }),
                                transferPart.targetHeaders
                            ),
                            ...this.options.requestOptions
                        };
                        // to stay backwards compatible, AEMmultiPart upload supports methods `POST` instead of `PUT`
                        if (this.options && this.options.method) {
                            requestOptions.method = this.options.method;
                        }
                        await issuePut(targetUrl, requestOptions);
                    }, this.options);
                } else if (targetUrl && isFileProtocol(targetUrl) && transferPart.source.url) {
                    console.log("Target has protocol 'file'");

                    await retry(async () => {
                        const totalSize = transferPart.metadata.contentLength;
                        const response = await streamGet(transferPart.source.url, {
                            headers: Object.assign({
                                [HTTP.HEADER.RANGE]: `${HTTP.RANGE.BYTES}=${contentRange.low}-${contentRange.high}`
                            }, transferPart.sourceHeaders),
                            ...this.options.requestOptions,
                        });
                        const contentLengthStr = response.headers.get(HTTP.HEADER.CONTENT_LENGTH);
                        const contentLength = Number.parseInt(contentLengthStr, 10);
                        if (!Number.isFinite(contentLength)) {
                            throw Error(`Server did not respond with a Content-Length header: ${contentLengthStr}`);
                        }

                        // there have been cases where the server does not honor the range header.
                        // since we'll be reading the entire response into memory, protect against accidentally
                        // reading a very large amount of data into memory. For example, if the server responds with
                        // an entire 1GB file even though we only requested a portion of that file, avoid reading
                        // the whole 1GB into memory.
                        if (contentLength !== contentRange.length) {
                            throw Error(`Server does not seem to have respected Range header. Expected range ${contentRange.low}-${contentRange.high}, content length is ${contentLength}B`);
                        }

                        console.log("Converting stream to buffer to get response data");
                        const buffer = await streamToBuffer(HTTP.METHOD.GET, transferPart.source.url, response.status, response.body, contentLength);
                        await this.randomFileAccess.write(targetUrl, contentRange, buffer, totalSize);
                    }, this.options);
                }

                controller.notify(TransferEvents.AFTER_TRANSFER, this.name, transferPart);
                yield transferPart;
            } catch (error) {
                const stringifiedError = JSON.stringify(error);
                if (stringifiedError !== "{}") {
                    logger.error(`Error during transfer: ${stringifiedError}`);
                } else {
                    logger.error(`Error during transfer: ${error}`);
                }
                controller.notifyError(this.name, error, transferPart);
            }
        }
    }
}

module.exports = {
    Transfer
};
