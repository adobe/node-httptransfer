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
const { TransferPart } = require("./asset/transferpart");
const { AEMInitiateUpload } = require("./functions/aeminitiateupload");
const { GetAssetMetadata } = require("./functions/getassetmetadata");
const { MapBatch } = require("./generator/mapbatch");
const { MapConcurrent } = require("./generator/mapconcurrent");
const { Transfer } = require("./functions/transfer");
const { Pipeline } = require("./generator/pipeline");
const { RandomFileAccess } = require("./randomfileaccess");

/**
 * 
 * @param {*} aemFolder 
 * @param {*} localFolder 
 * @param {*} options 
 */
async function bulkDownload(aemFolder, localFolder, options) {
//tbd
}

/**
 * Generate a transfer record for each file in local folder
 * 
 * @generator
 * @param {String} localFolder Local folder of assets to upload
 * @param {URL} aemFolder AEM folder to upload the assets
 * @param {*} aemHeaders AEM headers
 * @yields {TransferPart} Transfer record
 */
async function* generateUploadTransferRecords(localFolder, aemFolder, aemHeaders) {
    const dir = await opendir(localFolder);
    for await (const dirent of dir) {
        if (dirent.isFile()) {
            const sourceUrl = pathToFileURL(localPathResolve(localFolder, dirent.name));
            const targetUrl = new URL(urlPathResolve(aemFolder.pathname, dirent.name), aemFolder);

            const source = new Asset(sourceUrl);
            const target = new Asset(targetUrl, undefined, aemHeaders);
            yield new TransferPart(source, target);
        }
    }
}

/**
 * Upload an entire directory to AEM
 * 
 * @param {String} localFolder Local folder
 * @param {URL} aemFolder AEM folder
 * @param {*} [options] Bulk upload options
 */
async function bulkUpload(localFolder, aemFolder, options) {
    const aemHeaders = {
        "authorization": `Basic ${Buffer.from("admin:admin").toString("base64")}`
    };

    const randomFileAccess = new RandomFileAccess();

    const pipeline = new Pipeline(
        new GetAssetMetadata(),
        new MapBatch(new AEMInitiateUpload({ preferredPartSize: 10*1024*1024 }), { maxBatchLength: 100 }),
        /*new MapConcurrent(*/new Transfer(randomFileAccess)/*, { maxConcurrent: 16 })*/
    );
    
    const result = pipeline.execute(generateUploadTransferRecords(localFolder, aemFolder, aemHeaders));
    for await (const transferPart of result) {
        console.log(transferPart.source.url.toString(), transferPart.contentRange);
    }


    // const preferredPartSize = (options && options.preferredPartSize) || 1024*1024;
  
    // const { sources, targets } = await splitTransferAssets(new MapConcurrent(
    //     new GetAssetMetadata(), {
    //         maxConcurrent: 16,
    //         ordered: false
    //     }).execute(transferAssets));

    // const sourcePipeline = new Pipeline(
    //     new SplitSourceParts(preferredSourcePartSize),
    //     new ReadParts()
    // );
    
    // const targetPipeline = new Pipeline(
    //     new MapConcurrent(new AEMInitiateUpload(), {
    //         maxConcurrent: 16,
    //         ordered: true
    //     }),
    //     new AEMSplitMultiparts()
    // );

    // for await (const transferAsset of gen.execute(transferAssets)) {
    //     const { source, target } = transferAsset;
    //     if (source.rangeReadSupport) {
    //         // generate parts
    //     } else {
    //         // create a single part
    //     }
    //     // map concurrently -- read parts
    //     // target -- 
    // }
}

module.exports = {
    bulkUpload,
    bulkDownload
};
