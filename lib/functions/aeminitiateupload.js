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
const deepEqual = require("deep-equal");
const { dirname: urlPathDirname, basename: urlPathBasename } = require("path").posix;
const { issuePostJSON } = require("../fetch");
const { retry } = require("../retry");

/**
 * Retrieve the folder URL of an asset URL
 * 
 * @param {URL} assetUrl Asset URL
 * @returns {URL} Folder URL
 */
function getFolderUrl(assetUrl) {
    return new URL(urlPathDirname(assetUrl.pathname), assetUrl);
}

/**
 * Retrieve the filename without path information
 * 
 * @param {URL} assetUrl Asset URL
 * @returns {String} Asset filename without path information
 */
function getFilename(assetUrl) {
    return urlPathBasename(assetUrl.pathname);
}

/**
 * @typedef {Object} AEMInitiateUploadOptions
 * @property {Number} [timeout] Socket timeout
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Initiate upload of assets in AEM.
 */
class AEMInitiateUpload extends AsyncGeneratorFunction {
    /**
     * Construct the AEMInitiateUpload function.
     * 
     * @param {AEMInitiateUploadOptions} [options] Options to request asset metadata
     */
    constructor(options) {
        super();
        this.options = options;
    }

    /**
     * Check if the given asset can be added to the batch of assets
     * 
     * @param {TransferPart[]} batch Current batch of transfer records (may be empty)
     * @param {TransferPart} transferPart Transfer record to check
     * @returns {Boolean} True if the asset can be added to
     */
    checkAddBatch(batch, transferPart) {
        if (batch.length > 0) {
            const batchTarget = batch[0].target;
            const target = transferPart.target;
            return (getFolderUrl(batchTarget.url).toString() === getFolderUrl(target.url).toString()) &&
                deepEqual(batchTarget.headers, target.headers, { strict: true });
        } else {
            return true;
        }
    }

    /**
     * Initiates the upload of the given assets
     * 
     * @generator
     * @param {TransferPart[]|Generator||AsyncGenerator} transferParts Transfer records, target going to AEM
     * @yields {TransferPart} Transfer record
     */
    async* execute(transferParts) {
        // initiate upload in batches
        const parts = [];
        const form = new URLSearchParams();
        for await (const transferPart of transferParts) {
            parts.push(transferPart);
            form.append("fileName", getFilename(transferPart.target.url));
            form.append("fileSize", transferPart.metadata.contentLength);
        }
        if (parts.length === 0){
            console.warn("AEMInitiateUpload.execute on empty set of transfer records");
            return;
        }

        const folderUrl = getFolderUrl(parts[0].target.url);
        const { files, completeURI } = await retry(async () => {
            return issuePostJSON(`${folderUrl}.initiateUpload.json`, {
                body: form.toString(),
                headers: Object.assign(
                    { "content-type": "application/x-www-form-urlencoded"},
                    parts[0].target.headers
                )
            });
        }, this.options);

        // yield one or more smaller transfer parts if the source accepts ranges and the content length is large enough
        const preferredPartSize = this.options && this.options.preferredPartSize;
        const resolvedCompleteUrl = new URL(completeURI, folderUrl);
        for (let i = 0; i < parts.length; ++i) {
            const part = parts[i];
            const { minPartSize, maxPartSize, uploadURIs, uploadToken } = files[i];
            part.completeUrl = resolvedCompleteUrl;
            part.uploadToken = uploadToken;            
            yield* part.split(uploadURIs, minPartSize, maxPartSize, preferredPartSize);
        }
    }
}

module.exports = {
    AEMInitiateUpload
};