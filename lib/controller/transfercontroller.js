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
const { IllegalArgumentError } = require("../error");
const { TransferAsset } = require("../asset/transferasset");
const { TransferEvent } = require("./transferevent");

/**
 * @event TransferController#before
 * @type {TransferEvent}
 */
/**
 * @event TransferController#after
 * @type {TransferEvent}
 */
/**
 * @event TransferController#yield
 * @type {TransferEvent}
 */
/**
 * @event TransferController#failure
 * @type {TransferEvent}
 */

/**
 * Transfer events
 */
const TransferEvents = {
    BEFORE: "before",
    AFTER: "after",
    YIELD: "yield",
    FAILURE: "failure"
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
     * Notify before a function is executed on an asset/part
     * 
     * @param {String} functionName Function name
     * @param {TransferAsset} transferAsset Transfer asset
     * @param {TransferEventOptional} [optional] Optional transfer part
     * @param {Object} [props] Optional properties
     */
    notifyBefore(functionName, transferAsset, transferPart, props) {
        if (transferPart && !(transferPart instanceof TransferPart)) {
            props = transferPart;
        }
        this.emit(TransferEvents.BEFORE, new TransferEvent(
            functionName, 
            undefined, 
            transferAsset, 
            transferPart,
            props
        ));
    }

    /**
     * Notify after a function has been executed on an asset/part
     * 
     * @param {String} functionName Function name
     * @param {TransferAsset} transferAsset Transfer asset
     * @param {TransferEventOptional} [optional] Optional transfer part
     * @param {Object} [props] Optional properties
     */
    notifyAfter(functionName, transferAsset, transferPart, props) {
        if (transferPart && !(transferPart instanceof TransferPart)) {
            props = transferPart;
        }
        this.emit(TransferEvents.AFTER, new TransferEvent(
            functionName, 
            undefined, 
            transferAsset, 
            transferPart,
            props
        ));
    }

    /**
     * Notify after a transfer item has been yielded
     * 
     * @param {String} functionName Function name
     * @param {TransferAsset} transferAsset Transfer asset
     * @param {TransferEventOptional} [optional] Optional transfer part
     * @param {Object} [props] Optional properties
     */
    notifyYield(functionName, transferAsset, transferPart, props) {
        if (transferPart && !(transferPart instanceof TransferPart)) {
            props = transferPart;
        }
        this.emit(TransferEvents.YIELD, new TransferEvent(
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
     * @param {Error} error Error that 
     * @param {TransferAsset} transferAsset Transfer asset
     * @param {TransferPart} [transferPart] Transfer part
     * @param {Object} [props] Optional properties
     */
    notifyFailure(functionName, error, transferAsset, transferPart, props) {
        if (transferPart && !(transferPart instanceof TransferPart)) {
            props = transferPart;
        }
        const event = new TransferEvent(
            functionName, 
            error, 
            transferAsset, 
            transferPart,
            props
        );

        let firstFailure = false;
        let failureEvents = this.failedAssets.get(transferAsset);
        if (!failureEvents) {
            failureEvents = [];
            this.failedAssets.set(transferAsset, failureEvents);
            firstFailure = true;
        }

        failureEvents.push(event);

        if (firstFailure) {
            this.emit(TransferEvents.FAILURE, event);
        }
    }

    /**
     * Check if a given asset has failed
     * 
     * @param {TransferAsset} transferAsset Transfer asset
     * @returns {Boolean} True if the asset has failed
     */
    hasFailed(transferAsset) {
        if (!(transferAsset instanceof transferAsset)) {
            throw new IllegalArgumentError("'transferAsset' must be of type TransferAsset", transferAsset);
        }        
        return this.failedAssets.has(transferAsset);
    }
}

module.exports = {
    TransferController,
    TransferEvents
};