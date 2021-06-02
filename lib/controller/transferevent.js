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
const { TransferPart } = require("../asset/transferpart");
const { IllegalArgumentError } = require("../error");

const PRIVATE = Symbol("PRIVATE");

/**
 * Transfer event
 */
class TransferEvent {
    /**
     * Construct a transfer event
     * 
     * @param {String} functionName Name of function that generated the event
     * @property {Error} [error] Error related to the event
     * @param {TransferAsset} transferAsset Transfer asset
     * @property {TransferPart} [transferPart] Optional transfer part
     * @property {Object} [props] Event specific properties
     */
    constructor(functionName, error, transferAsset, transferPart, props) {
        if (!(typeof functionName === "string")) {
            throw new IllegalArgumentError("'functionName' must be of type String", functionName);
        }
        if (!(transferAsset instanceof TransferAsset)) {
            throw new IllegalArgumentError("'transferAsset' must be of type TransferAsset", transferAsset);
        }
        if (transferPart && !(transferPart instanceof TransferPart)) {
            throw new IllegalArgumentError("'transferPart' must be of type TransferPart", transferPart);
        }
        if (error && !(error instanceof Error)) {
            throw new IllegalArgumentError("'error' must be of type Error", error);
        }
        this[PRIVATE] = {
            functionName,
            transferAsset,
            transferPart,
            error,
            props: props || {}
        };
    }

    /**
     * Name of function that generated the event
     * 
     * @returns {String} Name of function that generated the event
     */
    get functionName() {
        return this[PRIVATE].functionName;
    }

    /**
     * Transfer asset related to the event
     * 
     * @returns {TransferAsset} Transfer asset related to the event
     */
    get transferAsset() {
        return this[PRIVATE].transferAsset;
    }

    /**
     * Transfer part related to the event
     * 
     * @returns {TransferPart} Transfer part related to the event, or undefined if not provided
     */
    get transferPart() {
        return this[PRIVATE].transferPart;
    }

    /**
     * Error related to the event
     * 
     * @returns {Error} Error related to the event, or undefined if not provided
     */
    get error() {
        return this[PRIVATE].error;
    }

    /**
     * Event specific properties
     * 
     * @returns {Object} Name/value pairs of event specific properties
     */
    get props() {
        return this[PRIVATE].props;
    }
}

module.exports = {
    TransferEvent
};
