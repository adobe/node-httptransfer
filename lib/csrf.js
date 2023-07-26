/*
 * Copyright 2022 Adobe. All rights reserved.
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

const { streamGet } = require("./fetch");
const { retry } = require("./retry");

/**
 * Get a CSRF Token from the target Host with options
 *
 * @param {String} host Host to get csrf from 
 * @param {import('./functions/aeminitiateupload').AEMInitiateUploadOptions} options Upload options
 * @param {Object} headers Fetch headers
 * @returns {String} Token
 */
async function getCSRFToken(host, options = {}, headers) {
    try {
        const url = `${host}/libs/granite/csrf/token.json`;
        const response = await retry(async () => {
            return streamGet(url, {
                timeout: options && options.timeout,                    
                headers: headers,
                ...options.requestOptions
            });
        }, options);
        
        if (response.status !== 200) {
            throw new Error(`Bad response from server ${response.status}`);
        }
        return (await response.json()).token;
    } catch (e) {
        throw new Error(`Fail to get CSRF token with err ${e}`);
    }
}

module.exports = {
    getCSRFToken,
};