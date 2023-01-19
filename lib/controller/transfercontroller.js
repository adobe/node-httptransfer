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
const EventEmitter = require("events");
const { TransferAsset } = require("../asset/transferasset");
const { TransferPart } = require("../asset/transferpart");
const { TransferEvent } = require("./transferevent");
const { unlink } = require("fs");

/**
 * @typedef {Object} TransferItem
 * @property {TransferAsset} transferAsset Transfer asset
 * @property {TransferPart} transferPart Transfer part
 */
/**
 * Split transfer item in to asset and part
 * 
 * @param {TransferAsset|TransferPart} transferItem Transfer asset or part
 * @returns {TransferItem} Split transfer item
 */
function splitTransferItem(transferItem) {
    if (transferItem instanceof TransferAsset) {
        return {
            transferAsset: transferItem,
            transferPart: undefined
        };
    } else if (transferItem instanceof TransferPart) {
        return {
            transferAsset: transferItem.transferAsset,
            transferPart: transferItem
        };
    } else {
        throw Error("Unsupported transfer item");
    }
}

/**
 * @event TransferController#AEMCompleteUpload
 * @type {TransferEvent}
 */
/**
 * @event TransferController#AfterAEMCompleteUpload
 * @type {TransferEvent}
 */
/**
 * @event TransferController#AEMInitiateUpload
 * @type {TransferEvent}
 */
/**
 * @event TransferController#AfterAEMInitiateUpload
 * @type {TransferEvent}
 */
/**
 * @event TransferController#GetAssetMetadata
 * @type {TransferEvent}
 */
/**
 * @event TransferController#AfterGetAssetMetadata
 * @type {TransferEvent}
 */
/**
 * @event TransferController#Transfer
 * @type {TransferEvent}
 */
/**
 * @event TransferController#AfterTransfer
 * @type {TransferEvent}
 */
/**
 * @event TransferController#CreateTransferParts
 * @type {TransferEvent}
 */
/**
 * @event TransferController#AfterCreateTransferParts
 * @type {TransferEvent}
 */
/**
 * @event TransferController#JoinTransferParts
 * @type {TransferEvent}
 */
/**
 * @event TransferController#AfterJoinTransferParts
 * @type {TransferEvent}
 */
/**
 * @event TransferController#error
 * @type {TransferEvent}
 */
/**
 * @typedef {Object} Headers
 */

/**
 * Transfer events
 */
const TransferEvents = {
    AEM_COMPLETE_UPLOAD: "AEMCompleteUpload",
    AFTER_AEM_COMPLETE_UPLOAD: "AfterAEMCompleteUpload",
    AEM_INITIATE_UPLOAD: "AEMInitiateUpload",
    AFTER_AEM_INITIATE_UPLOAD: "AfterAEMInitiateUpload",
    GET_ASSET_METADATA: "GetAssetMetadata",
    AFTER_GET_ASSET_METADATA: "AfterGetAssetMetadata",
    TRANSFER_ASSET: "TransferAsset",
    TRANSFER: "Transfer",
    AFTER_TRANSFER: "AfterTransfer",
    CREATE_TRANSFER_PARTS: "CreateTransferParts",
    AFTER_CREATE_TRANSFER_PARTS: "AfterCreateTransferParts",
    JOIN_TRANSFER_PARTS: "JoinTransferParts",
    AFTER_JOIN_TRANSFER_PARTS: "AfterJoinTransferParts",
    ERROR: "error"
};

/**
 * Transfer controller
 */
class TransferController extends EventEmitter {
    /**
     * Construct TransferController
     */
    constructor() {
        super();
        this.failedAssets = new Map();
    }

    /**
     * Notify before a function is executed on an asset/part
     * 
     * @param {String} functionName Function name
     * @param {TransferAsset|TransferPart} transferItem Transfer asset or part
     * @param {Object} [props] Optional properties
     */
    notify(eventName, functionName, transferItem, props) {
        const { transferAsset, transferPart } = splitTransferItem(transferItem);
        this.emit(eventName, new TransferEvent(
            functionName, 
            undefined, 
            transferAsset, 
            transferPart,
            props
        ));
    }

    /**
     * Notify when an asset or one of its parts has failed
     * 
     * @param {String} functionName Function name
     * @param {Error} error Error that happened
     * @param {TransferAsset|TransferPart} transferItem Transfer asset or part
     * @param {Object} [props] Optional properties
     */
    notifyError(functionName, error, transferItem, props) {
        const { transferAsset, transferPart } = splitTransferItem(transferItem);

        let firstError = false;
        let failureEvents = this.failedAssets.get(transferAsset);
        if (!failureEvents) {
            failureEvents = [];
            this.failedAssets.set(transferAsset, failureEvents);
            firstError = true;
        }

        const event = new TransferEvent(
            functionName, 
            error, 
            transferAsset, 
            transferPart,
            Object.assign({}, props, {
                firstError
            })
        );
        failureEvents.push(event);
        logger.warn(`${failureEvents.length}th failure event recorded: ${error}`);

        this.emit(TransferEvents.ERROR, event);
    }

    /**
     * Check if a given asset has failed
     * 
     * @param {TransferAsset|TransferPart} transferItem Transfer asset or part
     * @returns {Boolean} True if the asset has failed
     */
    hasFailed(transferItem) {
        const { transferAsset } = splitTransferItem(transferItem);
        return this.failedAssets.has(transferAsset);
    }

    /**
     * Check if there were any failed transfers
     * 
     * @returns {Boolean} true if any asset transfer errors were recorded
     */
    hasAnyFailed() {
        return this.failedAssets.size > 0;
    }

    /**
     * Purge any incompleted downloads, for uploads this has no effect
     */

    async cleanupFailedTransfers() {
        this.failedAssets.forEach((transferEvent, transferItem) => {
            const { transferAsset } = splitTransferItem(transferItem);
            if (transferAsset.target.url.pathname) {
                logger.warn(JSON.stringify({
                    "cleanup_failed_download" : {
                        transferItem,
                        errors: this.failedAssets[transferAsset]
                    }
                }));
                try {
                    unlink(transferAsset.target.url.pathname);
                } catch (error) {
                    // continues clean-up even if one of the items to clean up may fail
                    logger.warn(`Error ${JSON.stringify(error)} trying to unlink failed asset ${transferAsset.target.url.pathname}`);
                }
            }
        });
    }
}

module.exports = {
    TransferController,
    TransferEvents
};