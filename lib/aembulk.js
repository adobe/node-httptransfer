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

const { opendir } = require("fs").promises;
const { resolve: localPathResolve } = require("path");
const { resolve: urlPathResolve } = require("path").posix;
const { pathToFileURL } = require("url");
const { Asset } = require("./asset/asset");
const { TransferAsset } = require("./asset/transferasset");
const { AEMInitiateUpload } = require("./functions/aeminitiateupload");
const { AEMCompleteUpload } = require("./functions/aemcompleteupload");
const { GetAssetMetadata } = require("./functions/getassetmetadata");
const { MapBatch } = require("./generator/mapbatch");
const { MapConcurrent } = require("./generator/mapconcurrent");
const { Transfer } = require("./functions/transfer");
const { Pipeline } = require("./generator/pipeline");
const { RandomFileAccess } = require("./randomfileaccess");

/**
 * Generate a transfer asset for each file in local folder
 * 
 * @generator
 * @param {String} localFolder Local folder of assets to upload
 * @param {URL} aemFolder AEM folder to upload the assets
 * @param {*} aemHeaders AEM headers
 * @yields {TransferAsset} Transfer asset
 */
async function* generateUploadTransferRecords(localFolder, aemFolder, aemHeaders) {
    const dir = await opendir(localFolder);
    for await (const dirent of dir) {
        if (dirent.isFile()) {
            const sourceUrl = pathToFileURL(localPathResolve(localFolder, dirent.name));
            const targetUrl = new URL(urlPathResolve(aemFolder.pathname, dirent.name), aemFolder);

            const source = new Asset(sourceUrl);
            const target = new Asset(targetUrl, undefined, aemHeaders);
            yield new TransferAsset(source, target);
        }
    }
}

/**
 * Upload an entire directory to AEM
 * 
 * @param {String} localFolder Local folder
 * @param {URL} aemFolder AEM folder
 */
async function bulkUpload(localFolder, aemFolder) {
    const aemHeaders = {
        "authorization": `Basic ${Buffer.from("admin:admin").toString("base64")}`
    };

    // Build pipeline
    const randomFileAccess = new RandomFileAccess();
    const pipeline = new Pipeline(
        new GetAssetMetadata(),
        new MapBatch(new AEMInitiateUpload({ preferredPartSize: 10*1024*1024 }), { maxBatchLength: 100 }),
        new MapConcurrent(new Transfer(randomFileAccess), { maxConcurrent: 4 }),
        new AEMCompleteUpload(),
        // transferProgress
    );

    // Execute pipeline
    await pipeline.execute(
        generateUploadTransferRecords(localFolder, aemFolder, aemHeaders)
    );
    
    // const result = ;
    // const startTime = Date.now();
    // let totalTransfer = 0;
    // for await (const transferPart of result) {
    //     totalTransfer += transferPart.contentRange.length;
    //     const transferKBps = Math.round((totalTransfer / 1024) / ((Date.now() - startTime) / 1000));
    //     console.log(`Transferred ${Math.round(totalTransfer/1024)} KBytes at ${transferKBps} KB/s`);
    // }
}

module.exports = {
    bulkUpload
};
