
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

const SUPPORTED_PROTOCOLS = [ "http:", "https:", "file:" ];

/**
 * Check if the provided URI has a supported protocol (http, https, file)
 * 
 * @param {URL} uri URI to review
 * @returns {boolean} True if the protocol is supported, false otherwise
 */
function isSupportedProtocol(uri) {
    return uri && SUPPORTED_PROTOCOLS.indexOf(uri.protocol) >= 0;
}

module.exports = {
    isSupportedProtocol
};