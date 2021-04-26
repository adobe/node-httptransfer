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

const DRange = require("drange");
const PRIVATE = Symbol("PRIVATE");

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
 * Track progress and completion
 */
class TransferTracker {
    /**
     * Construct a transfer tracker
     */
    constructor() {
        this[PRIVATE] = {
            trackedAssets: new Map(),
            bytesTransferred: 0
        };
    }

    /**
     * Check to see if the asset behind the given transfer part is already tracked
     * 
     * @param {TransferPart} transferPart Transfer part
     * @returns {Boolean} True if no progress has been recorded yet for this asset
     */
    isStart(transferPart) {
        const sourceUrl = transferPart.source.url;
        return !this[PRIVATE].trackedAssets.get(sourceUrl);
    }

    /**
     * Determine how many bytes have been transferred so far
     * 
     * @param {TransferPart} transferPart 
     * @returns {Number} Bytes transferred for the asset behind the part
     */
    getTransferred(transferPart) {
        // find/create a record for all transferred parts
        const sourceUrl = transferPart.source.url;
        const trackedSource = this[PRIVATE].trackedAssets.get(sourceUrl);
        if (trackedSource) {
            return trackedSource.finishedParts.length;
        } else {
            return 0;
        }
    }

    /**
     * Record transfer progress
     * 
     * @param {TransferPart} transferPart Transfer part that has been completed
     * @returns {Boolean} True if the asset has been completed
     */
    record(transferPart) {
        // record the number of bytes transferred
        this[PRIVATE].bytesTransferred += transferPart.contentRange.length;

        // find/create a record for all transferred parts
        const sourceUrl = transferPart.source.url;
        let trackedSource = this[PRIVATE].trackedAssets.get(sourceUrl);
        if (!trackedSource) {
            trackedSource = {
                finishedParts: new DRange(),
                errors: []
            };
            this[PRIVATE].trackedAssets.set(sourceUrl, trackedSource);
        }

        // record range
        trackedSource.finishedParts.add(transferPart.contentRange);

        // check if the transfer has been completed
        return isComplete(trackedSource.finishedParts, transferPart.metadata.contentLength);
    }
}

module.exports = {
    TransferTracker
};