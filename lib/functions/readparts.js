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
const { open } = require("fs").promises;
const { TransferPart } = require("../asset/transferpart");
const { fileURLToPath } = require("url");
const { isFileProtocol } = require("../util");

/**
 * @typedef {Object} Headers
 */
/**
 * Download parts
 */
class ReadParts extends AsyncGeneratorFunction {
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
     * @param {TransferPart[]|AsyncGenerator|Generator} transferParts 
     * @yields {TransferPart}
     */
    async* execute(parts) {
        for await (const part of parts) {
            if (part.buffer) {
                // nothing to do
                yield part;
            } else if (part.source) {
                const { uri, start, end } = part.source;
                if (isFileProtocol(uri)) {
                    const buffer = Buffer.allocUnsafe(end - start);
                    const path = fileURLToPath(uri);
                    const handle = await open(path, "r");
                    try {
                        await handle.read(buffer, 0, end - start, start);
                    } finally {
                        await handle.close();
                    }
                    yield new TransferPart(
                        part.source,
                        part.target,
                        buffer
                    );
                } else {

                }
            } else {
                throw Error(`Transfer part does not provide a source: ${part}`);
            }
        }
    }
}

module.exports = {
    ReadParts
};