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

const filterObject = require("filter-obj");
const fs = require("fs").promises;
const path = require("path");
const { R_OK } = require("fs").constants;
const { resolve: localPathResolve } = require("path");
const { resolve: urlPathResolve } = require("path").posix;
const yargs = require("yargs");
const {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    SASProtocol,
    BlobSASPermissions
} = require("@azure/storage-blob");
const {
    downloadFile, uploadFile, uploadAEMMultipartFile,
    transferStream,
    getResourceHeaders,
    AEMUpload,
    AEMDownload,
    BlockUpload,
    BlockDownload
} = require("../index.js");

const BLOB_MIN_BLOCK_SIZE = 64 * 1024; // 64 kb

function createAzureCredential(auth) {
    if (!auth || !auth.accountName || !auth.accountKey) {
        throw Error("Azure Storage credentials not provided");
    }
    return new StorageSharedKeyCredential(auth.accountName, auth.accountKey);
}

function createAzureContainerClient(auth, containerName) {
    const sharedKeyCredential = createAzureCredential(auth);
    const blobServiceClient = new BlobServiceClient(
        `https://${auth.accountName}.blob.core.windows.net`,
        sharedKeyCredential
    );
    return blobServiceClient.getContainerClient(containerName);
}

function createAzureSAS(auth, containerName, blobName, perm="r") {
    const containerClient = createAzureContainerClient(auth, containerName);

    const permissions = new BlobSASPermissions();
    permissions.read = perm.includes("r");
    permissions.write = perm.includes("w");
    permissions.delete = perm.includes("d");

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const sharedKeyCredential = createAzureCredential(auth);
    const blobClient = containerClient.getBlockBlobClient(blobName);
    const query = generateBlobSASQueryParameters({
        protocol: SASProtocol.Https,
        expiresOn: new Date(Date.now() + ONE_HOUR_MS),
        containerName,
        blobName,
        permissions
    }, sharedKeyCredential).toString();

    return `${blobClient.url}?${query}`;
}

async function commitAzureBlocks(auth, containerName, blobName) {
    const containerClient = createAzureContainerClient(auth, containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);
    const blockList = await blobClient.getBlockList("uncommitted");
    await blobClient.commitBlockList(blockList.uncommittedBlocks.map(x => x.name));
}

async function resolveLocation(value, options) {
    if (value.startsWith("https:") || value.startsWith("http:")) {
        return {
            url: new URL(value)
        };
    } else if (value.startsWith("azure:")) {
        const numParts = options.numParts || Math.ceil(options.size / options.maxPartSize);
        const url = new URL(value);
        const sasUrl = createAzureSAS(
            options.azureAuth,
            url.host,
            url.pathname.substring(1), // skip the "/" prefix
            options.writable ? "cw" : "r"
        );
        if (numParts > 1) {
            const urls = [];
            for (let i = 0; i < numParts; ++i) {
                // each block id must be the same size
                const blockId = Buffer.from(String(i).padStart(10, "0")).toString("base64");
                urls.push(`${sasUrl}&comp=block&blockid=${blockId}`);
            }
            return {
                minPartSize: options.minPartSize,
                maxPartSize: options.maxPartSize,
                urls
            };
        } else {
            return {
                url: sasUrl,
                headers: {
                    "x-ms-blob-type": "BlockBlob"
                }
            };
        }
    } else {
        if (!options.writable) {
            await fs.access(value, R_OK);
        }
        return {
            file: value
        };
    }
}

/**
 * Create bulk AEM upload options
 * 
 * @param {String} localFolder Local folder
 * @param {String} aemFolderUrl AEM folder url
 * @param {*} params Command line parameters
 * @returns {AEMUploadOptions} AEM upload options
 */
async function createAEMUploadOptions(localFolder, aemFolderUrl, params) {
    const uploadFiles = [];
    const nameConflictPolicy = params.nameConflictPolicy || {};

    const dir = await fs.opendir(localFolder);
    for await (const dirent of dir) {
        if (dirent.isFile()) {
            const filePath = localPathResolve(localFolder, dirent.name);
            const { size: fileSize } = await fs.stat(filePath); 
            const fileUrl = new URL(urlPathResolve(aemFolderUrl.pathname, dirent.name), aemFolderUrl);
            uploadFiles.push({ fileUrl, fileSize, filePath, ...nameConflictPolicy });
        }
    }

    const authorization = "Basic " + Buffer.from(`${params.aemAuth.username}:${params.aemAuth.password}`).toString("base64");
    return {
        uploadFiles,
        headers: {
            authorization
        },
        concurrent: true,
        maxConcurrent: params.maxConcurrent,
        preferredPartSize: params.partSize
    };
}

/**
 * Create bulk AEM download options
 * 
 * @param {String} aemFolderUrl AEM folder url
 * @param {String} localFolder Local folder url
 * @param {*} params 
 */
