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
const DRange = require("drange");
const { TransferEvents } = require("../controller/transfercontroller");

/**
 * Check if all parts have completed
 * 
 * @param {DRange} finishedParts Finished parts
 * @param {Number} contentLength Content length
 * @returns {Boolean} True if the parts have been completed
 */
function isComplete(finishedParts, contentLength) {
    const subRanges = finishedParts.subranges();
    return subRanges && (subRanges.length === 1) && 
        (subRanges[0].low === 0) && (subRanges[0].high === contentLength - 1);
}

/**
 * Complete upload/download of assets in/to AEM.
 */
class JoinTransferParts extends AsyncGeneratorFunction {
    /**
     * Construct the JoinTransferParts function.
     */
    constructor() {
        super();
        this.trackedAssets = new Map();
        this.totalTransferredBytes = 0;
    }

    /**
     * Track progress and completion
     * 
     * notifyBefore -> the transfer parts as received with progress update
     * notifyAfter  -> each transfer asset once complete before yielded
     * notifyYield  -> each transfer asset once complete after yielded
     * 
     * @param {TransferPart} transferParts Part that has transferred (or failed to)
     * @param {TransferController} controller Transfer controller
     * @returns {TransferPart} 
     */
    async* execute(transferParts, controller) {
        for await (const transferPart of transferParts) {      
            const transferAsset = transferPart.transferAsset;     
            try {
                // find/create a record for all transferred parts
                let trackedAsset = this.trackedAssets.get(transferAsset);
                if (!trackedAsset) {
                    trackedAsset = {
                        completedRanges: new DRange()
                    };
                    this.trackedAssets.set(transferAsset, trackedAsset);
                }

                // record progress
                const { completedRanges } = trackedAsset;
                completedRanges.add(transferPart.contentRange);
                this.totalTransferredBytes += transferPart.contentRange.length;
                controller.notify(TransferEvents.JOIN_TRANSFER_PARTS, this.name, transferPart, {
                    transferBytes: completedRanges.length,
                    totalTransferredBytes: this.totalTransferredBytes
                });

                // check if the transfer has been completed
                const contentLength = transferPart.metadata.contentLength;
                if (isComplete(completedRanges, contentLength)) {
                    transferAsset.transferEndTime = Date.now();
                    this.trackedAssets.delete(transferAsset);
                    controller.notify(TransferEvents.AFTER_JOIN_TRANSFER_PARTS, this.name, transferAsset);
                    yield transferAsset;
                }
            } catch (error) {
                controller.notifyError(this.name, error, transferPart);
            }
        }
    }
}

module.exports = {
    JoinTransferParts
};