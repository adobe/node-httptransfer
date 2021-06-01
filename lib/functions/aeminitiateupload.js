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

require("core-js/stable");

const { AssetMultipart } = require("../asset/assetmultipart");
const { AsyncGeneratorFunction } = require("../generator/function");
const { postForm } = require("../fetch");
const { retry } = require("../retry");
const { TransferEvent } = require("../controller/transferevent");
const logger = require("../logger");

/**
 * Initiate upload
 * 
 * @param {TransferAsset[]} transferAssets Transfer assets
 * @param {AEMInitiateUploadOptions} [options] Initiate upload options
 */
async function initiateUpload(transferAssets, options) {
    // initiate upload in batches
    const form = new URLSearchParams();
    for (const transferAsset of transferAssets) {
        form.append("fileName", transferAsset.target.filename);
        form.append("fileSize", transferAsset.metadata.contentLength);
    }

    // submit batch
    const folderUrl = getFolderUrl(transferAssets[0].target.url);
    const initiateResponse = await retry(async () => {
        return postForm(`${folderUrl}.initiateUpload.json`, form, {
            timeout: options && options.timeout,
            headers: assets[0].target.headers
        });
    }, options);
    if (!Array.isArray(initiateResponse.files)) {
        throw Error(`No files returned from initiateUpload: ${initiateResponse}`);
    } else if (initiateResponse.files.length !== transferAssets.length) {
        throw Error(`Number of files returned from initiateUpload does not match number of assets sent. Requested: ${transferAssets.length}, Received: ${initiateResponse.files.length}`);
    } else if (typeof initiateResponse.completeURI !== "string") {
        throw Error(`Invalid completeURI: ${initiateResponse.completeURI}`);
    }

    // yield one or more smaller transfer parts if the source accepts ranges and the content length is large enough
    const files = initiateResponse.files;
    const completeUrl = new URL(initiateResponse.completeURI, folderUrl);
    for (let i = 0; i < transferAssets.length; ++i) {
        const transferAsset = transferAssets[i];
        const { minPartSize, maxPartSize, uploadURIs, uploadToken } = files[i];
        // uploadToken is opaque to us, we just need to send it back with the completeUpload
        if (!isValidNumber(minPartSize) || !isValidNumber(maxPartSize) || !Array.isArray(uploadURIs) || (uploadURIs.length === 0)) {
            throw Error(`Invalid multi-part information for ${transferAsset.target.url}: ${files[i]}`);
        }
        transferAsset.multipartTarget = new AssetMultipart(
            uploadURIs,
            minPartSize,
            maxPartSize,
            undefined,
            completeUrl,
            uploadToken
        );
    }
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
     * @param {AEMInitiateUploadOptions} [options] Options to initiate upload
     */
    constructor(options) {
        super();
        this.options = options;
    }

    /**
     * Check if the given asset can be added to the batch of assets
     * 
     * @param {TransferAsset[]} batch Current batch of transfer assets (may be empty)
     * @param {TransferAsset} transferAsset Transfer asset to check
     * @returns {Boolean} True if the asset can be added to
     */
    checkAddBatch(batch, transferAsset) {
        const batchTarget = batch[0].target;
        const target = transferAsset.target;
        return getFolderUrl(batchTarget.url).toString() === getFolderUrl(target.url).toString();
    }

    /**
     * Initiates the upload of the given assets
     * 
     * notifyBefore: For each transfer asset added to the batch
     * notifyAfter: For each transfer asset after the initiate upload
     * notifyYield: For each transfer asset after it is yielded
     * 
     * @generator
     * @param {TransferAsset[]|Generator||AsyncGenerator} transferAssets Transfer assets, target going to AEM
     * @param {TransferController} controller Transfer controller
     * @yields {TransferAsset} Transfer asset
     */
    async* execute(transferAssetsGen, controller) {
        // gather batch
        const transferAssets = [];            
        for await (const transferAsset of transferAssetsGen) {
            controller.notifyBefore(this.name, transferAsset);
            transferAssets.push(transferAsset);
        }
        if (transferAssets.length === 0) {
            logger.warn("AEMInitiateUpload.execute on empty set of transfer assets");
            return;
        }

        try {
            await initiateUpload(transferAssets, this.options);

            for (const transferAsset of transferAssets) {
                controller.notifyAfter(this.name, transferAsset);
                yield transferAsset;
                controller.notifyYield(this.name, transferAsset);
            }
        } catch (error) {
            for (const transferAsset of transferAssets) {
                controller.notifyFailure(this.name, error, transferAsset);
            }           
        }
    }
}

module.exports = {
    AEMInitiateUpload
};