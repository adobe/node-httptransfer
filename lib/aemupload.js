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

const { resolve: urlPathResolve, dirname: urlPathDirname, basename: urlPathBasename } = require("path").posix;
const { pathToFileURL } = require("url");
const { Asset } = require("./asset/asset");
const { TransferPart } = require("./asset/transferpart");
const { AssetMetadata } = require("./asset/assetmetadata");
const { TransferTracker } = require("./asset/transfertracker");
const { AEMInitiateUpload } = require("./functions/aeminitiateupload");
const { AEMCompleteUpload } = require("./functions/aemcompleteupload");
const { AsyncGeneratorFunction } = require("./generator/function");
const { MapBatch } = require("./generator/mapbatch");
const { MapConcurrent } = require("./generator/mapconcurrent");
const { Transfer } = require("./functions/transfer");
const { Pipeline } = require("./generator/pipeline");
const { RandomFileAccess } = require("./randomfileaccess");
const EventEmitter = require("events");

/**
 * Generate AEM upload transfer parts
 * 
 * @generator
 * @param {AEMUploadOptions} options 
 * @yields {TransferPart} Transfer part
 */
async function* generateAEMUploadTransferParts(options) {
    for (const uploadFile of options.uploadFiles) {
        const sourceUrl = pathToFileURL(uploadFile.filePath);
        const targetUrl = new URL(uploadFile.fileUrl);

        const source = new Asset(sourceUrl);
        const target = new Asset(targetUrl, undefined, options.headers);


        const transferPart = new TransferPart(source, target);
        transferPart.metadata = new AssetMetadata(uploadFile.filePath, undefined, uploadFile.fileSize);
        transferPart.acceptRanges = true;

        yield transferPart;
    }
}

/**
 * Track progress, emits events
 */
class AEMUploadTracker extends AsyncGeneratorFunction {
    constructor(aemUpload) {
        super();
        this.aemUpload = aemUpload;
        this.transferTracker = new TransferTracker();
    }
    async* execute(transferParts) {
        for await (const transferPart of transferParts) {
            const fileEvent = {
                fileName: transferPart.source.url.pathname,
                fileSize: transferPart.metadata.contentLength,
                targetFolder: urlPathDirname(transferPart.target.url.pathname),
                targetFile: urlPathBasename(transferPart.target.url.pathname),
                mimeType: transferPart.metadata.contentType
            };

            if (this.transferTracker.isStart(transferPart)) {
                this.aemUpload.emit("filestart", fileEvent);
            } 
            
            const isComplete = this.transferTracker.record(transferPart);
            const transferred = this.transferTracker.getTransferred(transferPart);
            
            if (isComplete) {
                this.aemUpload.emit("fileend", fileEvent);
            } else {
                this.aemUpload.emit("fileprogress", Object.assign({}, fileEvent, {
                    transferred
                }));
            }

            yield transferPart;
        }
    }
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

        // Build pipeline
        const randomFileAccess = new RandomFileAccess();
        const pipeline = new Pipeline(
            new MapBatch(new AEMInitiateUpload({ preferredPartSize }), { maxBatchLength: 100 }),
            new MapConcurrent(new Transfer(randomFileAccess), { maxConcurrent }),
            new AEMCompleteUpload(),
            new AEMUploadTracker(this)
        );

        // Execute pipeline
        await pipeline.execute(
            generateAEMUploadTransferParts(options)
        );        
    }
}

module.exports = {
    AEMUpload
};
