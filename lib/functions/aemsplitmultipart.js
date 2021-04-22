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

"use strict";

const { AsyncGeneratorFunction } = require("../generator/function");
const { AEMMultipartAsset } = require("../asset/aemmultipart");
const { Asset } = require("../asset/asset");
const { isFileProtocol } = require("../util");
const { Part } = require("../asset/part");
const { TransferPart } = require("../asset/transferpart");

const ONE_MB = 1024*1024;

/**
 * Calculate that partSize based on the the available urls, and server-side
 * provided limitations on each part.
 * 
 * @param {AEMMultipartAsset} target AEM multi-part asset
 * @param {Number} contentLength Content length
 * @param {Number} preferredPartLength Preferred part length
 * @returns {Number} The calculated part size
 */
function calculatePartSize(target, contentLength, preferredPartLength) {
    const numTargetUris = target.uris.length;
    if (Math.ceil(contentLength / target.maxPartSize) <= numTargetUris) {
        return Math.max(
            Math.ceil(contentLength / numTargetUris),
            preferredPartLength,
            target.minPartSize
        );
    } else {
        throw Error(`Target does not fit in the provided urls: ${target}, length: ${contentLength}`);
    }
}

/**
 * Split the given content length in partLength parts
 * 
 * @generator
 * @param {Number} contentLength Length of content in bytes
 * @param {Number} partSize Length of part in bytes
 * @yields {{source, target, idx}} Tuple for each part
 */
function* generateParts(contentLength, partLength) {
    let start = 0;
    let idx = 0;
    while (start < contentLength) {
        const end = Math.min(start + partLength, contentLength);
        yield { start, end, idx };
        start = end;
        ++idx;
    }
}

/**
 * Split {TransferAsset} in to {TransferPart}
 */
class SplitParts extends AsyncGeneratorFunction {
    /**
     * Construct a transfer asset to part splitter
     * 
     * @param {Number} [preferredPartSize=1048576] Preferred part size
     */
    constructor(preferredPartSize) {
        super();
        this.preferredPartSize = preferredPartSize || ONE_MB;
    }
    /**
     * Initiates the upload of the given assets
     * 
     * @generator
     * @param {TransferAsset[]|Generator||AsyncGenerator} atransferassetsssets  
     * @yields {Part}
     */
    async* execute(transferAssets) {
        const preferredPartSize = this.preferredPartSize;
        for await (const { source, target, contentLength } of transferAssets) {
            if (!contentLength) {
                throw Error(`Content length not provided by source: ${source} or target: ${target}`);
            }
            if (source && !target) {
                // only source, can split that by preferredPartSize
                for (const { start, end } of generateParts(contentLength, preferredPartSize)) {
                    yield new TransferPart(
                        new Part(source, source.uri, start, end)
                    );
                }   
            } else if (target instanceof AEMMultipartAsset) {
                // multi-part target, use a separate uri per part
                // may not have a source
                const partSize = calculatePartSize(target, contentLength, preferredPartSize);
                for (const { start, end, idx } of generateParts(contentLength, partSize)) {
                    const targetUri = target.uris[idx];
                    yield new TransferPart(
                        source && new Part(source, source.uri, start, end), 
                        new Part(target, targetUri, start, end)
                    );
                }
            } else if (target instanceof Asset) {
                // single-part target, if it's a local file we can split by preferredPartSize
                // may not have a source
                if (isFileProtocol(target.uri)) {
                    // file targets can be split by preferredPartSize
                    for (const { start, end } of generateParts(contentLength, preferredPartSize)) {
                        yield new TransferPart(
                            source && new Part(source, source.uri, start, end), 
                            new Part(target, target.uri, start, end)
                        );
                    }    
                } else {
                    // url targets cannot be split
                    yield new TransferPart(
                        source && new Part(source, source.uri, 0, contentLength),
                        new Part(target, target.uri, 0, contentLength)
                    );
                }
            } else if (target) {
                throw Error(`Unsupported target for split parts: ${target}`);
            } else {
                throw Error("No target or source provided");
            }
        }
    }
}

module.exports = {
    SplitParts
};