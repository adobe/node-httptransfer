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

const { AsyncGeneratorFunction } = require("../generator/function");

/**
 * Filter out failed assets
 */
class FilterFailedAssets extends AsyncGeneratorFunction {
    /**
     * Filter out failed transfer items, so we don't waste time transferring assets
     * and parts of assets that have failed.
     * 
     * @param {TransferPart[]|TransferAsset[]|AsyncGenerator|Generator} transferItems Transfer assets or parts
     * @param {TransferController} controller Transfer controller
     * @yields {TransferPart|TransferAsset} 
     */
    async* execute(transferItems, controller) {
        for await (const transferItem of transferItems) {
            if (!controller.hasFailed(transferItem)) {
                yield transferItem;
            }
        }
    }
}

module.exports = {
    FilterFailedAssets
};