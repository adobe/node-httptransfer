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

const fs = require("fs").promises;
const filterObject = require("filter-obj");
const mime = require("mime-types");
const { Asset } = require("./asset/asset");
const { AssetMetadata } = require("./asset/assetmetadata");
const { AssetMultipart } = require("./asset/assetmultipart");
const { CloseFiles } = require("./functions/closefiles");
const { CreateTransferParts } = require("./functions/transferpartscreate");
const { JoinTransferParts } = require("./functions/transferpartsjoin");
const { MapConcurrent } = require("./generator/mapconcurrent");
const { Pipeline } = require("./generator/pipeline");
const { RandomFileAccess } = require("./randomfileaccess");
const { Transfer } = require("./functions/transfer");
const { TransferAsset } = require("./asset/transferasset");
const { TransferController } = require("./asset/transfercontroller");
const { pathToFileURL } = require("url");

/**
 * @typedef {Object} UploadAEMMultipartOptions
 *
 * @property {Number} [timeout] Optional socket timeout
 * @property {Object} [headers] Optional override of request headers
 * @property {Number} [partSize] Optional custom preferred part size. Might be adjusted depending on the target.
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Number} [maxConcurrent=1] maximum concurrent uploads
 * @property {String} [contentType] content-type to use to upload the parts
 */
/**
 * @typedef {Object} UploadAEMMultipartTarget
 *
 * @property {String[]} urls URLs
 * @property {Number} maxPartSize Maximum size of each part
 * @property {Number} [minPartSize] Minimum size of each part (defaults to maxPartSize)
 */
/**
 * Upload a file in multiple parts to a set of URLs.
 * Intended to be used with AEM/Oak, see for more information:
 * http://jackrabbit.apache.org/oak/docs/apidocs/org/apache/jackrabbit/api/binary/BinaryUpload.html
 *
 * @param {String} filepath Source file path
 * @param {UploadAEMMultipartTarget} target Target urls
 * @param {UploadAEMMultipartOptions} [options] Upload options
 * @returns {Promise} resolves when upload completes
 */
async function uploadAEMMultipartFile(filepath, target, options) {
    if (!target) {
        throw Error('target not provided');
    } else if (!target.urls || target.urls.length === 0) {
        throw Error('invalid number of target urls');
    } else if (!target.maxPartSize) {
        throw Error('maxPartSize not provided');
    }

    //
    const transferOptions = filterObject(
        options || {},
        [ 'timeout', 'headers',
            'retryMaxDuration', 'retryInterval', 'retryEnabled', 'retryAllErrors' ]
    );

    // Build the transfer asset
    const { size } = await fs.stat(filepath);
    const contentType = (options && options.contentType) || mime.lookup(filepath);
    const transferAsset = new TransferAsset(
        new Asset(pathToFileURL(filepath)), 
        new Asset(new URL("unused://")), 
        {
            acceptRanges: true,
            metadata: new AssetMetadata(filepath, contentType, size),
            multipartTarget: new AssetMultipart(target.urls, target.minPartSize || 1, target.maxPartSize, options && options.headers)
        }
    );

    // Build pipeline
    const controller = new TransferController();
    const randomFileAccess = new RandomFileAccess();
    try {
        const maxConcurrent = (options && options.maxConcurrent) || 1;
        const pipeline = new Pipeline(
            new CreateTransferParts({ preferredPartSize: options && options.partSize }),
            new MapConcurrent(new Transfer(randomFileAccess, transferOptions), { maxConcurrent }),
            new JoinTransferParts(controller),
            new CloseFiles(randomFileAccess)
        );    
        await pipeline.execute([ transferAsset ]);
    } finally {
        await randomFileAccess.close();
    }
}

module.exports = {
    uploadAEMMultipartFile
};