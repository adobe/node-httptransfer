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

'use strict';

require("core-js/stable");

const fileUrl = require("file-url");

const { IllegalArgumentError } = require("../error");
const { Asset } = require("../asset/asset");
const { TransferAsset } = require("../asset/transferasset");

const PRIVATE = Symbol("PRIVATE");

/**
 * A transfer process that provides common functionality for various upload methods to AEM.
 */
class AEMBinaryUpload {
    /**
     * Constructs a new binary upload with the given dependencies.
     * @param {import('./typedefs').AEMUploadOptions} options Options being used to
     *  drive the upload process.
     */
    constructor(options) {
        this[PRIVATE] = {
            options
        };
    }

    /**
     * Retrieves the upload options as provided to the upload process.
     * @returns {import('./typedefs').AEMUploadOptions} Options being used to
     *  drive the upload process.
     */
    getOptions() {
        return this[PRIVATE].options || {};
    }

    /**
     * Retrieves the options that will be used for the library's transfer
     * process.
     * @returns {*} Transfer process options.
     */
    getTransferOptions() {
        throw new Error("getTransferOptions() must be implemented.");
    }

    /**
     * Generate AEM upload transfer assets
     * 
     * @generator
     * @yields {TransferAsset} Transfer asset
     */
    * generateAEMUploadTransferRecords() {
        const { uploadFiles = [], headers } = this.getOptions();
        for (const uploadFile of uploadFiles) {
            let sourceUrl = uploadFile.blob;
            if (!sourceUrl) {
                if (!uploadFile.filePath) {
                    throw new IllegalArgumentError(
                        'Either blob or filePath must be provided in uploadFiles',
                        JSON.stringify(uploadFile)
                    );
                }
                sourceUrl = fileUrl(uploadFile.filePath);
            }
            const targetUrl = new URL(uploadFile.fileUrl);

            const source = new Asset(sourceUrl);
            const target = new Asset(targetUrl, headers, uploadFile.multipartHeaders);

            const transferAsset = new TransferAsset(source, target, this.getTransferAssetOptions(uploadFile));

            yield transferAsset;
        }
    }

    /**
     * Builds the TransferAsset options for a given upload file.
     * @param {import('./typedefs').UploadFile} uploadFile File whose options should
     *  be created.
     * @returns {import('../asset/transferasset').TransferAssetOptions} Transfer options
     *  to use for the file.
     */
    // eslint-disable-next-line no-unused-vars
    getTransferAssetOptions(uploadFile) {
        throw new Error("getTransferAssetOptions() must be implemented.");
    }

    /**
     * Retrieves the preferred part size for the upload process. Note that the return
     * value might be undefined.
     * @returns {number} Preferred part size, or undefined if none specified.
     */
    getPreferredPartSize() {
        throw new Error("getPreferredPartSize() must be implemented.");
    }

    /**
     * Retrieves the maximum number of concurrent uploads allowed by the upload process.
     * @returns {number} Number of max uploads.
     */
    getMaxConcurrent() {
        throw new Error("getMaxConcurrent() must be implemented.");
    }

    /**
     * Retrieves the pipeline steps that should be executed to accomplish the binary
     * upload.
     * @param {import('../randomfileaccess').RandomFileAccess} randomFileAccess File
     *  access instance that can be used for working with files.
     * @returns {Array<import('../generator/function')>} Steps to execute in a
     *  pipeline.
     */
    // eslint-disable-next-line no-unused-vars
    getPipelineSteps(randomFileAccess) {
        throw new Error("getPipelineSteps() must be implemented.");
    }

    /**
     * Retrieves the name of the transfer event that should be used to indicate that
     * a file has started transferring.
     * @returns {string} An event name.
     */
    getFileStartEventName() {
        throw new Error("getFileStartEventName() must be implemented.");
    }

    /**
     * Retrieves the name of the transfer event that should be used to indicate that
     * a file has finished transferring.
     * @returns {string} An event name.
     */
    getFileEndEventName() {
        throw new Error("getFileEndEventName() must be implemented.");
    }
}

module.exports = {
    AEMBinaryUpload
};
