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

const EventEmitter = require("events");

/**
 * @event
 * @typedef {Object} TransferStartEvent
 * @property {TransferAsset} transferAsset Transfer asset
 */
/**
 * @event
 * @typedef {Object} TransferProgressEvent
 * @property {TransferAsset} transferAsset Transfer asset
 * @property {TransferPart} transferPart Transfer part
 * @property {Number} transferBytes Bytes transferred, includes transferPart
 * @property {Number} totalTransferBytes Total amount of bytes transferred, includes transferPart
 */
/**
 * @event
 * @typedef {Object} TransferCompleteEvent
 * @property {TransferAsset} transferAsset Transfer asset
 */

/**
 * Transfer events
 */
const TransferEvents = {
    TRANSFER_START: "transferstart",
    TRANSFER_PROGRESS: "transferprogress",
    TRANSFER_COMPLETE: "transfercomplete"
};

/**
 * Transfer controller
 */
class TransferController extends EventEmitter {
}

module.exports = {
    TransferController,
    TransferEvents
};