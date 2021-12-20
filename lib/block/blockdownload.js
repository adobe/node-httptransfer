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

const debug = console.log;
const EventEmitter = require('events');
const fileUrl = require('file-url');
const DownloadError = require('./download-error');
const { Asset } = require('../asset/asset');
const { TransferAsset } = require('../asset/transferasset');
const { AssetMetadata } = require('../asset/assetmetadata');
const { TransferController, TransferEvents } = require('../controller/transfercontroller');
const { CreateTransferParts } = require('../functions/transferpartscreate');
const { JoinTransferParts } = require('../functions/transferpartsjoin');
const { CloseFiles } = require('../functions/closefiles');
const { MapConcurrent } = require('../generator/mapconcurrent');
const { Transfer } = require('../functions/transfer');
const { executePipeline, Pipeline } = require('../generator/pipeline');
const { RandomFileAccess } = require('../randomfileaccess');
const { FilterFailedAssets } = require('../functions/filterfailedassets');
const { GetAssetMetadata } = require('../functions/getassetmetadata');

/**
 * Generate AEM download transfer assets
 * 
 * @generator
 * @param {AEMDownloadOptions} options 
 * @yields {TransferAsset} Transfer asset
 */
async function* generateBlockDownloadTransfer(options) {
    debug(`Generating block download transfer parts`);
    let assetCounter = 0;
    for (const downloadFile of options.downloadFiles) {

        const sourceUrl = new URL(downloadFile.fileUrl);
        const targetPath = fileUrl(downloadFile.filePath);

        const source = new Asset(sourceUrl, options.headers);
        const target = new Asset(targetPath);

        const transferAsset = new TransferAsset(source, target, {
            acceptRanges: true,
            metadata: new AssetMetadata(downloadFile.filePath, undefined, downloadFile.fileSize)
        });

        assetCounter++;
        yield transferAsset;
    }

    const expectedLength = options.downloadFiles && (options.downloadFiles.length || options.downloadFiles.size);
    debug(`Generated ${assetCounter} transfer assets (files to download: ${expectedLength})`);
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
     * Creata a block download controller, which emits events
     * on file (download) start, file (download) progress, file (download) end
     * and file (download) error.
     * @returns {TransferController} Transfer controller
     */
    createBlockDownloadController() {
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
            debug(`Error during download: ${transferEvent.error}`)
            if (transferEvent.props.firstError) {
                this.emit("fileerror", {
                    ...transferEvent.transferAsset.eventData,
                    errors: [DownloadError.fromError(transferEvent.error)]
                });
            }
        });

        debug("Block download: block download controller created");
        return controller;
    }

    /**
     * Download files to local disk
     * Throws the first unrecoverable error if unsuccessful, all others are logged
     * 
     * @param {BlockDownloadOptions} options Block download options
     */
    async downloadFiles(options = {}) {
        const preferredPartSize = options.preferredPartSize || DEFAULT_PART_SIZE;
        const maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENCY;

        const retryOptions = {
            retryMaxCount: options.retryCount || DEFAULT_RETRY_COUNT,
            timeout: options.timeout,
            retryAllErrors: options.retryAllErrors,
            retryMaxDuration: options.retryMaxDuration,
            retryInitialDelay: options.retryInitialDelay,
            retryBackoff: options.retryBackoff
        };

        // Build and execute pipeline
        const controller = this.createBlockDownloadController();
        debug("Block download: transfer controller created");

        const randomFileAccess = new RandomFileAccess();
        try {
            const pipeline = new Pipeline(
                new GetAssetMetadata(options),
                new CreateTransferParts({ preferredPartSize }),
                new MapConcurrent(new Transfer(randomFileAccess, retryOptions), { maxConcurrent }),
                new JoinTransferParts,
                new CloseFiles(randomFileAccess),
            );
            pipeline.setFilterFunction(new FilterFailedAssets());

            debug("Block download: executing block download pipeline");
            await executePipeline(pipeline, generateBlockDownloadTransfer(options), controller);
            debug("Block download: finished executing block download pipeline");

            controller.throwFirstError();
        } finally {
            if (randomFileAccess) {
                debug("Block download: closing random file accessor");
                await randomFileAccess.close();
                debug("Block download: closed random file accessor");
            }
            if (controller) {
                debug("Block download: cleaning up failed transfers");
                await controller.cleanupFailedTransfers();
                debug("Block download: cleaned up failed transfers");
            }
        }
    }
}

module.exports = {
    BlockDownload
};