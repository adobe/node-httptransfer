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

const EventEmitter = require("events");
const fileUrl = require("file-url");
const { DownloadError } = require("./download-error");
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
const { FilterFailedAssets } = require("../functions/filterfailedassets");
const { GetAssetMetadata } = require("../functions/getassetmetadata");



/**
 * Generate AEM download transfer assets
 * 
 * @generator
 * @param {AEMDownloadOptions} options 
 * @yields {TransferAsset} Transfer asset
 */
async function* generateDownloadTransferRecords(options) {
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

function createController() {
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
        console.log(JSON.stringify({"transfer_error": {
            asset: transferEvent.transferAsset,
            error: transferEvent.error
        }}));
        if (transferEvent.props.firstError) {
            this.emit("fileerror", {
                ...transferEvent.transferAsset.eventData,
                errors: [ DownloadError.fromError(transferEvent.error) ]
            });
        }
    });
    return controller;
}



/**
 * Provide a single file download process which is allowed to run in parallel
 */
const DEFAULT_MAX_CONCURRENCY = 8;
// Defaul part size is 10mb
const DEFAULT_PART_SIZE = 10 * 1024 * 1024;
// Default retry max count
const DEFAULT_RETRY_COUNT = 5;

/**
 * @typedef {Object} DownloadFile
 * @property {String} fileUrl AEM url of file to download
 * @property {String} filePath Path on the local disk where to download
 * @property {Number} fileSize Size of the file being downloaded
 */

class BlockDownload extends EventEmitter {
    /**
     * @typedef {Object} BlockDownloadOptions
     * @property {Integer} maxConcurrent Maximum number of concurrent HTTP requests that are allowed (deafult is 8)
     * @property {DownloadFile[]} downloadFiles Files that will be downloaded.
     * @property {Boolean} retryEnabled If true, retries will be attempted for failed parts
     * @property {Number} [preferredPartSize] Preferred part size
     * @property {Number} [retryCount] Retry count (default is 5)
     */

    /**
     * Download files to local disk
     * Throws the first unrecoverable error if unsuccessful, all others are logged
     * 
     * @param {BlockDownloadOptions} options Block download options
     */
    async downloadFiles (options = {}) {
        const preferredPartSize = options.preferredPartSize || DEFAULT_PART_SIZE;
        const maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENCY;
        const controller = createController();

        const retryOptions = {
            retryMaxCount: options.retryCount || DEFAULT_RETRY_COUNT
        };

        // Build and execute pipeline
        const randomFileAccess = new RandomFileAccess();
        try {
            const pipeline = new Pipeline(
                new GetAssetMetadata(options), 
                new CreateTransferParts({ preferredPartSize }),
                new MapConcurrent(new Transfer(randomFileAccess, retryOptions), { maxConcurrent }),
                new JoinTransferParts,
                new CloseFiles(randomFileAccess),
            );
            pipeline.setFilterFunction(new FilterFailedAssets);
            await executePipeline(pipeline, generateDownloadTransferRecords(options), controller);
            controller.throwFirstError();            
        } finally {
            await randomFileAccess.close();
            await controller.cleanupFailedTransfers();
        }
    }

}

module.exports = {
    BlockDownload
};