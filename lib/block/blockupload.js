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
const { TransferController, TransferEvents } = require("../controller/transfercontroller");
const { CreateTransferParts } = require("../functions/transferpartscreate");
const { JoinTransferParts } = require("../functions/transferpartsjoin");
const { FailUnsupportedAssets } = require("../functions/failunsupportedassets");
const { CloseFiles } = require("../functions/closefiles");
const { MapConcurrent } = require("../generator/mapconcurrent");
const { Transfer } = require("../functions/transfer");
const { executePipeline, Pipeline } = require("../generator/pipeline");
const { RandomFileAccess } = require("../randomfileaccess");
const EventEmitter = require("events");
const UploadError = require("./upload-error");
const { FilterFailedAssets } = require("../functions/filterfailedassets");
const { IllegalArgumentError } = require("../error");
const { getFileStats } = require('../util');
const { AssetMultipart } = require("../asset/assetmultipart");
const { BlockRequestGenerator } = require("../asset/blockrequestgenerator");

const DEFAULT_MAX_CONCURRENCY = 8;
// Default part size is 10mb
const DEFAULT_PART_SIZE = 10 * 1024 * 1024;

/**
 * Generate Block upload transfer assets
 * mantaining generator pattern in case nui in future
 * starts supporting batch upload of renditions
 * 
 * @generator
 * @param {BlockUploadOptions} options 
 * @yields {TransferAsset} Transfer asset
 */
async function* generateBlockUploadTransfer(options) {
    console.log(`Generating block upload transfer parts`);
    const expectedLength = options.uploadFiles && (options.uploadFiles.length || options.uploadFiles.size);

    let assetCounter = 0;
    for (const uploadFile of options.uploadFiles) {
        if (!uploadFile.filePath) {
            throw new IllegalArgumentError(
                'filePath must be provided in uploadFiles',
                JSON.stringify(uploadFile)
            );
        }

        const sourceUrl = fileUrl(uploadFile.filePath);
        // assetTarget is a required field in block library
        let assetTarget;
        if (typeof uploadFile.fileUrl === "object"
            && Array.isArray(uploadFile.fileUrl)
            && uploadFile.fileUrl.length > 0) {
            console.log("Multiple uploads to run");
            assetTarget = uploadFile.fileUrl[0];
        } else {
            console.log("Single upload to run");
            assetTarget = uploadFile.fileUrl;
        }
        const targetUrl = new URL(assetTarget);

        const source = new Asset(sourceUrl);
        const target = new Asset(targetUrl, options.headers, uploadFile.multipartHeaders);

        if (!uploadFile.fileSize) {
            console.log("Getting transfer asset size from file to upload");
            const { size } = await getFileStats(uploadFile.filePath);
            uploadFile.fileSize = size;
        }

        const contentType = options.headers && options.headers['content-type'];
        console.log(`Transfer asset to upload is of content type ${contentType} and size ${uploadFile.fileSize} bytes`);
        const transferAsset = new TransferAsset(source, target, {
            acceptRanges: true,
            metadata: new AssetMetadata(uploadFile.filePath, contentType, uploadFile.fileSize)
        });

        const uploadURIs = uploadFile.fileUrl;
        const maxPartSize = uploadFile.maxPartSize;
        const minPartSize = uploadFile.minPartSize || Math.min(10, maxPartSize); // maxPartSize must be defined

        if (typeof uploadURIs === "object" && Array.isArray(uploadURIs) && uploadURIs.length > 0) {
            console.log(`Upload target is multipart ( ${uploadURIs.length} parts), min part size: ${minPartSize}, max part size: ${maxPartSize}`);
            transferAsset.multipartTarget = new AssetMultipart(
                uploadURIs,
                minPartSize,
                maxPartSize,
                transferAsset.target.multipartHeaders
            );
        }

        assetCounter++;
        console.log(`Generated upload transfer asset ${assetCounter} of ${expectedLength}`);

        yield transferAsset;
    }

    console.log(`Generated ${assetCounter} upload transfer assets (files to upload: ${expectedLength})`);
}

class BlockUpload extends EventEmitter {