async function createAEMDownloadOptions(aemFolderUrl, localFolder, params) {
    const authorization = "Basic " + Buffer.from(`${params.aemAuth.username}:${params.aemAuth.password}`).toString("base64");
    const fetch = require("node-fetch-npm");
    const response = await fetch(`${aemFolderUrl}.3.json`, {
        headers: {
            authorization
        }
    });

    const downloadFiles = [];
    if (response.ok) {
        const json = await response.json();
        for (const [ name, value ] of Object.entries(json)) {
            if (value["jcr:primaryType"] === "dam:Asset") {
                const jcrContent = value["jcr:content"];
                const metadata = jcrContent && jcrContent.metadata;
                const fileSize = metadata && metadata["dam:size"];
                downloadFiles.push({
                    fileUrl: new URL(path.join(aemFolderUrl.pathname, name), aemFolderUrl),
                    filePath: path.join(localFolder, name),
                    fileSize
                });
            }
        }
    } else {
        throw Error(`Failed to request folder contents from '${aemFolderUrl}': ${response.status}`);
    }

    return {
        downloadFiles,
        headers: {
            authorization
        },
        concurrent: true,
        maxConcurrent: params.maxConcurrent,
        preferredPartSize: params.partSize
    };
}

/**
 * Download file as multiple blocks
 * @param {Location} source source url 
 * @param {Location} target target path 
 * @param {*} retryOptions Retry options
 */
async function downloadOneFileAsBlocks(source, target, retryOptions) {
    const download = new BlockDownload();
    const options = {
        downloadFiles: [{
            fileUrl: source.url,
            filePath: target.path,
            fileSize: -1
        }],
        headers: target.headers,
        maxConcurrent: 8,
        preferredPartSize: BLOB_MIN_BLOCK_SIZE,
        ...retryOptions

    };
    await download.downloadFiles(options);
}

/**
 * Upload blocks using one url
 * @param {Location} source source path 
 * @param {Location} target target url 
 * @param {*} retryOptions Retry options
 */
async function uploadOneBlock(source, target, retryOptions, size) {
    const upload = new BlockUpload();
    const options = {
        uploadFiles: [{
            fileUrl: target.url,
            filePath: source.file,
            fileSize: size
        }],
        headers: target.headers,
        ...retryOptions,
        concurrent: true,
        maxConcurrent: 5,
        preferredPartSize: 7
    };
    await upload.uploadFiles(options);
}

/**
 * Upload blocks using many urls
 * @param {Location} source source path 
 * @param {Location} target target url 
 * @param {*} params Additional request parameters
 * @param {*} retryOptions Retry options
 */
async function uploadMultipleBlocks(source, target, params, retryOptions) {
    const upload = new BlockUpload();
    const options = {
        uploadFiles: [{
            fileUrl: target.urls,
            filePath: source.file,
            multipartHeaders: { partHeader: 'test' },
            minPartSize: params.minPartSize,
            maxPartSize: params.maxPartSize,
            partSize: params.partSize,
        }],
        headers: target.headers,
        ...retryOptions,
        concurrent: true,
        maxConcurrent: 5,
        preferredPartSize: 7
    };
    await upload.uploadFiles(options);
    console.log("Commit uncommitted blocks");
    const url = new URL(params.target);
    await commitAzureBlocks(params.azureAuth, url.host, url.pathname.substring(1));
}

