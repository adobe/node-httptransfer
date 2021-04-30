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

const { AsyncGeneratorFunction } = require("../generator/function");
const { TransferEvents } = require("../transfercontroller");
const { basename: urlPathBasename } = require("path").posix;
const { issuePostJSON } = require("../fetch");
const { retry } = require("../retry");

/**
 * Retrieve the filename without path information
 * 
 * @param {URL} assetUrl Asset URL
 * @returns {String} Asset filename without path information
 */
function getFilename(assetUrl) {
    return urlPathBasename(assetUrl.pathname);
}

/**
 * @typedef {Object} AEMCompleteUploadOptions
 * @property {Number} [timeout] Socket timeout
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Complete upload of assets in AEM.
 */
class AEMCompleteUpload extends AsyncGeneratorFunction {
    /**
     * Construct the AEMCompleteUpload function
     * 
     * @param {TransferController} controller Transfer controller
     * @param {AEMCompleteUploadOptions} [options] AEM complete options
     */
    constructor(controller, options) {
        super();
        this.controller = controller;
        this.options = options;
    }
    /**
     * Track progress and completion
     * 
     * @generator
     * @param {TransferAsset} transferAssets Part that has transferred (or failed to)
     * @yields {TransferAsset} 
     */
    async* execute(transferAssets) {
        for await (const transferAsset of transferAssets) {
            const { uploadToken, completeUrl } = transferAsset.multipartTarget;

            // notify
            this.controller.emit(TransferEvents.BEFORE_COMPLETE_UPLOAD, {
                transferAsset
            });

            const form = new URLSearchParams();
            form.append("fileName", decodeURIComponent(getFilename(transferAsset.target.url)));
            form.append("fileSize", transferAsset.metadata.contentLength);
            form.append("mimeType", transferAsset.metadata.contentType);
            form.append("uploadToken", uploadToken);

            await retry(async () => {
                return issuePostJSON(completeUrl, {
                    timeout: this.options && this.options.timeout,
                    body: form.toString(),
                    headers: Object.assign(
                        { "content-type": "application/x-www-form-urlencoded" },
                        transferAsset.target.headers
                    )
                });
            }, this.options);

            // notify
            this.controller.emit(TransferEvents.AFTER_COMPLETE_UPLOAD, {
                transferAsset
            });

            yield transferAsset;
        }
    }
}

module.exports = {
    AEMCompleteUpload
};