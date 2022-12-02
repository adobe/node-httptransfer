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

const TransferPartImport = require("./transferpart");
const FormData = require("form-data");
const { HTTP } = require("../constants");

const FILE_OFFSET = "file@Offset";
const CHUNK_LENGTH = "chunk@Length";
const FILE_LENGTH = "file@Length";
const FILE = "file";
const CHARSET = "_charset_";
const UTF8 = "utf-8";
const CHUNKED_CONTENT_TYPE = "x-chunked-content-type";
const CHUNKED_TOTAL_SIZE = "x-chunked-total-size";

/**
 * Reflects a unit of content to be transferred, refers to part of an asset. This
 * part provides functionality specific to uploading to AEM's create asset servlet.
 */
class CreateAssetServletPart extends TransferPartImport.TransferPart {
    /**
     * @param {TransferPartImport.PartInfo} partInfo Information about the raw part data.
     * @returns {*} The data that should be used as the body.
     */
    createPartHttpBody(partInfo) {
        const { partData, contentRange } = partInfo;
        // create asset servlet uses a form to upload data
        const form = new FormData();
        form.append(CHARSET, UTF8);

        if (this.isChunked(contentRange)) {
            // this is a chunk of the file - add more information to form
            const { low, length } = contentRange || {};
            console.log(`Create asset servlet upload process adding form elements file@Offset=${low}, chunk@Length=${length}, file@Length=${this.totalSize}`);
            form.append(FILE_OFFSET, low);
            form.append(CHUNK_LENGTH, length);
            form.append(FILE_LENGTH, this.totalSize);
        }
        form.append(FILE, partData, {
            filename: this.transferAsset.target.filename,
            [HTTP.HEADER.CONTENT_TYPE]: this.contentType
        });

        return form;
    }

    /**
     * @param {TransferPartImport.PartHttpInfo} partInfo Information about the raw part data.
     *  body.
     * @returns {Headers} Simple object containing header information.
     */
    createPartHttpHeaders(partInfo) {
        const { httpBody, contentRange } = partInfo;
        const headers = {
            ...httpBody.getHeaders()
        };

        if (this.isChunked(contentRange)) {
            // add more information if the asset is being transferred in chunks
            headers[CHUNKED_CONTENT_TYPE] = this.contentType;
            headers[CHUNKED_TOTAL_SIZE] = this.totalSize;
        }

        return headers;
    }

    /**
     * Given a content range, determine if the part represents a chunk of
     * an asset.
     * @param {import('DRange').SubRange} contentRange Range whose information will
     *  be used.
     * @returns {boolean} True if the part is a chunk of a file, false
     *  otherwise.
     */
    isChunked(contentRange) {
        const { high, length } = contentRange || {};
        return (high && this.totalSize && length && length < this.totalSize);
    }

    /**
     * Returns the total size of the asset being transferred.
     * @returns {number} Size of the asset, in bytes.
     */
    get totalSize() {
        return this.transferAsset.metadata.contentLength;
    }

    /**
     * Returns the content type of the asset being transferred.
     * @returns {string} Content type of the asset.
     */
    get contentType() {
        return this.metadata.contentType;
    }
}

module.exports = {
    CreateAssetServletPart
};
