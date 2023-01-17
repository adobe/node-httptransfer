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

/**
 * @typedef {Object} Headers
 */
/**
 * @typedef PartInfo
 * @property {import('../asset/transferpart').TransferPart} transferPart Transfer
 *  information about the part.
 * @property {*} partData The raw data for the part.
 * @property {DRange.SubRange} contentRange Range information defining which
 *  data is included in the raw part data.
 */
/**
 * @typedef PartHttpInfo
 * @property {import('../asset/transferpart').TransferPart} transferPart Transfer
 *  information about the part.
 * @property {*} httpBody The HTTP body for the part, as created by the TransferPart
 *  instance.
 * @property {DRange.SubRange} contentRange Range information defining which
 *  data is included in the HTTP body.
 */

/**
 * Helps create portions of the HTTP requests that will be sent when transferring
 * an asset. This may include creating the body of the part requests, or the
 * HTTP headers to include in requests.
 */
class HttpRequestGenerator {
    /**
     * Creates the body that will be used for a transfer part when transferred via HTTP.
     * @param {PartInfo} partInfo Information about the raw part data.
     * @returns {*} The data that should be used as the body.
     */
    // eslint-disable-next-line no-unused-vars
    createPartHttpBody(partInfo) {
        throw new Error("createPartHttpBody() must be implemented");
    }

    /**
     * Creates the headers that will be used for a transfer part when transferred via HTTP.
     * @param {PartHttpInfo} partHttpInfo HTTP information about the part.
     * @returns {Headers} Simple object containing header information.
     */
    // eslint-disable-next-line no-unused-vars
    createPartHttpHeaders(partHttpInfo) {
        throw new Error("createPartHttpHeaders() must be implemented");
    }
}

module.exports = {
    HttpRequestGenerator
};
