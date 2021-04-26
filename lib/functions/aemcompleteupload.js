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
const { TransferTracker } = require("../asset/transfertracker");
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
 * Complete upload of assets in AEM.
 */
class AEMCompleteUpload extends AsyncGeneratorFunction {
    /**
     * Construct the AEMCompleteUpload function.
     */
    constructor() {
        super();
        this.transferTracker = new TransferTracker();
    }

    /**
     * Track progress and completion
     * 
     * @param {TransferPart} transferParts Part that has transferred (or failed to)
     * @returns {TransferPart} 
     */
    async* execute(transferParts) {
        for await (const transferPart of transferParts) {
            const transferComplete = this.transferTracker.record(transferPart);
            if (transferComplete) {
                const completeUrl = transferPart.completeUrl;
                // console.log("Completing", completeUrl.toString());

                const form = new URLSearchParams();
                form.append("fileName", getFilename(transferPart.target.url));
                form.append("fileSize", transferPart.metadata.contentLength);
                form.append("uploadToken", transferPart.uploadToken);
                form.append("mimeType", transferPart.metadata.contentType);

                await retry(async () => {
                    return issuePostJSON(completeUrl, {
                        body: form.toString(),
                        headers: Object.assign(
                            { "content-type": "application/x-www-form-urlencoded"},
                            transferPart.target.headers
                        )
                    });
                }, this.options);
            }
            yield transferPart;
        }
    }
}

module.exports = {
    AEMCompleteUpload
};