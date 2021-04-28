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

const { AsyncFunction } = require("../generator/function");
const { isFileProtocol } = require("../util");
const { issuePut } = require("../fetch");
const { retry } = require("../retry");

const MAX_MEMORY_BUFFER = 100*1024*1024;

/**
 * @typedef {Object} TransferOptions
 *
 * @property {Number} [timeout] Optional socket timeout
 * @property {Object} [headers] Optional override of request headers
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Transfer parts
 */
class Transfer extends AsyncFunction {
    /**
     * Construct a transfer function
     * 
     * @param {RandomFileAccess} randomFileAccess Random file access instance
     * @param {TransferOptions} [options] Transfer options
     */
    constructor(randomFileAccess, options) {
        super();
        this.randomFileAccess = randomFileAccess;
        this.options = options;
    }
    /**
     * Transfer a part
     * 
     * @param {TransferPart} transferPart Part to transfer
     * @returns {TransferPart} 
     */
    async execute(transferPart) {
        // console.log("Transfer.execute", transferPart.toString());
        const targetUrl = Array.isArray(transferPart.targetUrls) && (transferPart.targetUrls.length === 1) && transferPart.targetUrls[0];
        const contentRanges = transferPart.contentRange.subranges(); 
        if (contentRanges.length !== 1) {
            throw Error(`Only support a single range at this point: ${contentRanges.length}`);
        }
        const contentRange = contentRanges[0];
        if (contentRange.length > MAX_MEMORY_BUFFER) {
            throw Error(`Content range too large, not supported yet: ${transferPart.source.url}`);
        }
        if (isFileProtocol(transferPart.source.url) && targetUrl) {
            const buf = await this.randomFileAccess.read(transferPart.source.url, contentRange);
            await retry(async () => {
                await issuePut(targetUrl, {
                    body: buf,
                    timeout: this.options && this.options.timeout,
                    // headers: transferPart.target.headers
                });    
            }, this.options);
        } else if (transferPart.source.blob && targetUrl) {
            const blob = transferPart.source.blob.slice(contentRange.low, contentRange.high + 1);
            await retry(async () => {
                await issuePut(targetUrl, {
                    body: blob,
                    timeout: this.options && this.options.timeout,
                    // headers: transferPart.target.headers
                });
            }, this.options);
        }
        return transferPart;
    }
}

module.exports = {
    Transfer
};