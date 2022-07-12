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

require("core-js/stable");

const { AsyncGeneratorFunction } = require("../generator/function");
const { TransferEvents } = require("../controller/transfercontroller");
const { postForm } = require("../fetch");
const { getCSRFToken } = require("../csrf");
const { retry } = require("../retry");
const { MIMETYPE } = require("../constants");

/**
 * @typedef {Object} AEMCompleteUploadOptions
 * @property {Number} [timeout=30000] Socket timeout
 * @property {Number} [retryMaxCount] number of retry attempts, overrides retryMaxDuration
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Object} [requestOptions] Options that will be passed to fetch (either node-fetch-npm or native fetch, depending on the context)
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
    constructor(options) {
        super();
        this.options = options;
    }

    /**
     * Track progress and completion
     * 
     * @generator
     * @param {TransferAsset} transferAssets Part that has transferred (or failed to)
     * @param {TransferController} controller Transfer controller
     * @yields {TransferAsset} 
     */
    async* execute(transferAssets, controller) {
        for await (const transferAsset of transferAssets) {
            try {                
                const { uploadToken, completeUrl } = transferAsset.multipartTarget;

                controller.notify(TransferEvents.AEM_COMPLETE_UPLOAD, this.name, transferAsset);

                const form = new URLSearchParams();
                form.append("fileName", transferAsset.target.filename);
                form.append("fileSize", transferAsset.metadata.contentLength);
                if (transferAsset.metadata.contentType) {
                    form.append("mimeType", transferAsset.metadata.contentType);
                } else {
                    form.append("mimeType", MIMETYPE.APPLICATION_OCTET_STREAM);
                }
                form.append("createVersion", transferAsset.nameConflictPolicy.createVersion);
                if (transferAsset.nameConflictPolicy.versionLabel) {
                    form.append("versionLabel", transferAsset.nameConflictPolicy.versionLabel);
                }
                if (transferAsset.nameConflictPolicy.versionComment) {
                    form.append("versionComment", transferAsset.nameConflictPolicy.versionComment);
                }
                form.append("replace", transferAsset.nameConflictPolicy.replace);
                form.append("uploadToken", uploadToken);
                form.append("uploadDuration", transferAsset.uploadDuration);

                const headers = transferAsset.target.headers || {};

                // eslint-disable-next-line no-undef
                if ((typeof window !== 'undefined') && (typeof window.document !== 'undefined')) {
                    const origin = new URL(completeUrl).origin;
                    headers['csrf-token'] = await getCSRFToken(origin, this.options, transferAsset.target.headers);
                }

                await retry(async () => {
                    return postForm(completeUrl, form, {
                        timeout: this.options && this.options.timeout,                    
                        headers,
                        ...this.options.requestOptions
                    });
                }, this.options);
                
                controller.notify(TransferEvents.AFTER_AEM_COMPLETE_UPLOAD, this.name, transferAsset);

                yield transferAsset;

            } catch (error) {
                controller.notifyError(this.name, error, transferAsset);
            }
        }
    }
}

module.exports = {
    AEMCompleteUpload
};
