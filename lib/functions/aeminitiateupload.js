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

const { AssetMetadata } = require("../asset/assetmetadata");
const { AssetMultipart } = require("../asset/assetmultipart");
const { AsyncGeneratorFunction } = require("../generator/function");
const UploadError = require("../block/upload-error");
const ErrorCodes = require("../http-error-codes");
const { postForm } = require("../fetch");
const { getCSRFToken } = require("../csrf");
const { retry } = require("../retry");
const logger = require("../logger");
const { TransferEvents } = require("../controller/transfercontroller");
const { MIMETYPE } = require("../constants");

/**
 * @typedef {Object} AEMInitiateUploadOptions
 * @property {Number} [timeout=30000] Socket timeout
 * @property {Number} [retryMaxCount] number of retry attempts, overrides retryMaxDuration
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Object} [requestOptions] Options that will be passed to fetch (either node-fetch-npm or native fetch, depending on the context)
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
        return batchTarget.folderUrl.toString() === target.folderUrl.toString();
    }

    /**
     * Initiates the upload of the given assets
     * 
     * notifyBefore: For each transfer asset added to the batch
     * notifyAfter: For each transfer asset after the initiate upload
     * notifyYield: For each transfer asset after it is yielded
     * 
     * @generator
     * @param {TransferAsset[]|Generator||AsyncGenerator} assets Transfer assets, target going to AEM
     * @param {TransferController} controller Transfer controller
     * @yields {TransferAsset} Transfer asset
     */
    async* execute(transferAssets, controller) {
        const assets = [];   
        const form = new URLSearchParams();
        for await (const transferAsset of transferAssets) {
            controller.notify(TransferEvents.AEM_INITIATE_UPLOAD, this.name, transferAsset);
            assets.push(transferAsset);
            form.append("fileName", transferAsset.target.filename);
            form.append("fileSize", transferAsset.metadata.contentLength);
        }
        if (assets.length === 0) {
            logger.warn("AEMInitiateUpload.execute on empty set of transfer assets");
            return;
        }

        try {
            const folderUrl = assets[0].target.folderUrl;
            const headers = assets[0].target.headers || {};

            // eslint-disable-next-line no-undef
            if ((typeof window !== 'undefined') && (typeof window.document !== 'undefined')) {
                const origin = new URL(folderUrl).origin;
                headers['csrf-token'] = await getCSRFToken(origin, this.options, assets[0].target.headers);
            }

            const initiateResponse = await retry(async () => {
                return postForm(`${folderUrl}.initiateUpload.json`, form, {
                    timeout: this.options && this.options.timeout,
                    headers,
                    ...this.options.requestOptions
                });
            }, this.options);
            if (!Array.isArray(initiateResponse.files) || (typeof initiateResponse.completeURI !== "string")) {
                throw new UploadError('Target AEM instance does not have direct binary upload enabled. Falling back to create asset servlet.', ErrorCodes.NOT_SUPPORTED);
            } else if (initiateResponse.files.length !== assets.length) {
                throw Error(`'files' field incomplete in initiateUpload response (expected files: ${assets.length}): ${JSON.stringify(initiateResponse)}`);
            }

            // yield one or more smaller transfer parts if the source accepts ranges and the content length is large enough
            const files = initiateResponse.files;
            const completeUrl = new URL(initiateResponse.completeURI, folderUrl);
            for (let i = 0; i < assets.length; ++i) {
                const transferAsset = assets[i];
                const { minPartSize, maxPartSize, uploadURIs, mimeType, uploadToken } = files[i];

                // validate response from the server
                if (!Number.isFinite(minPartSize) || !Number.isFinite(maxPartSize) || !Array.isArray(uploadURIs) || (uploadURIs.length === 0)) {
                    throw Error(`invalid multi-part information for ${transferAsset.target.url}: ${JSON.stringify(files[i])}`);
                }
                if (minPartSize < 1) {
                    throw Error(`invalid minPartSize for ${transferAsset.target.url}: ${JSON.stringify(files[i])}`);
                }
                if (maxPartSize < minPartSize) {
                    throw Error(`invalid maxPartSize for ${transferAsset.target.url}: ${JSON.stringify(files[i])}`);
                }
                if (uploadURIs.findIndex(value => typeof value !== "string") !== -1) {
                    throw Error(`invalid upload url for ${transferAsset.target.url}: ${JSON.stringify(files[i])}`);
                }
                if (mimeType && typeof mimeType !== "string") {
                    throw Error(`invalid mimetype for ${transferAsset.target.url}: ${JSON.stringify(files[i])}`);
                }
                if (typeof uploadToken !== "string") {
                    throw Error(`invalid uploadToken for ${transferAsset.target.url}: ${JSON.stringify(files[i])}`);
                }

                // if the client has no mimetype specified, use the mimetype provided by AEM
                // if AEM cannot detect a mimetype default to application/octet-stream
                if (!transferAsset.metadata.contentType) {
                    let contentType = mimeType;
                    if (!contentType) {
                        contentType = MIMETYPE.APPLICATION_OCTET_STREAM;
                    }
                    transferAsset.metadata = new AssetMetadata(
                        transferAsset.metadata.filename,
                        contentType,
                        transferAsset.metadata.contentLength
                    );
                }              

                transferAsset.multipartTarget = new AssetMultipart(
                    uploadURIs,
                    minPartSize,
                    maxPartSize,
                    transferAsset.target.multipartHeaders,
                    completeUrl,
                    uploadToken
                );
            }
            for (const transferAsset of assets) {
                controller.notify(TransferEvents.AFTER_AEM_INITIATE_UPLOAD, this.name, transferAsset);
                yield transferAsset;
            }
        } catch (error) {
            for (const transferAsset of assets) {
                controller.notifyError(this.name, error, transferAsset);
            }           
        }
    }
}

module.exports = {
    AEMInitiateUpload
};
