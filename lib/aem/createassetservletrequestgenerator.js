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

const FormData = require("form-data");
const { HttpRequestGenerator } = require("../asset/httprequestgenerator");
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
 * Helps create portions of the HTTP requests that will be sent when transferring
 * an asset using the create asset servlet.
 */
class CreateAssetServletRequestGenerator extends HttpRequestGenerator {
    createPartHttpBody(partInfo) {
        const { partData, contentRange, transferPart } = partInfo;
        // create asset servlet uses a form to upload data
        const form = new FormData();
        form.append(CHARSET, UTF8);

        if (this.isPartChunked(transferPart.totalSize, contentRange)) {
            // this is a chunk of the file - add more information to form
            const { low, length } = contentRange || {};
            console.log(`Create asset servlet upload process adding form elements file@Offset=${low}, chunk@Length=${length}, file@Length=${transferPart.totalSize}`);
            form.append(FILE_OFFSET, low);
            form.append(CHUNK_LENGTH, length);
            form.append(FILE_LENGTH, transferPart.totalSize);
        }
        form.append(FILE, partData, {
            filename: transferPart.targetName,
            [HTTP.HEADER.CONTENT_TYPE]: transferPart.contentType
        });

        return form;
    }

    createPartHttpHeaders(partInfo) {
        const { httpBody, contentRange, transferPart } = partInfo;
        const headers = {
            ...httpBody.getHeaders()
        };

        if (this.isPartChunked(transferPart.totalSize, contentRange)) {
            // add more information if the asset is being transferred in chunks
            headers[CHUNKED_CONTENT_TYPE] = transferPart.contentType;
            headers[CHUNKED_TOTAL_SIZE] = transferPart.totalSize;
        }

        return headers;
    }

    /**
     * Given a content range, determine if the part represents a chunk of
     * an asset.
     * @param {number} totalSize Total size of the asset, in bytes.
     * @param {import('DRange').SubRange} contentRange Range whose information will
     *  be used.
     * @returns {boolean} True if the part is a chunk of a file, false
     *  otherwise.
     */
    isPartChunked(totalSize, contentRange) {
        const { high, length } = contentRange || {};
        return (high && totalSize && length && length < totalSize);
    }
}

module.exports = {
    CreateAssetServletRequestGenerator
};
