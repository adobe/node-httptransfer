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
const axios = require("axios");
const { TransferPart } = require("../asset/transferpart");

/**
 * @typedef {Object} Headers
 */
/**
 * Download parts
 */
class WriteParts extends AsyncGeneratorFunction {
    /**
     * Construct function
     * 
     * @param {Headers} headers Headers to send to AEM
     */
    constructor(headers) {
        super();
        this.headers = Object.assign({}, headers);
    }

    /**
     * Initiates the upload of the given assets
     * 
     * @generator
     * @param {TransferPart[]} transferParts 
     * @yields {TransferPart}
     */
    async* execute(sources, targets) {
        const source = await sources.next();
        const target = await targets.next();
        while (!source.done && !target.done) {
            const sourcePart = source.value;
            const targetPart = target.value;

            if (sourcePart.asset.contentLength !== targetPart.asset.contentLength) {
                throw Error(`Mismatch`);
            }

            if (sourcePart.range === targetPart.range) {

            } else if (sourcePart.range)

            yield new TransferPart(sourcePart, targetPart, buffer);
        }

        // for await (const part of parts) {
        //     const response = await axios.get(part.uri, {
        //         headers: Object.assign(this.headers, {
        //             "Range": `bytes=${part.start}-${part.end}`
        //         })
        //     });
        //     //upload
        //     yield new TransferPart(part.source, part.target);
        // }
    }
}

module.exports = {
    WriteParts
};