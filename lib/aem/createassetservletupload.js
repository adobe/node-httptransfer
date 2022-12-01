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

'use strict';

require("core-js/stable");

const fileUrl = require("file-url");

const { Asset } = require("../asset/asset");
const { TransferAsset } = require("../asset/transferasset");
const { AssetMetadata } = require("../asset/assetmetadata");
const { NameConflictPolicy } = require("../asset/nameconflictpolicy");
const { TransferEvents } = require("../controller/transfercontroller");
const { CreateAssetServletController } = require("../controller/createassetservletcontroller");
const { CreateTransferParts } = require("../functions/transferpartscreate");
const { JoinTransferParts } = require("../functions/transferpartsjoin");
const { FailUnsupportedAssets } = require("../functions/failunsupportedassets");
const { CloseFiles } = require("../functions/closefiles");
const { MapConcurrent } = require("../generator/mapconcurrent");
const { Transfer } = require("../functions/transfer");
const { executePipeline, Pipeline } = require("../generator/pipeline");
const { RandomFileAccess } = require("../randomfileaccess");
const EventEmitter = require("events");
const UploadError = require("../block/upload-error");
const { FilterFailedAssets } = require("../functions/filterfailedassets");
const { urlToPath } = require("../util");
const { AssetMultipart } = require("../asset/assetmultipart");

const DEFAULT_PART_SIZE = 1024 * 1024 * 10; // default 10MB parts

/**
 * Generate AEM upload transfer assets
 * 
 * @generator
 * @param {AEMUploadOptions} options Options as provided to upload.
 * @param {number} preferredPartSize Preferred size of each part, as specified in the options.
 *  Will be falsy if none provided.
 * @yields {TransferAsset} Transfer asset
 */
async function* generateCreateAssetTransferRecords(options, preferredPartSize) {
    for (const uploadFile of options.uploadFiles) {
        const { fileSize } = uploadFile;
        let sourceUrl = fileUrl(uploadFile.filePath);
        const targetUrl = new URL(uploadFile.fileUrl);
        const { parentPath } = urlToPath(targetUrl);
        const createAssetServletUrl = new URL(`${targetUrl.protocol}//${targetUrl.host}${parentPath}.createasset.html`);

        const source = new Asset(sourceUrl);
        const target = new Asset(targetUrl, options.headers, uploadFile.multipartHeaders);

        let uploadURICount = 1;
        const uploadURIs = [];

        if (preferredPartSize) {
            uploadURICount = Math.ceil(fileSize / preferredPartSize);
        }

        for (let i = 0; i < uploadURICount; i++) {
            uploadURIs.push(createAssetServletUrl);
        }

        const transferAsset = new TransferAsset(source, target, {
            acceptRanges: true,
            metadata: new AssetMetadata(uploadFile.filePath, undefined, fileSize),
            nameConflictPolicy: new NameConflictPolicy({
                replace: !!uploadFile.replace
            }),
            multipartTarget: new AssetMultipart(
                uploadURIs,
                1,
                fileSize,
                options.headers
            )
        });

        yield transferAsset;
    }
}

class CreateAssetServletUpload extends EventEmitter {

    /**
     * @typedef {Object} UploadFile
     * @property {String} fileUrl Full URL of where the file should be uploaded
     * @property {Number} fileSize Size of the file to upload
     * @property {String} filePath Path on the local disk to upload
     * @property {Boolean} [replace=false] True if the existing file should be replaced, otherwise a new version
     *  is created.
     */
    /**
     * @typedef {Object} AEMUploadOptions
     * @property {UploadFile[]} uploadFiles List of files that will be uploaded to the target URL.
     * @property {*} headers HTTP headers that will be included in each request sent to AEM
     * @property {Number} [preferredPartSize] Preferred part size. If provided, the upload will split the file being uploaded into
     *  parts this size, and upload each part in sequence.
     * @property {Object} requestOptions Options that will be passed to fetch (either node-fetch-npm or native fetch, depending on the context)
     */
    /**
     * Upload files to AEM
     * 
     * @param {AEMUploadOptions} options AEM upload options
     */
    async uploadFiles(options) {
        const preferredPartSize = (options && options.preferredPartSize) || DEFAULT_PART_SIZE;
        const maxConcurrent = 1;
        const requestOptions = options.requestOptions || {};

        const controller = new CreateAssetServletController();
        controller.on(TransferEvents.TRANSFER_ASSET, transferEvent => {
            this.emit("filestart", transferEvent.transferAsset.eventData);
        });
        controller.on(TransferEvents.JOIN_TRANSFER_PARTS, transferEvent => {
            this.emit("fileprogress", {
                ...transferEvent.transferAsset.eventData,
                transferred: transferEvent.props.transferBytes
            });
        });
        controller.on(TransferEvents.AFTER_JOIN_TRANSFER_PARTS, transferEvent => {
            this.emit("fileend", transferEvent.transferAsset.eventData);
        });
        controller.on(TransferEvents.ERROR, transferEvent => {
            if (transferEvent.props.firstError) {
                this.emit("fileerror", {
                    ...transferEvent.transferAsset.eventData,
                    errors: [ UploadError.fromError(transferEvent.error) ]
                });
            }
        });

        const transferOptions = {
            retryMaxCount: 5,
            requestOptions,
            method: "POST"
        };
        
        // Build and execute pipeline
        const randomFileAccess = new RandomFileAccess();
        try {
            const pipeline = new Pipeline(
                new FailUnsupportedAssets(),
                new CreateTransferParts({ preferredPartSize }),
                new MapConcurrent(new Transfer(randomFileAccess, transferOptions), { maxConcurrent }),
                new JoinTransferParts,
                new CloseFiles(randomFileAccess),
            );
            pipeline.setFilterFunction(new FilterFailedAssets);
            await executePipeline(pipeline, generateCreateAssetTransferRecords(options, preferredPartSize), controller);
        } finally {
            await randomFileAccess.close();
        }
    }
}

module.exports = {
    CreateAssetServletUpload
};
