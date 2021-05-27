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

const { TransferPart } = require("../asset/transferpart");

const PRIVATE = Symbol("PRIVATE");

/**
 * Record of asset transfer failure
 */
class FailureRecord {
    /**
     * Construct a transfer asset
     * 
     * @param {Error} error Error that caused the failure
     * @param {TransferPart} [transferPart] Optional transfer part that failed
     */
    constructor(error, transferPart) {
        if (!(error instanceof Error)) {
            throw Error();
        }
        if (transferPart && !(transferPart instanceof TransferPart)) {
            throw Error();
        }
        this[PRIVATE] = {
            error,
            transferPart
        };
    }

    /**
     * Error that caused the failure
     * 
     * @returns {Error} Error that caused the failure
     */
    get error() {
        return this[PRIVATE].error;
    }

    /**
     * Optional transfer part that failed
     * 
     * @returns {TransferPart} Optional transfer part that failed
     */
    get transferPart() {
        return this[PRIVATE].transferPart;
    }
}

module.exports = {
    FailureRecord
};
