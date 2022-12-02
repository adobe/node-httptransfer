/*
 * Copyright 2022 Adobe. All rights reserved.
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

const { CreateAssetServletPart } = require("../asset/createassetservletpart");
const { TransferController } = require("./transfercontroller");

/**
 * @typedef {Object} Headers
 */

/**
 * Transfer controller that provides functionality required for transferring to
 * AEM's create asset servlet.
 */
class CreateAssetServletController extends TransferController {
    /**
     * @param {import('../asset/transferasset').TransferAsset} transferAsset Asset to which the part belongs.
     * @param {URL[]} targetUrls Target urls for this part.
     * @param {import('DRange').SubRange} contentRange Range for this part.
     * @param {Headers} [targetHeaders] Headers to send when storing content in the target urls.
     */
    createTransferPart(transferAsset, targetUrls, contentRange, targetHeaders = {}) {
        return new CreateAssetServletPart(transferAsset, targetUrls, contentRange, targetHeaders);
    }
}

module.exports = {
    CreateAssetServletController
};
