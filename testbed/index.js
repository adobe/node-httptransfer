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

const filterObject = require('filter-obj');
const fs = require("fs").promises;
const path = require("path");
const URL = require("url");
const yargs = require("yargs");
const azureStorageBlob = require("@azure/storage-blob");
const leftPad = require("left-pad");
const {
    downloadFile, uploadFile, uploadAEMMultipartFile,
    transferStream,
    getResourceHeaders
} = require("@nui/node-httptransfer");

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

async function commitAzureBlocks(auth, containerName, blobName) {
    const credential = new azureStorageBlob.SharedKeyCredential(
        auth.accountName,
        auth.accountKey
    );
    const path = encodeURIComponent(`${containerName}/${blobName}`);
    const url = `https://${auth.accountName}.blob.core.windows.net/${path}`;
    const blobURL = new azureStorageBlob.BlockBlobURL(
        url,
        azureStorageBlob.BlockBlobURL.newPipeline(credential)
    );
    const blockList = await blobURL.getBlockList(
        azureStorageBlob.Aborter.none,
        "uncommitted"
    );
    await blobURL.commitBlockList(
        azureStorageBlob.Aborter.none,
        blockList.uncommittedBlocks.map(x => x.name)
    );
}

async function resolveLocation(value, options) {
    const url = URL.parse(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
        return {
            url: value
        };
    } else if (url.protocol === "azure:") {
        const numParts = options.numParts || Math.ceil(options.size / options.maxPartSize);
        const sasUrl = createAzureSAS(
            options.azureAuth,
            url.host,
            url.path.substring(1), // skip the "/" prefix
            options.writable ? "cw" : "r"
        );
        if (numParts > 1) {
            const urls = [];
            for (let i = 0; i < numParts; ++i) {
                // each block id must be the same size
                const blockId = Buffer.from(leftPad(i, 10, 0)).toString("base64");
                urls.push(`${sasUrl}&comp=block&blockid=${blockId}`);
            }
            return {
                minPartSize: options.minPartSize,
                maxPartSize: options.maxPartSize,
                urls
            }
        } else {
            return {
                url: sasUrl,
                headers: {
                    "x-ms-blob-type": "BlockBlob"
                }
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
        .command("* <source> <target>", "Testbed for node-httptransfer", yargs =>
            yargs
                .positional("source", {
                    describe: "File, URL, or azure://container/path/to/blob to retrieve content from",
                    type: "string"
                })
                .positional("target", {
                    describe: "File, URL, or azure://container/path/to/blob to send content to",
                    type: "string"
                })
                .option("minPartSize", {
                    alias: "min",
                    describe: "Minimum part size",
                    type: "number",
                    default: 0
                })
                .option("maxPartSize", {
                    alias: "max",
                    describe: "Maximum part size",
                    type: "number",
                    default: 100*1000*1000
                })
                .option("numParts", {
                    alias: "n",
                    describe: "Number of parts",
                    type: "number"
                })
                .option("headerGet", {
                    describe: "Use GET to fetch response headers",
                    type: "boolean"
                })
                .option("account-key", {
                    describe: "Azure storage account key. Environment variable: AZURE_STORAGE_KEY",
                    type: "string"
                })
                .option("account-name", {
                    describe: "Azure storage account name. Environment variable: AZURE_STORAGE_ACCOUNT",
                    type: "string"
                })
                .option("retryEnabled", {
                    describe: "Enable or disable retry on failure",
                    type: "boolean",
                    default: true
                })
                .option("retryAllErrors", {
                    describe: "Whether or not to retry on all http error codes or just >=500",
                    type: "boolean",
                    default: false
                })
                .option("retryMax", {
                    describe: "Time to retry until throwing an error (ms)",
                    type: "number",
                    default: 60000
                })
                .option("retryInterval", {
                    describe: "Time between retries, used by exponential backoff (ms)",
                    type: "number",
                    default: 100
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

    // capture retry options
    const retryOptions = filterObject(
        params,
        [ "retryEnabled", "retryAllErrors", "retryMax", "retryInterval" ]
    );

    // resolve source
    const source = await resolveLocation(params.source, { ...params, writable: false});

    let size;
    if (source.url) {
        const headers = await getResourceHeaders(source.url, {
            doGet: params.headerGet,
            ...retryOptions
        });
        size = headers.size;
    } else if (source.file) {
        const stats = await fs.stat(source.file);
        size = stats.size;
    }

    console.log(`Source: ${source.url || source.file}, ${size} bytes`);

    // resolve target
    const target = await resolveLocation(params.target, { ...params, writable: true,
        size});
    if (target.urls) {
        console.log(`Target: ${target.urls.length} parts, ${target.urls[0]}`);
    } else {
        console.log(`Target: ${target.url || target.file}`);
    }

    // transfer
    if (source.file && target.url) {
        await uploadFile(source.file, target.url, {
            headers: target.headers,
            ...retryOptions
        });
    } else if (source.url && target.file) {
        await downloadFile(source.url, target.file, {
            mkdirs: true,
            ...retryOptions
        });
    } else if (source.url && target.url) {
        await transferStream(source.url, target.url, {
            target: {
                headers: target.headers
            },
            ...retryOptions
        });
    } else if (source.file && target.urls) {
        await uploadAEMMultipartFile(source.file, target, {
            ...retryOptions
        });

        console.log("Commit uncommitted blocks");
        const url = URL.parse(params.target);
        await commitAzureBlocks(params.azureAuth, url.host, url.path.substring(1));
    } else {
        throw Error("Transfer is not supported")
    }
}

main()
    .catch(err => {
        console.error(err.message || err);
    })
