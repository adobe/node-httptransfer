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
const { createHttpReadClient } = require("../http/httpreadclient");
const { retry } = require("../retry");

async function readHttpPart(client, transferPart, headers, options) {
    return retry(async () => {
        if (!client) {
            client = await createHttpReadClient(transferPart.source, headers);
        }
        const { start, end } = transferPart.source;
        const buffer = await client.read(end - start);
        return { buffer, client };
    }, options);
}

async function* readHttpParts(firstTransferPart, transferParts, headers, options) {
    let { buffer, client } = await readHttpPart(undefined, firstTransferPart, headers, options);
    yield new TransferPart(firstTransferPart.source, firstTransferPart.target, buffer);

    for await (const transferPart of transferParts) {
        if (!transferPart.source) {
            throw Error(`Transfer part does not provide a source: ${transferPart}`);
        } else if (transferPart.source.uri !== firstTransferPart.source.uri) {
            throw Error(`Transfer part does not match first part source: ${transferPart}, first part: ${firstTransferPart}`);
        } else if (client && (client.offset !== transferPart.source.start)) {
            throw Error(`Transfer part offset does not match stream offset: ${transferPart}, current offset: ${client.offset}`);
        }

        ({ client, buffer } = await readHttpPart(client, transferPart, headers, options));
        yield new TransferPart(
            transferPart.source,
            transferPart.target,
            buffer
        );
    }
}

async function readFilePart(fileHandle, transferPart) {
    const { start, end } = transferPart.source;
    const buffer = Buffer.allocUnsafe(end - start);
    const { bytesRead } = await fileHandle.read(buffer, 0, end - start, start);
    return buffer.slice(0, bytesRead);
}

async function* readFileParts(firstTransferPart, transferParts) {
    const path = fileURLToPath(firstTransferPart.source.uri);
    const fileHandle = await open(path, "r");

    try {
        const buffer = await readFilePart(fileHandle, firstTransferPart);
        yield new TransferPart(firstTransferPart.source, firstTransferPart.target, buffer);
    
        for (const transferPart of transferParts) {
            if (!transferPart.source) {
                throw Error(`Transfer part does not provide a source: ${transferPart}`);
            } else if (transferPart.source.uri !== firstTransferPart.source.uri) {
                throw Error(`Transfer part does not match first part source: ${transferPart}, first part: ${firstTransferPart}`);
            }
    
            const buffer = await readFilePart(fileHandle, transferPart);
            yield new TransferPart(firstTransferPart.source, firstTransferPart.target, buffer);            
        }    
    } finally {
        await fileHandle.close();
    }
}

/**
 * @typedef {Object} Headers
 */
/**
 * Read parts sequentially from a source
 */
class ReadStreamParts extends AsyncGeneratorFunction {
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
     * @param {TransferPart[]|AsyncGenerator|Generator} transferParts Sequential parts
     * @yields {TransferPart}
     */
    async* execute(transferParts) {
        const firstTransferPart = await transferParts.next();
        if (firstTransferPart.done) {
            return;
        } else if (!firstTransferPart.source) {
            throw Error(`Transfer part does not provide a source: ${firstTransferPart}`);
        }

        const { uri } = firstTransferPart.source;
        if (isFileProtocol(uri)) {
            yield* readFileParts(firstTransferPart, transferParts);
        } else {
            yield* readHttpParts(firstTransferPart, transferParts);
        }
    }
}

module.exports = {
    ReadStreamParts
};