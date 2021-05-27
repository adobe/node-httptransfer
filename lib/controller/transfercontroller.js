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

const EventEmitter = require("events");
const { TransferAsset } = require("../asset/transferasset");
const { TransferPart } = require("../asset/transferpart");
const { FailureRecord } = require("./failurerecord");

/**
 * @event TransferController#beforeinitiateupload
 * @type {Object}
 * @property {TransferAsset[]} transferAssets Batch of transfer assets to be initiated for upload
 */
/**
 * @event TransferController#afterinitiateupload
 * @type {Object}
 * @property {TransferAsset[]} transferAssets Batch of transfer assets initiated for upload
 */
/**
 * @event TransferController#beforecompleteupload
 * @type {Object}
 * @property {TransferAsset} transferAsset Transfer asset to be completed
 */
/**
 * @event TransferController#aftercompleteupload
 * @type {Object}
 * @property {TransferAsset} transferAsset Transfer asset completed
 */
/**
 * @event TransferController#transferstart
 * @type {Object}
 * @property {TransferAsset} transferAsset Transfer asset
 */
/**
 * @event TransferController#transferprogress
 * @type {Object}
 * @property {TransferAsset} transferAsset Transfer asset
 * @property {TransferPart} transferPart Transfer part
 * @property {Number} transferBytes Bytes transferred, includes transferPart
 * @property {Number} totalTransferBytes Total amount of bytes transferred, includes transferPart
 */
/**
 * @event TransferController#transfercomplete
 * @type {Object}
 * @property {TransferAsset} transferAsset Transfer asset
 */

/**
 * Transfer events
 */
const TransferEvents = {
    BEFORE_INITIATE_UPLOAD: "beforeinitiateupload",
    AFTER_INITIATE_UPLOAD: "afterinitiateupload",
    BEFORE_COMPLETE_UPLOAD: "beforecompleteupload",
    AFTER_COMPLETE_UPLOAD: "aftercompleteupload",
    TRANSFER_START: "transferstart",
    TRANSFER_PROGRESS: "transferprogress",
    TRANSFER_COMPLETE: "transfercomplete"
};

/**
 * Transfer controller
 */
class TransferController extends EventEmitter {
    /**
     * Construct TransferController
     */
    constructor() {
        this.failedAssets = new Map();
    }

    /**
     * Notify when an asset or one of its parts has failed
     * 
     * @param {TransferAsset} transferAsset Transfer asset
     * @param {Error} error Error that caused the failure
     * @param {TransferPart} [transferPart] Optional transfer part that failed
     */
    notifyFailure(transferAsset, error, transferPart) {
        if (!(transferAsset instanceof TransferAsset)) {
            throw Error();
        }
        if (!(error instanceof Error)) {
            throw Error();
        }
        if (transferPart && !(transferPart instanceof TransferPart)) {
            throw Error();
        }

        let failureRecords = this.failedAssets.get(transferAsset);
        if (!failureRecords) {
            failureRecords = [];
            this.failedAssets.set(transferAsset, failureRecords);
        }

        failureRecords.push(new FailureRecord(error, transferPart));
    }

    /**
     * Check if a given asset has failed
     * 
     * @param {TransferAsset} transferAsset Transfer asset
     * @returns {Boolean} True if the asset has failed
     */
    hasFailed(transferAsset) {
        if (!(transferAsset instanceof TransferAsset)) {
            throw Error();
        }        
        return this.failedAssets.has(transferAsset);
    }
}

module.exports = {
    TransferController,
    TransferEvents
};