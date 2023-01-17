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

const mime = require("mime-types");

const { AEMBinaryUpload } = require("./aembinaryupload");
const { AssetMetadata } = require("../asset/assetmetadata");
const { NameConflictPolicy } = require("../asset/nameconflictpolicy");
const { TransferEvents } = require("../controller/transfercontroller");
const { CreateTransferParts } = require("../functions/transferpartscreate");
const { JoinTransferParts } = require("../functions/transferpartsjoin");
const { FailUnsupportedAssets } = require("../functions/failunsupportedassets");
const { CloseFiles } = require("../functions/closefiles");
const { MapConcurrent } = require("../generator/mapconcurrent");
const { Transfer } = require("../functions/transfer");
const { urlToPath } = require("../util");
const { AssetMultipart } = require("../asset/assetmultipart");
const { CreateAssetServletRequestGenerator } = require("./createassetservletrequestgenerator");
const { HTTP } = require("../constants");

const DEFAULT_PART_SIZE = 1024 * 1024 * 10; // default 10MB parts
const DEFAULT_URL_COUNT = 1;
const MAX_CONCURRENT = 1;
const MAX_RETRY_COUNT = 5;
const CREATE_ASSET_SERVLET_SELECTOR = ".createasset.html";

/**
 * A transfer process that uses AEM's create asset servlet to upload assets
 * to an AEM instance.
 */
class CreateAssetServletUpload extends AEMBinaryUpload {
    /**
     * Retrieves the options that will be used for the library's transfer
     * process.
     * @returns {*} Transfer process options.
     */
    getTransferOptions() {
        const { requestOptions = {} } = this.getOptions();
        return {
            retryMaxCount: MAX_RETRY_COUNT,
            requestOptions,
            method: HTTP.METHOD.POST
        };
    }

    /**
     * @param {import('./typedefs').UploadFile} uploadFile File whose options should
     *  be created.
     * @returns {import('../asset/transferasset').TransferAssetOptions} Transfer options
     *  to use for the file.
     */
    getTransferAssetOptions(uploadFile) {
        // overridden to add multipart information up front
        const { fileSize } = uploadFile;
        const targetUrl = new URL(uploadFile.fileUrl);
        const { parentPath } = urlToPath(targetUrl);
        const createAssetServletUrl = new URL(`${targetUrl.protocol}//${targetUrl.host}${parentPath}${CREATE_ASSET_SERVLET_SELECTOR}`);

        let uploadURICount = DEFAULT_URL_COUNT;
        const uploadURIs = [];

        uploadURICount = Math.ceil(fileSize / this.getPreferredPartSize());

        for (let i = 0; i < uploadURICount; i++) {
            uploadURIs.push(createAssetServletUrl);
        }

        return {
            acceptRanges: true,
            metadata: new AssetMetadata(uploadFile.filePath, mime.lookup(uploadFile.fileUrl), fileSize),
            nameConflictPolicy: new NameConflictPolicy({
                versionLabel: uploadFile.versionLabel,
                versionComment: uploadFile.versionComment,
                replace: uploadFile.replace
            }),
            multipartTarget: new AssetMultipart(
                uploadURIs,
                1,
                fileSize,
                this.getOptions().headers
            )
        };
    }

    /**
     * @returns {number} Preferred part size, or undefined if none specified.
     */
    getPreferredPartSize() {
        const defaultSize = this.getOptions().preferredPartSize;
        // overridden to have a default part size of 10MB for the create
        // asset servlet
        return defaultSize || DEFAULT_PART_SIZE;
    }

    /**
     * @returns {number} Number of max uploads.
     */
    getMaxConcurrent() {
        // overridden to disable concurrent transfers for the create asset servlet.
        return MAX_CONCURRENT;
    }

    /**
     * @param {import('../randomfileaccess').RandomFileAccess} randomFileAccess File
     *  access instance that can be used for working with files.
     * @returns {Array<import('../generator/function')>} Steps to execute in a
     *  pipeline.
     */
    getPipelineSteps(randomFileAccess) {
        const transferOptions = this.getTransferOptions();
        const requestGenerator = new CreateAssetServletRequestGenerator();
        return [
            new FailUnsupportedAssets(),
            new CreateTransferParts({ preferredPartSize: this.getPreferredPartSize() }),
            new MapConcurrent(new Transfer(randomFileAccess, requestGenerator, transferOptions), { maxConcurrent: this.getMaxConcurrent() }),
            new JoinTransferParts,
            new CloseFiles(randomFileAccess),
        ];
    }

    /**
     * @returns {string} An event name.
     */
    getFileStartEventName() {
        // overridden because the init upload servlet does not apply here
        return TransferEvents.TRANSFER_ASSET;
    }

    /**
     * @returns {string} An event name.
     */
    getFileEndEventName() {
        // overridden because the complete upload servlet does not apply here
        return TransferEvents.AFTER_JOIN_TRANSFER_PARTS;
    }
}

module.exports = {
    CreateAssetServletUpload
};
