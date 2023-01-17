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

const { HttpRequestGenerator } = require("./httprequestgenerator");
const { HTTP } = require("../constants");

/**
 * Helps create portions of the HTTP requests that will be sent when transferring
 * an asset using block transfer algorithms.
 */
class BlockRequestGenerator extends HttpRequestGenerator {
    createPartHttpBody(partInfo) {
        // block transfers use the part's binary data
        const { partData } = partInfo;
        return partData;
    }

    createPartHttpHeaders(partHttpInfo) {
        const { httpBody, transferPart } = partHttpInfo;
        // the body could be a stream or a blob, use correct property
        return {
            [HTTP.HEADER.CONTENT_LENGTH]: httpBody.length || httpBody.size,
            [HTTP.HEADER.CONTENT_TYPE]: transferPart.metadata.contentType
        };
    }
}

module.exports = {
    BlockRequestGenerator
};
