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

'use strict';

/**
 * Registers a mock request that will indicate to the upload process that direct
 * binary access is enabled.
 * @param {*} nock Nock instance with which request will register.
 * @param {string} host HTTP host that will be registered.
 * @param {string} path Full path of the AEM folder.
 */
function directBinaryAccessEnabled(nock, host, path) {
    const initResponse = {
        completeURI: `${host}${path}.completeUpload.json`,
        folderPath: path,
        files: [{
            fileName: "direct-binary",
            mimeType: 'image/jpeg',
            uploadToken: 'upload-token',
            uploadURIs: [
                `${host}/part`
            ],
            minPartSize: 10,
            maxPartSize: 100
        }]
    };
    const initRaw = JSON.stringify(initResponse);
    nock(host)
        .post(`${path}.initiateUpload.json`, () => true)
        .reply(201, initRaw, {
            'Content-Length': initRaw.length
        });
}

/**
 * Registers a mock request that will indicate to the upload process that direct
 * binary access is not enabled.
 * @param {*} nock Nock instance with which request will register.
 * @param {string} host HTTP host that will be registered.
 * @param {string} path Full path of the AEM folder.
 */
function directBinaryAccessNotEnabled(nock, host, path) {
    const initResponse = {
        folderPath: path,
    };
    const initRaw = JSON.stringify(initResponse);
    nock(host)
        .post(`${path}.initiateUpload.json`, () => true)
        .reply(201, initRaw, {
            'Content-Length': initRaw.length
        });
}

module.exports = {
    directBinaryAccessEnabled,
    directBinaryAccessNotEnabled
};
