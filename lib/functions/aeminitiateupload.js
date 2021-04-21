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
const axios = require("axios");
const { AEMMultipartAsset } = require("../asset/aemmultipart");
const { TransferAsset } = require("../asset/transferasset");

/**
 * @typedef {Object} Headers
 */
/**
 * Initiate upload of assets in AEM.
 * 
 * TransferAsset{Asset, AEMAsset} -> TransferAsset{Asset, AEMMultipartAsset}
 */
class AEMInitiateUpload extends AsyncGeneratorFunction {
    /**
     * Construct function
     * 
     * @param {Headers} headers Headers to send to AEM
     */
    constructor(headers) {
        super();
        this.headers = Object.assign({}, headers);
    }

    /**
     * Check if the given asset can be added to the batch of assets
     * 
     * @param {TransferAsset[]} batch Current batch of assets (may be empty)
     * @param {TransferAsset} transferAsset Asset to check
     * @returns {Boolean} True if the asset can be added to
     */
    checkAddBatch(batch, transferAsset) {
        if (!(transferAsset.target instanceof AEMMultipartAsset)) {
            throw Error(`Transfer asset target not of type AEMMultipartAsset: ${transferAsset}`);
        }
        if (batch.length > 0) {
            const batchTarget = batch[0].target;
            const transferAssetTarget = transferAsset.target;
            return (batchTarget.folderUri === transferAssetTarget.folderUri) &&
                deepEqual(batchTarget.headers, transferAssetTarget.headers, { strict: true });
        } else {
            return true;
        }
    }

    /**
     * Initiates the upload of the given assets
     * 
     * @generator
     * @param {TransferAsset[]|Generator||AsyncGenerator} transferAssets Transfer assets with a target of AEMAsset  
     * @yields {TransferAsset} Transfer asset with a target of AEMMultipartAsset
     */
    async* execute(transferAssets) {
        // accumulate transfer assets, filename, and file sizes
        const sources = [];
        const targets = [];
        const fileName = [];
        const fileSize = [];
        for await (const { source, target} of transferAssets) {
            if (!(target instanceof AEMMultipartAsset)) {
                throw Error(`Asset target not of type AEMMultipartAsset: ${target}, source: ${source}`);
            }
            sources.push(source);
            targets.push(target);
            fileName.push(target.filename);
            fileSize.push(target.contentLength);
        }
        if (sources.length === 0){
            console.warn("AEMInitiateUpload.execute on empty set of transfer assets");
            return;
        }

        // initiate upload in batches
        const folderUri = targets[0].folderUri;
        const response = await axios.post(`${folderUri}.initiateUpload.json`, {
            fileName,
            fileSize
        }, {
            headers: this.headers
        });

        // yield a multi-part target for each input asset
        const { files } = response.data;
        const completeUri = new URL(folderUri, response.data.completeURI).toString();
        for (let i = 0; i < sources.length; ++i) {
            const source  = sources[i];
            const target = targets[i];
            const file = files[i];
            yield new TransferAsset(source, new AEMMultipartAsset(
                file.uploadURIs,
                file.minPartSize,
                file.maxPartSize,
                target.contentType || file.mimeType,
                target.contentLength,
                target,
                completeUri,
                file.uploadToken
            ));
        }
    }
}

module.exports = {
    AEMInitiateUpload
};