async function main() {
    // parse command line
    const params = yargs
        .strict()
        .scriptName("npm run testbed --")
        .command("$0 <source> <target>", "Testbed for node-httptransfer", yargs =>
            yargs
                .positional("source", {
                    describe: "File, URL, or azure://container/path/to/blob to retrieve content from",
                    type: "string"
                })
                .positional("target", {
                    describe: "File, URL, or azure://container/path/to/blob to send content to",
                    type: "string"
                })
                .option("partSize", {
                    describe: "Preferred part size",
                    type: "number"
                })
                .option("minPartSize", {
                    alias: "min",
                    describe: "Minimum part size",
                    type: "number",
                    default: 1
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
                .option("aem", {
                    describe: "Flag to indicate that the source or target URL is an AEM server",
                    type: "boolean"
                })
                .option("aem-username", {
                    describe: "AEM Username. Environment variable: AEM_USERNAME",
                    type: "string"
                })
                .option("aem-password", {
                    describe: "AEM Password. Environment variable: AEM_PASSWORD",
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
                .option("maxConcurrent", {
                    describe: "Maximum concurrency for upload and download",
                    type: "number",
                    default: 1
                })
                .option("nameConflictPolicy", {
                    describe: "Name conflict policy: \"replace\", \"version[,label[,comment]]\"",
                    type: "string",
                    coerce: arg => {
                        if (arg === "replace") {
                            return {
                                replace: true
                            };
                        } else if (arg.startsWith("version")) {
                            const values = arg.split(",");
                            const versionLabel = values.length >= 2 && values[1];
                            const versionComment = values.length >= 3 && values[2];
                            return {
                                createVersion: true,
                                versionLabel,
                                versionComment
                            };
                        } else {
                            throw Error(`Unsupported name conflict policy: ${arg}`);
                        }
                    },
                })
                .option("block", {
                    describe: "Use block transfer upload/download",
                    type: "boolean",
                    default: false
                })
                .example("$0 azure://container/source.txt blob.txt", "Download path/to/source.txt in container to blob.txt")
                .example("$0 blob.txt azure://container/target.txt", "Upload blob.txt to path/to/target.txt in container")
                .example("$0 azure://container/source.txt azure://container/target.txt", "Transfer source.txt to target.txt in container")
                .example("$0 --maxConcurrent 4 --aem ./folder https://localhost:4502/content/dam/folder", "Upload the contents of ./folder to AEM")
                .example("$0 --maxConcurrent 4 --aem https://localhost:4502/content/dam/folder ./folder", "Download the contents of /content/dam/folder from AEM")
        )
        .wrap(yargs.terminalWidth())
        .help()
        .fail((msg, err, yargs) => {
            if (err) {
                throw err;
            }
            console.error(yargs.help());
            console.error();
            console.error(msg);
            process.exit(0);
        })
        .argv;

    // capture azure storage credentials
    params.azureAuth = {
        accountKey: params["account-key"] || process.env.AZURE_STORAGE_KEY,
        accountName: params["account-name"] || process.env.AZURE_STORAGE_ACCOUNT
    };

    // capture aem credentials
    params.aemAuth = {
        username: params["aem-username"] || process.env.AEM_USERNAME,
        password: params["aem-password"] || process.env.AEM_PASSWORD
    };

    // capture retry options
    const retryOptions = filterObject(
        params,
        [ "retryEnabled", "retryAllErrors", "retryMax", "retryInterval" ]
    );

    // resolve source
    const source = await resolveLocation(params.source, { ...params, writable: false});

    let size;
    if (source.url && params.aem) {
        // skip since the source references a folder
    } else if (source.url) {
        const headers = await getResourceHeaders(source.url, {
            doGet: params.headerGet,
            ...retryOptions
        });
        size = headers.size;
    } else if (source.file) {
        const stats = await fs.stat(source.file);
        size = stats.size;
    }

    console.log(`Source: ${source.aem || source.url || source.file}, ${size} bytes`);

    // resolve target
    const target = await resolveLocation(params.target, { ...params, writable: true, size });
    if (target.urls) {
        console.log(`Target: ${target.urls.length} parts, ${target.urls[0]}`);
    } else {
        console.log(`Target: ${target.aem || target.url || target.file}`);
    }

    if(params.block) {
        console.log("Testing block upload transfer");
        if (source.url && target.file) {
            console.log("Downloading as blocks");
            await downloadOneFileAsBlocks(source, target, retryOptions);
        } else if (source.file && target.url) {
            console.log("Uploading using one block url");
            await uploadOneBlock(source, target, retryOptions, size);
        } else if (source.file && target.urls) {
            //multi-part upload
            console.log("Uploading using multi-part urls");
            await uploadMultipleBlocks(source, target, params, retryOptions, size);
        } else {
            throw Error("Transfer is not supported");
        }
    } else {
        // transfer
        if (params.aem && source.file && target.url) {
            const options = await createAEMUploadOptions(source.file, target.url, params);
            const upload = new AEMUpload();
            upload.on("filestart", ({ fileName, fileSize }) => {
                console.log(`${fileName}: Start transfer ${fileSize} bytes`);
            });
            upload.on("fileprogress", ({ fileName, fileSize, transferred }) => {
                console.log(`${fileName}: Transferred ${transferred}/${fileSize} bytes`);
            });
            upload.on("fileend", ({ fileName, fileSize }) => {
                console.log(`${fileName}: Complete transfer ${fileSize} bytes`);
            });
            upload.on("fileerror", ({ fileName, errors }) => {
                console.log(`${fileName}: FAILED --> ${errors[0].message}`);
            });
            await upload.uploadFiles(options);
        } else if (params.aem && source.url && target.file) {
            const options = await createAEMDownloadOptions(source.url, target.file, params);
            const download = new AEMDownload();
            download.on("filestart", ({ fileName, fileSize }) => {
                console.log(`${fileName}: Start transfer ${fileSize} bytes`);
            });
            download.on("fileprogress", ({ fileName, fileSize, transferred }) => {
                console.log(`${fileName}: Transferred ${transferred}/${fileSize} bytes`);
            });
            download.on("fileend", ({ fileName, fileSize }) => {
                console.log(`${fileName}: Complete transfer ${fileSize} bytes`);
            });
            download.on("fileerror", ({ fileName, errors }) => {
                console.log(`${fileName}: FAILED --> ${errors[0].message}`);
            });
            await download.downloadFiles(options);
        } else if (params.aem) {
            throw Error("Transfer not supported");
        } else if (source.file && target.url) {
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
                ...retryOptions,
                partSize: params.partSize,
                maxConcurrent: params.maxConcurrent || 1
            });
    
            console.log("Commit uncommitted blocks");
            const url = new URL(params.target);
            await commitAzureBlocks(params.azureAuth, url.host, url.pathname.substring(1));
        } else {
            throw Error("Transfer is not supported");
        }
        
    }
}

main()
    .catch(err => {
        console.error(err);
    });
