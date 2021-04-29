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

'use strict';

const { dirname: urlPathDirname, basename: urlPathBasename } = require("path").posix;
const { pathToFileURL } = require("url");
const { Asset } = require("./asset/asset");
const { TransferAsset } = require("./asset/transferasset");
const { AssetMetadata } = require("./asset/assetmetadata");
const { TransferController, TransferEvents } = require("./asset/transfercontroller");
const { AEMInitiateUpload } = require("./functions/aeminitiateupload");
const { AEMCompleteUpload } = require("./functions/aemcompleteupload");
const { CreateTransferParts } = require("./functions/transferpartscreate");
const { JoinTransferParts } = require("./functions/transferpartsjoin");
const { CloseFiles } = require("./functions/closefiles");
const { MapBatch } = require("./generator/mapbatch");
const { MapConcurrent } = require("./generator/mapconcurrent");
const { Transfer } = require("./functions/transfer");
const { Pipeline } = require("./generator/pipeline");
const { RandomFileAccess } = require("./randomfileaccess");
const EventEmitter = require("events");

/**
 * Generate AEM upload transfer assets
 * 
 * @generator
 * @param {AEMUploadOptions} options 
 * @yields {TransferAsset} Transfer asset
 */
async function* generateAEMUploadTransferRecords(options) {
    for (const uploadFile of options.uploadFiles) {
        const sourceUrl = pathToFileURL(uploadFile.filePath);
        const targetUrl = new URL(uploadFile.fileUrl);

        const source = new Asset(sourceUrl);
        const target = new Asset(targetUrl, undefined, options.headers);

        const transferAsset = new TransferAsset(source, target, {
            acceptRanges: true,
            metadata: new AssetMetadata(uploadFile.filePath, undefined, uploadFile.fileSize)
        });

        yield transferAsset;
    }
}

/**
 * Create a file event that matches the aem-upload event structure
 *
 * @param {TransferAsset} transferAsset Transfer asset
 * @returns {*} AEM Upload File event
 */
function createFileEvent(transferAsset) {
    return {
        fileName: transferAsset.source.url.pathname,
        fileSize: transferAsset.metadata.contentLength,
        targetFolder: urlPathDirname(transferAsset.target.url.pathname),
        targetFile: urlPathBasename(transferAsset.target.url.pathname),
        mimeType: transferAsset.metadata.contentType
    };
}

class AEMUpload extends EventEmitter {

    /**
     * @typedef {Object} UploadFile
     * @property {String} fileName
     * @property {Number} fileSize
     * @property {String} filePath
     * @property {Blob} blob
     * @property {Boolean} [createVersion=false]
     * @property {String} [versionLabel]
     * @property {String} [versionComment]
     * @property {Boolean} [replace=false]
     */
    /**
     * @typedef {Object} AEMUploadOptions
     * @property {String} url Full, absolute URL to the Folder in the target instance where the specified files will be uploaded. This value is expected to be URI encoded.
     * @property {UploadFile[]} uploadFiles List of files that will be uploaded to the target URL. 
     * @property {*} headers HTTP headers that will be included in each request sent to AEM
     * @property {Boolean} concurrent If true, multiple files in the supplied list of upload files will transfer simultaneously. If false, only one file will transfer at a time, and the next file will not begin transferring until the current file finishes.
     * @property {Number} maxConcurrent Maximum number of concurrent HTTP requests that are allowed
     * @property {Number} [preferredPartSize] Preferred part size
     */
    /**
     * Upload files to AEM
     * 
     * @param {AEMUploadOptions} options AEM upload options
     */
    async uploadFiles(options) {
        const preferredPartSize = options && options.preferredPartSize;
        const maxConcurrent = (options && options.concurrent && options.maxConcurrent) || 1;

        const controller = new TransferController();
        controller.on(TransferEvents.TRANSFER_START, ({ transferAsset }) => {
            this.emit("filestart", createFileEvent(transferAsset));
        });
        controller.on(TransferEvents.TRANSFER_PROGRESS, ({ transferAsset, transferBytes }) => {
            this.emit("fileprogress", {
                ...createFileEvent(transferAsset),
                transferred: transferBytes
            });
        });
        controller.on(TransferEvents.TRANSFER_COMPLETE, ({ transferAsset }) => {
            this.emit("fileend", createFileEvent(transferAsset));
        });

        // Build and execute pipeline
        const randomFileAccess = new RandomFileAccess();
        try {
            const pipeline = new Pipeline(
                new MapBatch(new AEMInitiateUpload(), { maxBatchLength: 100 }),
                new CreateTransferParts({ preferredPartSize }),
                new MapConcurrent(new Transfer(randomFileAccess), { maxConcurrent }),
                new JoinTransferParts(controller),
                new CloseFiles(randomFileAccess),
                new AEMCompleteUpload(),
            );
            await pipeline.execute(
                generateAEMUploadTransferRecords(options)
            );    
        } finally {
            await randomFileAccess.close();
        }
    }
}

module.exports = {
    AEMUpload
};
