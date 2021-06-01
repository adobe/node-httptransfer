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

const { TransferAsset } = require("../asset/transferasset");
const { TransferEvent } = require("../controller/transferevent");
const { AsyncGeneratorFunction } = require("../generator/function");

/**
 * Filter out failed assets
 */
class FailUnsupportedAssets extends AsyncGeneratorFunction {
    /**
     * Fail unsupported assets
     * 
     * @param {TransferAsset[]|AsyncGenerator|Generator} transferAssets Transfer assets
     * @param {TransferController} controller Transfer controller
     * @yields {TransferAsset} 
     */
    async* execute(transferAssets, controller) {
        for await (const transferAsset of transferAssets) {
            try {
                controller.notifyBefore(new TransferEvent(this.name, transferAsset));

                const contentLength = transferAsset.metadata && transferAsset.metadata.contentLength;
                if (!Number.isFinite(contentLength) || (contentLength < 1) ) {
                    throw Error("")
                }

                controller.notifyAfter(new TransferEvent(this.name, transferAsset));
            } catch (error) {
                controller.notifyFailure(new TransferEvent(this.name, transferAsset, {
                    error
                }));
            }        
        }
    }
}

module.exports = {
    FailUnsupportedAssets
};