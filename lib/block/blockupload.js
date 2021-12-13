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
// TODO should the error file be in aem folder
const UploadError = require("../aem/upload-error");
const { FilterFailedAssets } = require("../functions/filterfailedassets");
const { IllegalArgumentError } = require("../error");
const { getFileStats } = require('../util');
const { AssetMultipart } = require("../asset/assetmultipart");


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
    for (const uploadFile of options.uploadFiles) {
        if (!uploadFile.filePath) {
            throw new IllegalArgumentError(
                'filePath must be provided in uploadFiles',
                JSON.stringify(uploadFile)
            );
        }
        const sourceUrl = fileUrl(uploadFile.filePath);
        // }
        let assetTarget;
        if(typeof uploadFile.fileUrl === 'object' && Array.isArray(uploadFile.fileUrl)) { 
            assetTarget = uploadFile.fileUrl[0];
        } else {
            assetTarget = uploadFile.fileUrl;
        }
        const targetUrl = new URL(assetTarget);

        const source = new Asset(sourceUrl);
        const target = new Asset(targetUrl, options.headers, uploadFile.multipartHeaders);
        
        if(!uploadFile.fileSize) {
            const { size } = await getFileStats(uploadFile.filePath);
            uploadFile.fileSize = size;
        }
        
        const transferAsset = new TransferAsset(source, target, {
            acceptRanges: true,
            metadata: new AssetMetadata(uploadFile.filePath, undefined, uploadFile.fileSize)
        });

        const uploadURIs = uploadFile.fileUrl;
        const minPartSize = uploadFile.minPartSize || 10;
        const maxPartSize = uploadFile.maxPartSize;
        
        if(typeof uploadURIs === 'object' && Array.isArray(uploadURIs)) { 
            transferAsset.multipartTarget = new AssetMultipart(
                uploadURIs,
                minPartSize,
                maxPartSize,
                transferAsset.target.multipartHeaders
            );
        }

        yield transferAsset;
    }
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
     * @property {Boolean} concurrent If true, multiple files in the supplied list of upload files will transfer simultaneously. If false, only one file will transfer at a time, and the next file will not begin transferring until the current file finishes.
     * @property {Number} maxConcurrent Maximum number of concurrent HTTP requests that are allowed
     * @property {Number} [preferredPartSize] Preferred part size
     */
    /**
     * Upload files to AEM
     * 
     * @param {BlockUploadOptions} options AEM upload options
     */
    async uploadFiles(options) {
        const preferredPartSize = options && options.preferredPartSize;
        const maxConcurrent = (options && options.concurrent && options.maxConcurrent) || 1;

        const controller = new TransferController();
        controller.on(TransferEvents.TRANSFER, transferEvent => {
            console.log("transferstart transferPart", transferEvent.transferAsset.eventData);
            this.emit("transferstart transferPart", transferEvent.transferAsset.eventData);
        });
        controller.on(TransferEvents.JOIN_TRANSFER_PARTS, transferEvent => {
            console.log("fileprogress", {
                ...transferEvent.transferAsset.eventData,
                transferred: transferEvent.props.transferBytes
            });
            this.emit("fileprogress", {
                ...transferEvent.transferAsset.eventData,
                transferred: transferEvent.props.transferBytes
            });
        });
        controller.on(TransferEvents.AFTER_TRANSFER, transferEvent => {
            console.log("aftertransfer transferPart", transferEvent.transferAsset.eventData);
            this.emit("aftertransfer", transferEvent.transferAsset.eventData);
        });
        const errorEvents = [];
        controller.on(TransferEvents.ERROR, transferEvent => {
            if (transferEvent.props.firstError) {
                errorEvents.push(transferEvent);
                console.log("fileerror", {
                    ...transferEvent.transferAsset.eventData,
                    errors: [ UploadError.fromError(transferEvent.error) ]
                });
                this.emit("fileerror", {
                    ...transferEvent.transferAsset.eventData,
                    errors: [ UploadError.fromError(transferEvent.error) ]
                });
            }
        });

        const retryOptions = {
            retryMaxCount: 5
        };
        
        // Build and execute pipeline
        const randomFileAccess = new RandomFileAccess();
        try {
            const pipeline = new Pipeline(
                new FailUnsupportedAssets(),
                new CreateTransferParts({ preferredPartSize }),
                new MapConcurrent(new Transfer(randomFileAccess, retryOptions), { maxConcurrent }),
                new JoinTransferParts,
                new CloseFiles(randomFileAccess),
            );
            pipeline.setFilterFunction(new FilterFailedAssets);
            await executePipeline(pipeline, generateBlockUploadTransfer(options), controller);
            if(errorEvents && errorEvents.length > 0) {
                // delete file (not needed - to be removed)
                
                // console.log('DBG delete start');
                // errorEvents.forEach(element => {
                //     console.log('DBG errorEvents.forEach',element);
                //     const transferAsset = element.transferAsset;
                //     if(transferAsset.multipartTarget) {
                //         transferAsset.multipartTarget.targetUrls.forEach(url => {
                //             console.log('DBG transferAsset.multipartTarget.targetUrls.forEach',url);
                //             //fetch.issueDelete
                //             issueDelete(url);
                //         });
                //     } else if(transferAsset.target) {
                //         const url = transferAsset.target.url;
                //         //fetch.issueDelete target
                //         issueDelete(url);
                //     }
                // });
                
                // throw the first emitted error
                throw errorEvents[0].error;
            }
        } finally {
            await randomFileAccess.close();
        }
    }

}

module.exports = {
    BlockUpload
};