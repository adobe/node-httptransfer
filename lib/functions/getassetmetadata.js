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

const logger = require("../logger");
const { AssetMetadata } = require("../asset/assetmetadata");
const { AssetVersion } = require("../asset/assetversion");
const { AsyncGeneratorFunction } = require("../generator/function");
const { getContentType, getETag, getFilename, getHeaders, getLastModified, getSize } = require("../headers");
const { isFileProtocol, getFileStats } = require("../util");
const { retry } = require("../retry");
const mime = require("mime-types");
const { TransferEvents } = require("../controller/transfercontroller");

/**
 * @typedef {Object} GetAssetMetadataOptions
 * @property {Number} [timeout=30000] Socket timeout
 * @property {Number} [retryMaxCount] number of retry attempts, overrides retryMaxDuration
 * @property {Number} [retryMaxDuration=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 * @property {Object} requestOptions Options that will be passed to fetch (either node-fetch-npm or native fetch, depending on the context)
 */
/**
 * Retrieve asset metadata information from the sources for the transfer asset. 
 * Results in updated transfer assets.
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
     * @param {TransferAsset[]|Generator||AsyncGenerator} transferAssets Transfer assets with a target of AEMAsset  
     * @param {TransferController} controller Transfer controller
     * @yields {TransferAsset} Transfer asset with a target of AEMMultipartAsset
     */
    async* execute(transferAssets, controller) {
        for await (const transferAsset of transferAssets) {
            try {
                controller.notify(TransferEvents.GET_ASSET_METADATA, this.name, transferAsset);

                const source = transferAsset.source;
                if (source.blob) {
                    transferAsset.acceptRanges = true;
                    transferAsset.metadata = new AssetMetadata(source.blob.name, source.blob.type, source.blob.size);
                    transferAsset.version = new AssetVersion(source.blob.lastModified);
                } else if (isFileProtocol(source.url)) {
                    const { size, mtimeMs } = await getFileStats(source.url);
                    const lastModified = Math.round(mtimeMs); // fractional number
                    const contentType = mime.lookup(source.url.pathname) || "";
                    transferAsset.acceptRanges = true;
                    transferAsset.metadata = new AssetMetadata(source.url.pathname, contentType, size);
                    transferAsset.version = new AssetVersion(lastModified);
                } else {
                    if(transferAsset.metadata 
                        && transferAsset.metadata.filename 
                        && transferAsset.metadata.contentType 
                        && transferAsset.metadata.contentLength) {
                        console.log(`Transfer asset has all needed metadata to proceed (content-type: ${transferAsset.metadata.contentType}, content length: ${transferAsset.metadata.contentLength})`);
                    } else {
                        console.log("Transfer asset needs to acquire additional metadata. Executing metadata request");
                        await retry(async (options) => {
                            // S3 doesn't support HEAD requests against presigned URLs
                            // TODO: 0-byte file support for S3 which results in a 416 error
                            const headers = await getHeaders(source.url, {
                                timeout: options && options.timeout,
                                headers: source.headers,
                                doGet: source.url.host.includes(".amazonaws.com"),
                                requestOptions: options && options.requestOptions
                            });
                            transferAsset.acceptRanges = headers.get("accept-ranges") === "bytes";
                            console.log(`Server accepts ranges: ${transferAsset.acceptRanges} (accept-ranges header set to bytes)`);
                            transferAsset.metadata = new AssetMetadata(
                                getFilename(headers),
                                getContentType(headers), 
                                getSize(headers)
                            );
                            transferAsset.version = new AssetVersion(
                                getLastModified(headers), 
                                getETag(headers)
                            );
                        }, this.options);
                    }
                }

                controller.notify(TransferEvents.AFTER_GET_ASSET_METADATA, this.name, transferAsset);
                yield transferAsset;
            } catch (error) {
                logger.error(`Error while retrieving metadata: ${JSON.stringify(error) || error}`);
                controller.notifyError(this.name, error, transferAsset);
            }
        }
    }
}

module.exports = {
    GetAssetMetadata
};