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

const { AssetMultipart } = require("../asset/assetmultipart");
const { AsyncGeneratorFunction } = require("../generator/function");
const { TransferEvents } = require("../transfercontroller");
const { dirname: urlPathDirname, basename: urlPathBasename } = require("path").posix;
const { postForm } = require("../fetch");
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
     * @param {TransferController} controller Transfer controller
     * @param {AEMInitiateUploadOptions} [options] Options to initiate upload
     */
    constructor(controller, options) {
        super();
        this.controller = controller;
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
        return (getFolderUrl(batchTarget.url).toString() === getFolderUrl(target.url).toString());
    }

    /**
     * Initiates the upload of the given assets
     * 
     * @generator
     * @param {TransferAsset[]|Generator||AsyncGenerator} transferAssets Transfer assets, target going to AEM
     * @yields {TransferAsset} Transfer asset
     */
    async* execute(transferAssets) {
        // initiate upload in batches
        const assets = [];
        const form = new URLSearchParams();
        for await (const transferAsset of transferAssets) {
            assets.push(transferAsset);
            form.append("fileName", decodeURIComponent(getFilename(transferAsset.target.url)));
            form.append("fileSize", transferAsset.metadata.contentLength);
        }
        if (assets.length === 0){
            console.warn("AEMInitiateUpload.execute on empty set of transfer assets");
            return;
        }

        // notify
        this.controller.emit(TransferEvents.BEFORE_INITIATE_UPLOAD, {
            transferAssets: assets
        });

        // submit batch
        const folderUrl = getFolderUrl(assets[0].target.url);
        const { files, completeURI } = await retry(async () => {
            return postForm(`${folderUrl}.initiateUpload.json`, form, {
                timeout: this.options && this.options.timeout,
                headers: assets[0].target.headers
            });
        }, this.options);

        // yield one or more smaller transfer parts if the source accepts ranges and the content length is large enough
        const resolvedCompleteUrl = new URL(completeURI, folderUrl);
        for (let i = 0; i < assets.length; ++i) {
            const transferAsset = assets[i];
            const { minPartSize, maxPartSize, uploadURIs, uploadToken } = files[i];
            transferAsset.multipartTarget = new AssetMultipart(
                uploadURIs,
                minPartSize,
                maxPartSize,
                undefined,
                resolvedCompleteUrl,
                uploadToken
            );
        }

        // notify
        this.controller.emit(TransferEvents.AFTER_INITIATE_UPLOAD, {
            transferAssets: assets
        });

        yield* assets;
    }
}

module.exports = {
    AEMInitiateUpload
};