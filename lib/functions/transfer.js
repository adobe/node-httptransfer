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

const { AsyncGeneratorFunction } = require("../generator/function");
const { isFileProtocol } = require("../util");
const { issuePut } = require("../fetch");

const MAX_MEMORY_BUFFER = 100*1024*1024;

/**
 * Transfer parts
 */
class Transfer extends AsyncGeneratorFunction {
    /**
     * Construct a transfer function
     * 
     * @param {RandomFileAccess} randomFileAccess Random file access instance
     */
    constructor(randomFileAccess) {
        super();
        this.randomFileAccess = randomFileAccess;
    }
    /**
     * Transfer 
     * 
     * @generator
     * @param {TransferPart[]|AsyncGenerator|Generator} transferRecords 
     * @yields {TransferPart}
     */
    async* execute(transferRecords) {
        for await (const transferPart of transferRecords) {
            const targetUrl = Array.isArray(transferPart.targetUrls) && (transferPart.targetUrls.length === 1) && transferPart.targetUrls[0];
            if (transferPart.contentRange.length > MAX_MEMORY_BUFFER) {
                throw Error(`Content range too large, not supported yet: ${transferPart.source.url}`);
            }
            if (isFileProtocol(transferPart.source.url) && targetUrl) {
                console.log("Upload", transferPart.source.url.toString(), transferPart.contentRange, targetUrl);
                const buf = await this.randomFileAccess.read(transferPart.source.url, transferPart.contentRange.start, transferPart.contentRange.end);
                await issuePut(targetUrl, {
                    // headers: transferPart.target.headers,
                    body: buf
                });
            } else if (transferPart.source.blob && targetUrl) {
                const blob = transferPart.source.blob.slice(transferPart.contentRange.start, transferPart.contentRange.end);
                await issuePut(targetUrl, {
                    // headers: transferPart.target.headers,
                    body: blob
                });
            }
            yield transferPart;
        }
    }
}

module.exports = {
    Transfer
};