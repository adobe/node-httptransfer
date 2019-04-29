/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

"use strict";

const fs = require("fs-extra");
const path = require("path");
const URL = require("url");
const yargs = require("yargs");
const azureStorageBlob = require("@azure/storage-blob");
const { downloadFile, uploadFile, transferStream } = require("@nui/node-httptransfer");

function createAzureSAS(auth, containerName, blobName, permissions) {
    if (!auth || !auth.accountName || !auth.accountKey) {
        throw Error("Azure Storage credentials not provided");
    }
    const credential = new azureStorageBlob.SharedKeyCredential(
        auth.accountName,
        auth.accountKey
    );
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const query = azureStorageBlob.generateBlobSASQueryParameters({
        protocol: azureStorageBlob.SASProtocol.HTTPS,
        expiryTime: new Date(Date.now() + ONE_HOUR_MS),
        containerName,
        blobName,
        permissions
    }, credential).toString();
    const path = encodeURIComponent(`${containerName}/${blobName}`);
    return `https://${auth.accountName}.blob.core.windows.net/${path}?${query}`;
}

async function resolveLocation(value, options) {
    const url = URL.parse(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
        return {
            url: value
        };
    } else if (url.protocol === "azure:") {
        return {
            url: createAzureSAS(
                options.azureAuth, 
                url.host, 
                url.path.substring(1), // skip the '/' prefix
                options.writable ? "cw" : "r"
            ),
            headers: {
                "x-ms-blob-type": "BlockBlob"
            }
        }
    } else if (url.protocol === "file:" || url.protocol === null) {
        if (url.host) {
            throw Error(`File URIs with a host component are not supported: ${value}`);
        }
        const urlPath = decodeURIComponent(url.path);
        const filePath = path.resolve(process.cwd(), urlPath);
        if (!options.writable) {
            await fs.access(filePath, fs.constants.R_OK);
        }
        return {
            file: filePath
        }
    } else {
        throw Error(`Unsupported source/target: ${value}`);
    }
}

async function main() {
    // parse command line
    const params = yargs
        .strict()
        .command('* <source> <target>', 'Testbed for node-httptransfer.', yargs => 
            yargs
                .positional('source', {
                    describe: 'File, URL, or azure://container/path/to/blob to retrieve content from',
                    type: 'string'
                })
                .positional('target', {
                    describe: 'File, URL, or azure://container/path/to/blob to send content to',
                    type: 'string'
                })
                .option('min', {
                    describe: 'Minimum part size',
                    type: 'number',
                    default: 0
                })
                .option('max', {
                    describe: 'Maximum part size',
                    type: 'number',
                    default: 100*1000*1000
                })
                .option('num', {
                    alias: 'n',
                    describe: 'Number of parts',
                    type: 'number'
                })
                .option("account-key", {
                    describe: "Azure storage account key. Environment variable: AZURE_STORAGE_KEY",
                    type: "string"
                })
                .option("account-name", {
                    describe: "Azure storage account name. Environment variable: AZURE_STORAGE_ACCOUNT",
                    type: "string"
                })
                .example("$0 azure://container/source.txt blob.txt", "Download path/to/source.txt in container to blob.txt")
                .example("$0 blob.txt azure://container/target.txt", "Upload blob.txt to path/to/target.txt in container")
                .example("$0 azure://container/source.txt azure://container/target.txt", "Transfer source.txt to target.txt in container")
        )
        .wrap(yargs.terminalWidth())
        .help()
        .argv;

    // capture azure storage credentials
    params.azureAuth = {
        accountKey: params["account-key"] || process.env.AZURE_STORAGE_KEY,
        accountName: params["account-name"] || process.env.AZURE_STORAGE_ACCOUNT
    };

    // resolve locations
    const source = await resolveLocation(params.source, Object.assign({}, params, {
        writable: false
    }));
    const target = await resolveLocation(params.target, Object.assign({}, params, {
        writable: true
    }));

    // transfer
    console.log(`Source: ${source.url || source.file}`);
    console.log(`Target: ${target.url || target.file}`);

    if (source.file && target.url) {
        await uploadFile(source.file, target.url, {
            headers: target.headers
        });
    } else if (source.url && target.file) {
        await downloadFile(source.url, target.file, {
            mkdirs: true
        });
    } else if (source.url && target.url) {
        await transferStream(source.url, target.url, {
            target: {
                headers: target.headers
            }
        });
    } else {
        throw Error("Transfer is not supported")
    }  
}

main()
    .catch(err => {
        console.error(err.message || err);
    })
