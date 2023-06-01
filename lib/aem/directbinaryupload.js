/*
 * Copyright 2023 Adobe. All rights reserved.
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

const { AEMBinaryUpload } = require("./aembinaryupload");
const { AssetMetadata } = require("../asset/assetmetadata");
const { NameConflictPolicy } = require("../asset/nameconflictpolicy");
const { AEMInitiateUpload } = require("../functions/aeminitiateupload");
const { TransferController, TransferEvents } = require("../controller/transfercontroller");
const { AEMCompleteUpload } = require("../functions/aemcompleteupload");
const { CreateTransferParts } = require("../functions/transferpartscreate");
const { JoinTransferParts } = require("../functions/transferpartsjoin");
const { FailUnsupportedAssets } = require("../functions/failunsupportedassets");
const { CloseFiles } = require("../functions/closefiles");
const { MapConcurrent } = require("../generator/mapconcurrent");
const { Transfer } = require("../functions/transfer");
const { BlockRequestGenerator } = require("../asset/blockrequestgenerator");
const { filterToRetryOptions } = require("../retry");

const ErrorCodes = require("../http-error-codes");

const MAX_RETRY_COUNT = 5;

/**
 * A transfer process that uses AEM's direct binary upload algorithm to upload assets
 * to an AEM instance.
 */
class DirectBinaryUpload extends AEMBinaryUpload {
    /**
     * Retrieves the options that will be used for the library's transfer
     * process.
     * @returns {import("../functions/transfer").TransferOptions} Transfer process options.
     */
    getTransferOptions() {
        const { requestOptions = {} } = this.getOptions();
        const { retryOptions = {} } = requestOptions;
        // confirm only expected retry options are used
        const filteredRetryOptions = filterToRetryOptions(retryOptions);
        return {
            retryMaxCount: MAX_RETRY_COUNT,
            requestOptions,
            ...filteredRetryOptions
        };
    }

    /**
     * Builds the TransferAsset options for a given upload file.
     * @param {import('./typedefs').UploadFile} uploadFile File whose options should
     *  be created.
     * @returns {import('../asset/transferasset').TransferAssetOptions} Transfer options
     *  to use for the file.
     */
    getTransferAssetOptions(uploadFile) {
        return {
            acceptRanges: true,
            metadata: new AssetMetadata(uploadFile.filePath, undefined, uploadFile.fileSize),
            nameConflictPolicy: new NameConflictPolicy({
                createVersion: uploadFile.createVersion,
                versionLabel: uploadFile.versionLabel,
                versionComment: uploadFile.versionComment,
                replace: uploadFile.replace
            })
        };
    }

    /**
     * Retrieves the preferred part size for the upload process. Note that the return
     * value might be undefined.
     * @returns {number} Preferred part size, or undefined if none specified.
     */
    getPreferredPartSize() {
        return this.getOptions().preferredPartSize;
    }

    /**
     * Retrieves the maximum number of concurrent uploads allowed by the upload process.
     * @returns {number} Number of max uploads.
     */
    getMaxConcurrent() {
        const options = this.getOptions();
        return (options.concurrent && options.maxConcurrent) || 1;
    }

    /**
     * Retrieves the pipeline steps that should be executed to accomplish the binary
     * upload.
     * @param {import('../randomfileaccess').RandomFileAccess} randomFileAccess File
     *  access instance that can be used for working with files.
     * @returns {Array<import('../generator/function')>} Steps to execute in a
     *  pipeline.
     */
    getPipelineSteps(randomFileAccess) {
        const transferOptions = this.getTransferOptions();
        const requestGenerator = new BlockRequestGenerator();
        return [
            new FailUnsupportedAssets(),
            new MapConcurrent(new AEMInitiateUpload(transferOptions), { maxBatchLength: 100 }),
            new CreateTransferParts({ preferredPartSize: this.getPreferredPartSize() }),
            new MapConcurrent(new Transfer(randomFileAccess, requestGenerator, transferOptions), {
                maxConcurrent: this.getMaxConcurrent()
            }),
            new JoinTransferParts,
            new CloseFiles(randomFileAccess),
            new MapConcurrent(new AEMCompleteUpload(transferOptions)),
        ];
    }

    /**
     * Retrieves the name of the transfer event that should be used to indicate that
     * a file has started transferring.
     * @returns {string} An event name.
     */
    getFileStartEventName() {
        return TransferEvents.AEM_INITIATE_UPLOAD;
    }

    /**
     * Retrieves the name of the transfer event that should be used to indicate that
     * a file has finished transferring.
     * @returns {string} An event name.
     */
    getFileEndEventName() {
        return TransferEvents.AFTER_AEM_COMPLETE_UPLOAD;
    }

    /**
     * Determines whether the AEM isntance that is the target of the upload has direct
     * binary access enabled. This will help decide which upload algorithm to use.
     * @param {import('typedefs').AEMUploadOptions} options Options being used to drive the upload.
     * @returns {Promise<booleam>} True if direct binary access is enabled, false
     *  otherwise.
     */
    static async isDirectBinaryAccessEnabled(options) {
        return new Promise((res, rej) => {
            const controller = new TransferController();
            controller.on(TransferEvents.AFTER_AEM_INITIATE_UPLOAD, () => {
                // this event means that the initiate was successful - direct
                // binary access is support
                res(true);
            });
            controller.on(TransferEvents.ERROR, (transferEvent) => {
                try {
                    // ther was an error in the initiate, check to see if the error
                    // indicates direct binary access isn't enabled
                    if (transferEvent.props.firstError) {
                        if (transferEvent.error.code === ErrorCodes.NOT_SUPPORTED) {
                            res(false);
                            return;
                        }
                    }
                    // default to true to avoid swallowing errors that downstream processes
                    // may handle better
                    res(true);
                } catch (e) {
                    rej(e);
                }
            });
            try {
                const binaryUpload = new DirectBinaryUpload(options);
                const transferAssets = binaryUpload.generateAEMUploadTransferRecords();

                const assets = [];
                // use the first asset in the list of files to submit an initiate upload call,
                // which can help determine whether direct binary access is enabled.
                for (const transferAsset of transferAssets) {
                    assets.push(transferAsset);
                    break;
                }
                if (assets.length > 0) {
                    const initiateUpload = new AEMInitiateUpload(binaryUpload.getTransferOptions());
                    const result = initiateUpload.execute(assets, controller);
                    result.next();
                } else {
                    // if no assets were provided, continue as if direct binary access is
                    // enabled and rely on downstream processes to handle the error
                    res(true);
                }
            } catch (e) {
                rej(e);
            }
        });
    }
}

module.exports = {
    DirectBinaryUpload
};