    /**
     * @typedef {Object} UploadFile
     * @property {String} fileUrl AEM url where to upload the file
     * @property {Number} fileSize Size of the file to upload
     * @property {String} filePath Path on the local disk to upload
     * @property {Blob} [blob] Browser blob to upload (instead of fileUrl)
     * @property {Boolean} [createVersion=false] Create version on duplicates
     * @property {String} [versionLabel] Version label to apply to the created/updated file
     * @property {String} [versionComment] Version comment to apply to the created/updated file
     * @property {Boolean} [replace=false] True if the existing file should be replaced
     */
    /**
     * @typedef {Object} BlockUploadOptions
     * @property {UploadFile[]} uploadFiles List of files that will be uploaded to the target URL. 
     * @property {*} headers HTTP headers that will be included in each request sent to AEM
     * @property {Boolean} concurrent If true, multiple files in the supplied list of upload files will transfer simultaneously. If false, only one file will transfer at a time, and the next file will not begin transferring until the current file finishes. (currently not in use)
     * @property {Number} maxConcurrent Maximum number of concurrent HTTP requests that are allowed. If set to 1, only one chunk will transfer at a time, and the next chunk will not begin transferring until the current file finishes.
     * @property {Number} [preferredPartSize] Preferred part size
     */

    /**
     * Creates a new block upload instance
     */
    constructor() {
        super();
        this.errorEvents = null;
    }

    /**
     * Create a a block upload controller, which emits events
     * on file (upload) start, file (upload) progress, file (upload) end
     * and file (upload) error.
     * @returns {TransferController} Transfer controller (for upload)
     */
    createBlockUploadController() {
        const controller = new TransferController();
        this.errorEvents = [];

        controller.on(TransferEvents.TRANSFER, transferEvent => {
            console.log("Block upload: block upload controller starting part upload");
            this.emit("transferPart", transferEvent.transferAsset.eventData);
        });

        controller.on(TransferEvents.JOIN_TRANSFER_PARTS, transferEvent => {
            this.emit("fileprogress", {
                ...transferEvent.transferAsset.eventData,
                transferred: transferEvent.props.transferBytes
            });
        });

        controller.on(TransferEvents.AFTER_TRANSFER, transferEvent => {
            console.log("Block upload: block upload controller finishing part upload");
            this.emit("aftertransfer", transferEvent.transferAsset.eventData);
        });

        controller.on(TransferEvents.ERROR, transferEvent => {
            console.log(`Error during block upload: ${transferEvent.error}`);
            if (transferEvent.props.firstError) {
                this.errorEvents.push(transferEvent);
                this.emit("fileerror", {
                    ...transferEvent.transferAsset.eventData,
                    errors: [UploadError.fromError(transferEvent.error)]
                });
            }
        });

        return controller;
    }

    /**
    * Removes all listeners for events 
    * `CREATE_TRANSFER_PARTS`, `JOIN_TRANSFER_PARTS`,
    * `AFTER_JOIN_TRANSFER_PARTS` and `ERROR`
    * from a block upload controller
    * @param {TransferController} controller a block download controller
    */
    finalizeBlockUploadController(controller) {
        if (!controller) {
            return;
        }

        if (this.errorEvents) {
            this.errorEvents = null;
        }

        try {
            controller.removeAllListeners(TransferEvents.CREATE_TRANSFER_PARTS);
            controller.removeAllListeners(TransferEvents.JOIN_TRANSFER_PARTS);
            controller.removeAllListeners(TransferEvents.AFTER_JOIN_TRANSFER_PARTS);
            controller.removeAllListeners(TransferEvents.ERROR);
        } catch (err) {
            console.log(`Failed to remove event listeners from block upload controller: ${err}`);
        }
    }

    /**
     * Upload files
     * 
     * @param {BlockUploadOptions} options AEM upload options
     */
    async uploadFiles(options = {}) {
        const preferredPartSize = options.preferredPartSize || DEFAULT_PART_SIZE;
        const maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENCY;

        // Build and execute pipeline
        const controller = this.createBlockUploadController();
        const randomFileAccess = new RandomFileAccess();
        const requestGenerator = new BlockRequestGenerator();
        try {
            const pipeline = new Pipeline(
                new FailUnsupportedAssets(),
                new CreateTransferParts({ preferredPartSize }),
                new MapConcurrent(new Transfer(randomFileAccess, requestGenerator, options), { maxConcurrent }),
                new JoinTransferParts,
                new CloseFiles(randomFileAccess),
            );
            pipeline.setFilterFunction(new FilterFailedAssets);

            console.log("Block upload: executing block upload pipeline");
            await executePipeline(pipeline, generateBlockUploadTransfer(options), controller);
            console.log("Block upload: finished executing block upload pipeline");

            if (this.errorEvents && this.errorEvents.length > 0) {
                // delete file (not needed - as AEM won't commit the blob in case of error)
                // throw the first emitted error
                console.log(`Errors encountered during block upload (${this.errorEvents.length} total error(s))`);
                throw this.errorEvents[0].error;
            }
        } finally {
            if (controller) {
                this.finalizeBlockUploadController(controller);
            }

            if (randomFileAccess) {
                await randomFileAccess.close();
                console.log("Block upload: closed random file accessor");
            }
        }
    }

}

module.exports = {
    BlockUpload
};
