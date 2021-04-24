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
const { Part } = require("../asset/part");

const ONE_MB = 1024*1024;

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
 * Split a source {Asset} in to {Part}
 * 
 * These parts will then be read in a second stage.
 */
class SplitSourceParts extends AsyncGeneratorFunction {
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
     * Split source assets in to parts
     * 
     * @generator
     * @param {Asset[]|Generator||AsyncGenerator} assets Source assets  
     * @yields {Part} Source parts
     */
    async* execute(assets) {
        const preferredPartSize = this.preferredPartSize;
        for await (const asset of assets) {
            if (!asset.contentLength) {
                throw Error(`Content length not provided by source asset: ${asset}`);
            } else if (asset.rangeReadSupport) {
                for (const { start, end } of generateParts(asset.contentLength, preferredPartSize)) {
                    yield new Part(asset, asset.uri, start, end);
                }    
            } else {
                yield new Part(asset, asset.uri, 0, asset.contentLength);
            }
        }
    }
}

module.exports = {
    SplitSourceParts
};