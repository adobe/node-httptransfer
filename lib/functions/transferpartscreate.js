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

const logger = require("../logger");
const { AsyncGeneratorFunction } = require("../generator/function");
const { TransferPart } = require("../asset/transferpart");
const { calculatePartSize, generatePartRanges } = require("../aempartsize");
const { isFileProtocol } = require("../util");
const DRange = require("drange");
const { TransferEvents } = require("../controller/transfercontroller");

const DEFAULT_FILE_TARGET_PART_SIZE = 10485760;

/**
 * @typedef {Object} CreateTransferPartsOptions
 * @property {Number} [preferredPartSize] Preferred part size, defaults to 10MB when the target is a file:// url
 */
/**
 * Split TransferAsset to TransferParts
 * 
 * Supports:
 * 
 * - Multi-part targets where the transfer asset has multipartTarget
 * - File targets which allow random-access writes
 * 
 * If the source does not support range requests, or the target is not a multi-part target or file it
 * will default in a single part transfer.
 */
class CreateTransferParts extends AsyncGeneratorFunction {
    /**
     * Construct the CreateTransferParts function.
     * 
     * @param {CreateTransferPartsOptions} [options] Options to split source parts
     */
    constructor(options) {
        super();
        this.preferredPartSize = options && options.preferredPartSize;
    }

    /**
     * Split TransferAsset to TransferParts using a fixed size part size.
     * 
     * notifyBefore -> the transfer assets as received
     * notifyAfter  -> each transfer part before yielded
     * notifyYield  -> each transfer part after yielded
     * 
     * @generator
     * @param {TransferAsset[]|Generator||AsyncGenerator} transferAssets Transfer assets, target going to AEM
     * @param {TransferController} controller Transfer controller
     * @yields {TransferPart} Transfer part
     */
    async* execute(transferAssets, controller) {
        for await (const transferAsset of transferAssets) {
            try {
                controller.notify(TransferEvents.CREATE_TRANSFER_PARTS, this.name, transferAsset);
                console.log(`Server accepts ranges for this transfer asset: ${transferAsset.acceptRanges}`);

                const contentLength = transferAsset.metadata.contentLength;
                if (transferAsset.acceptRanges && transferAsset.multipartTarget) {
                    const { targetUrls, minPartSize, maxPartSize, headers: targetHeaders } = transferAsset.multipartTarget;
                    const partSize = calculatePartSize(targetUrls.length, contentLength, minPartSize, maxPartSize, this.preferredPartSize);
                    let idx = 0;
                    for (const range of generatePartRanges(contentLength, partSize)) {
                        const transferPart = new TransferPart(transferAsset, [targetUrls[idx]], range, targetHeaders);
                        controller.notify(TransferEvents.AFTER_CREATE_TRANSFER_PARTS, this.name, transferPart);
                        yield transferPart;
                        ++idx;
                    }   
                    console.log(`${idx} transfer parts created (multipart target)`);
                } else if (transferAsset.acceptRanges && isFileProtocol(transferAsset.target.url)) {
                    const targetUrls = [transferAsset.target.url];
                    const partSize = this.preferredPartSize || DEFAULT_FILE_TARGET_PART_SIZE;
                    let idx = 0;
                    for (const range of generatePartRanges(contentLength, partSize)) {
                        const transferPart = new TransferPart(transferAsset, targetUrls, range, transferAsset.target.headers);
                        controller.notify(TransferEvents.AFTER_CREATE_TRANSFER_PARTS, this.name, transferPart);
                        yield transferPart;
                        ++idx;
                    }
                    console.log(`${idx} transfer parts created (target uses file protocol)`);
                } else {
                    const targetUrls = [transferAsset.target.url];
                    const contentRange = new DRange(0, contentLength - 1);
                    const transferPart = new TransferPart(transferAsset, targetUrls, contentRange, transferAsset.target.headers);
                    controller.notify(TransferEvents.AFTER_CREATE_TRANSFER_PARTS, this.name, transferAsset);
                    yield transferPart;
                }
            } catch (error) {
                logger.error(`Error during transfer parts creation: ${JSON.stringify(error)}`);
                controller.notifyError(this.name, error, transferAsset);
            }
        }
    }
}

module.exports = {
    CreateTransferParts
};