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

const { AEMInitiateUpload } = require("../functions/aeminitiateupload");
const { GetAssetMetadata } = require("../functions/getassetmetadata");
const { ReadParts } = require("../functions/readparts");
const { SplitSourceParts } = require("../functions/splitsourceparts");
const { AEMSplitMultiparts } = require("../functions/aemsplitmultipart");
const { AsyncGeneratorFunction } = require("../generator/function");
const { MapConcurrent } = require("../generator/mapconcurrent");
const { Pipeline } = require("../generator/pipeline");

// class ReadMultipart extends AsyncGeneratorFunction {
//     /**
//      * Execute the generator, yields the same number of results as input items
//      * 
//      * @generator
//      * @param {Asset[]|Generator||AsyncGenerator} sources asset sources
//      * @yields {Object} 
//      */
//     async* execute(sources) {
//         for await (const source of sources) {
//             // generate parts for multi-part
//             // generate virtual part for single-part
//         }
//     }
// }

/**
 * 
 * @param {AsyncGeneratorFunction} transferAssets 
 */
async function bulk(transferAssets) {
    const preferredSourcePartSize = 1024*1024;
  
    const { sources, targets } = await splitTransferAssets(new MapConcurrent(
        new GetAssetMetadata(), {
            maxConcurrent: 16,
            ordered: false
        }).execute(transferAssets));

    const sourcePipeline = new Pipeline(
        new SplitSourceParts(preferredSourcePartSize),
        new ReadParts()
    );
    
    const targetPipeline = new Pipeline(
        new MapConcurrent(new AEMInitiateUpload(), {
            maxConcurrent: 16,
            ordered: true
        }),
        new AEMSplitMultiparts()
    );

    for await (const transferAsset of gen.execute(transferAssets)) {
        const { source, target } = transferAsset;
        if (source.rangeReadSupport) {
            // generate parts
        } else {
            // create a single part
        }
        // map concurrently -- read parts
        // target -- 
    }
}

module.exports = {
    bulk
};
