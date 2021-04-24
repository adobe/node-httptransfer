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

/**
 * @typedef {Object} SplitTransferAssetsResult
 * @property {Asset[]|Generator|AsyncGenerator} sources Source assets
 * @property {Asset[]|AEMAsset[]|AEMMultipartAsset[]|Generator|AsyncGenerator} targets Target assets
 */
/**
 * Splits transfer assets in to sources and targets
 * 
 * @param {TransferAsset[]|Generator|AsyncGenerator} transferAssets Transfer assets
 * @returns {SplitTransferAssetsResult} Sources and targets
 */
async function splitTransferAssets(transferAssets) {
    const sources = [];
    const targets = [];
    for await (const transferAsset of transferAssets) {
        sources.push(transferAsset.source);
        targets.push(transferAsset.target);
    }
    return { sources, targets };
}

module.exports = {
    splitTransferAssets
};