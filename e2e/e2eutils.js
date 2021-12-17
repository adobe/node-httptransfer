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

"use strict";

const Path = require('path');
const {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    SASProtocol,
    BlobSASPermissions
} = require("@azure/storage-blob");

// load .env values in the e2e folder, if any
require('dotenv').config({ path: Path.join(__dirname, '.env') });

/**
 * Retrieves the root URL of the AEM endpoint that the test's should
 * use.
 * @returns {string} URL for an AEM instance.
 */
module.exports.getAemEndpoint = function() {
    const endpoint = process.env.AEM_ENDPOINT;

    if (!endpoint) {
        throw new Error('AEM_ENDPOINT environment variable must be supplied');
    }

    return endpoint;
};

/**
 * Updates the given options to include authentication information required
 * to communicate with AEM.
 * @param {DirectBinaryUploadOptions} uploadOptions Will be updated with auth info.
 */
module.exports.getAuthorizationHeader = function() {
    const basic = process.env.BASIC_AUTH;
    const token = process.env.LOGIN_TOKEN;

    if (basic) {
        return {
            authorization: `Basic ${Buffer.from(basic).toString("base64")}`
        };
    } else if (token) {
        return {
            'Cookie': token
        };
    }

    throw new Error('Either BASIC_AUTH or LOGIN_TOKEN env variable must be set');
};

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

/**
 * Generates blob url for local file
 * @param {string} filepath Path to local file to generate a blobUrl
 */
module.exports.getBlobUrl = function(filepath, options) {
    const auth = {
        accountName: process.env.AZURE_STORAGE_ACCOUNT,
        accountKey: process.env.AZURE_STORAGE_KEY
    };
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
    const blobName = Path.basename(filepath);

    const sasUrl = createAzureSAS(auth, containerName, blobName, options.permissions);

    const numParts = options.numParts || Math.ceil(options.size / options.maxPartSize);
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
        return sasUrl;
    }
    
};
