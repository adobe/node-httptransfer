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
const { AEMMultipartAsset } = require("../asset/aemmultipartasset");
const { TransferAsset } = require("../asset/transferasset");
const { isFileProtocol } = require("../util");

/**
 * @typedef {Object} Headers
 */
/**
 * Retrieve asset metadata information from the sources.
 * 
 * TransferAsset{Asset, AEMAsset} -> TransferAsset{Asset, AEMMultipartAsset}
 */
class GetAssetMetadata extends AsyncGeneratorFunction {
    /**
     * Initiates the upload of the given assets
     * 
     * @generator
     * @param {TransferAsset[]|Generator||AsyncGenerator} transferAssets Transfer assets with a target of AEMAsset  
     * @yields {TransferAsset} Transfer asset with a target of AEMMultipartAsset
     */
    async* execute(transferAssets) {
        for await (const transferAsset of transferAssets) {
            if (transferAsset.source) {
                const { source } = transferAsset;
                if (isFileProtocol(source.uri)) {
                    // todo
                } else {
                    // todo
                }
            }
            yield transferAsset;
        }
    }
}

module.exports = {
    GetAssetMetadata
};