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

const { AssetMetadata } = require("../asset/assetmetadata");
const { AssetVersion } = require("../asset/assetversion");
const { AsyncGeneratorFunction } = require("../generator/function");
const { getContentType, getETag, getFilename, getHeaders, getLastModified, getSize } = require("../headers");
const { isFileProtocol } = require("../util");
const { retry } = require("../retry");
const { stat } = require("fs").promises;
const mime = require("mime-types");

/**
 * @typedef {Object} GetAssetMetadataOptions
 * @property {Number} [timeout] Socket timeout
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * Retrieve asset metadata information from the sources for the 
 * transfer record. Results in updated transfer records.
 * 
 * Supports Blob/File, file:// and http/https sources
 */
class GetAssetMetadata extends AsyncGeneratorFunction {
    /**
     * Construct the GetAssetMetadata function.
     * 
     * @param {GetAssetMetadataOptions} [options] Options to request asset metadata
     */
    constructor(options) {
        super();
        this.options = options;
    }

    /**
     * Initiates the upload of the given assets
     * 
     * @generator
     * @param {TransferPart[]|Generator||AsyncGenerator} transferAssets Transfer assets with a target of AEMAsset  
     * @yields {TransferPart} Transfer asset with a target of AEMMultipartAsset
     */
    async* execute(transferParts) {
        for await (const transferPart of transferParts) {
            const source = transferPart.source;
            if (source.blob) {
                transferPart.acceptRanges = true;
                transferPart.metadata = new AssetMetadata(source.blob.name, source.blob.type, source.blob.size);
                transferPart.version = new AssetVersion(source.blob.lastModified);
            } else if (isFileProtocol(source.url)) {
                const { size, mtimeMs } = await stat(source.url);
                const lastModified = Math.round(mtimeMs); // fractional number
                const contentType = mime.lookup(source.url.pathname) || "";
                transferPart.acceptRanges = true;
                transferPart.metadata = new AssetMetadata(source.url.pathname, contentType, size);
                transferPart.version = new AssetVersion(lastModified);
            } else {
                await retry(async () => {
                    // S3 doesn't support HEAD requests against presigned URLs
                    // TODO: 0-byte file support for S3 which results in a 416 error
                    const headers = await getHeaders(source.url, {
                        timeout: this.options && this.options.timeout,
                        headers: source.headers,
                        doGet: source.url.host.includes(".amazonaws.com")
                    });
                    transferPart.acceptRanges = headers.get("accept-ranges") === "bytes";
                    transferPart.metadata = new AssetMetadata(
                        getFilename(headers),
                        getContentType(headers), 
                        getSize(headers)
                    );
                    transferPart.version = new AssetVersion(
                        getLastModified(headers), 
                        getETag(headers)
                    );
                }, this.options);
            }
            yield transferPart;
        }
    }
}

module.exports = {
    GetAssetMetadata
};