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
const { TransferEvents } = require("../transfercontroller");
const DRange = require("drange");

/**
 * Check if all parts have completed
 * 
 * @param {DRange} finishedParts Finished parts
 * @param {Number} contentLength Content length
 * @returns {Boolean} True if the parts have been completed
 */
function isComplete(finishedParts, contentLength) {
    const subRanges = finishedParts.subranges();
    return (subRanges.length === 1) && 
        (subRanges[0].low === 0) && (subRanges[0].high === contentLength - 1);
}

/**
 * Complete upload of assets in AEM.
 */
class JoinTransferParts extends AsyncGeneratorFunction {
    /**
     * Construct the JoinTransferParts function.
     * 
     * @param {TransferController} controller Transfer controller
     */
    constructor(controller) {
        super();
        this.controller = controller;
        this.trackedAssets = new Map();
        this.totalTransferredBytes = 0;
    }

    /**
     * Track progress and completion
     * 
     * @param {TransferPart} transferParts Part that has transferred (or failed to)
     * @returns {TransferPart} 
     */
    async* execute(transferParts) {
        for await (const transferPart of transferParts) {
            // find/create a record for all transferred parts
            const transferAsset = transferPart.transferAsset;
            // TODO: sourceUrl is not sufficient, it puts a restriction that we can only transfer a source to a single target
            const sourceUrl = transferAsset.source.url;
            let trackedAsset = this.trackedAssets.get(sourceUrl);
            if (!trackedAsset) {
                trackedAsset = {
                    completedRanges: new DRange()
                };
                this.trackedAssets.set(sourceUrl, trackedAsset);
                this.controller.emit(TransferEvents.TRANSFER_START, {
                    transferAsset
                });
            }

            // record progress
            const { completedRanges } = trackedAsset;
            completedRanges.add(transferPart.contentRange);
            this.totalTransferredBytes += transferPart.contentRange.length;
            this.controller.emit(TransferEvents.TRANSFER_PROGRESS, {
                transferAsset,
                transferPart,
                transferBytes: completedRanges.length,
                totalTransferredBytes: this.totalTransferredBytes
            });

            // check if the transfer has been completed
            const contentLength = transferPart.metadata.contentLength;
            // console.log(transferAsset.source, completedRanges, contentLength);
            if (isComplete(completedRanges, contentLength)) {
                this.controller.emit(TransferEvents.TRANSFER_COMPLETE, {
                    transferAsset
                });                
                yield transferAsset;
            }
        }
    }
}

module.exports = {
    JoinTransferParts
};