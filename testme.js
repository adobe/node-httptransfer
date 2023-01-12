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

const { Asset } = require("./lib/asset/asset");
const { AggregateBuffers } = require("./lib/functions/aggregatebuffers");
const { GetAssetMetadata } = require("./lib/functions/getassetmetadata");
const { HttpDownload } = require("./lib/functions/httpdownload");
const { Pipeline } = require("./lib/generator/pipeline");
const { TransferAsset }  = require("./lib/asset/transferasset");
const { TransferController } = require("./lib/controller/transfercontroller");
const { pathToFileURL } = require("url");
const { CreateTransferParts } = require("./lib/functions/transferpartscreate");

async function main() {
    const source = new Asset("https://adobesampleassetsrepo.blob.core.windows.net/adobe-sample-asset-repository/video%2Favi%2F16x9_AVI.avi?sv=2020-06-12&spr=https&se=2021-07-20T19%3A25%3A20Z&sr=b&sp=r&sig=NuTJ958nVbf0qQwy1499QIY9GR3Wl68ondbeMqYQa1Q%3D", 
    // {
    //     "x-ms-blob-type": "BlockBlob"
    // }
    );
    const target = new Asset(pathToFileURL("./16x9_AVI.avi"));
    const transferAsset = new TransferAsset(source, target);
    const controller = new TransferController();

    const pipeline = new Pipeline(
        new GetAssetMetadata(),
        new CreateTransferParts(),
        new HttpDownload({ partSize: 1024*1024 }),
        new AggregateBuffers(1024*1024)
    );

    console.log(1);

    for await (const chunk of pipeline.execute([transferAsset], controller)) {
        console.log("Downloaded chunk: ", chunk.length);
    }

    console.log(2);
}

main()
    .then(() => console.log("done"))
    .catch(e => console.error("Failed", e));
