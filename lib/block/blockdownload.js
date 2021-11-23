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

const fileUrl = require("file-url");
const { Asset } = require("../asset/asset");
const { TransferAsset } = require("../asset/transferasset");
const { AssetMetadata } = require("../asset/assetmetadata");
const { TransferController, TransferEvents } = require("../controller/transfercontroller");
const { CreateTransferParts } = require("../functions/transferpartscreate");
const { JoinTransferParts } = require("../functions/transferpartsjoin");
const { CloseFiles } = require("../functions/closefiles");
const { MapConcurrent } = require("../generator/mapconcurrent");
const { Transfer } = require("../functions/transfer");
const { executePipeline, Pipeline } = require("../generator/pipeline");
const { RandomFileAccess } = require("../randomfileaccess");
const EventEmitter = require("events");
const { FilterFailedAssets } = require("../functions/filterfailedassets");

/**
 * Generate AEM download transfer assets
 * 
 * @generator
 * @param {AEMDownloadOptions} options 
 * @yields {TransferAsset} Transfer asset
 */
 async function* generateAEMDownloadTransferRecords(options) {
    for (const downloadFile of options.downloadFiles) {
        const sourceUrl = new URL(downloadFile.fileUrl);
        const targetUrl = fileUrl(downloadFile.filePath);

        const source = new Asset(sourceUrl, options.headers);
        const target = new Asset(targetUrl);

        const transferAsset = new TransferAsset(source, target, {
            acceptRanges: true,
            metadata: new AssetMetadata(downloadFile.filePath, undefined, downloadFile.fileSize)
        });

        yield transferAsset;
    }
}



/**
 * Provide a single file download process which is allowed to run in parallel
 */
const DEFAULT_MAX_CONCURRENCY = 8;
// Defaul part size is 10mb
const DEFAULT_PART_SIZE = 10 * 1024 * 1024;

/**
 * @typedef {Object} DownloadFile
 * @property {String} fileUrl AEM url of file to download
 * @property {String} filePath Path on the local disk where to download
 * @property {Number} fileSize Size of the file being downloaded
 * @property {*[]} blockUrls ordered list of all blocks to download
 */

/**
 * Iterate through all of the file blocks
 * @param {DownloadFile[]} files 
 */
function* iterateAllBlocks(files) {
    for (const file of files) {
        yield* file.blockUrls;
    }
}
class BlockDownload extends EventEmitter {
    /**
     * @typedef {Object} BlockDownloadOptions
     * @property {Integer} maxConcurrency Maximum number of concurrent HTTP requests that are allowed (deafult is 8)
     * @property {DownloadFile[]} downloadFiles List of files that will be downloaded.
     * @property {*} headers HTTP headers that will be included in each request sent to AEM.
     * @property {Boolean} concurrent If true, multiple files in the supplied list of download files will transfer simultaneously. If false, only one file will transfer at a time, and the next file will not begin transferring until the current file finishes.
     * @property {Number} [preferredPartSize] Preferred part size
     */

    createController(options) {
        const controller = new TransferController();
        controller.on(TransferEvents.CREATE_TRANSFER_PARTS, transferEvent => {
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
        return controller;
    }

    /**
     * Download files to local disk
     * 
     * @param {BlockDownloadOptions} options Block download options
     */
    async downloadFiles (options = {}) {
        const preferredPartSize = options.preferredPartSize || DEFAULT_PART_SIZE;
        const maxConcurrent = options.maxConcurrency || DEFAULT_MAX_CONCURRENCY;
        const concurrentFiles = options.concurrent || false;
        const controller = createController();

        const retryOptions = {
            retryMaxCount: 5
        };

        // Build and execute pipeline
        const randomFileAccess = new RandomFileAccess();
        try {
            const pipeline = new Pipeline(
                new iterateAllBlocks(options.downloadFiles),
                new CreateTransferParts({ preferredPartSize }),
                new MapConcurrent(new Transfer(randomFileAccess, retryOptions), { maxConcurrent }),
                new JoinTransferParts,
                new CloseFiles(randomFileAccess),
            );
            pipeline.setFilterFunction(new FilterFailedAssets);
            await executePipeline(pipeline, generateAEMDownloadTransferRecords(options), controller);
        } finally {
            await randomFileAccess.close();
        }
    }

}

module.exports = {
    BlockDownload
};