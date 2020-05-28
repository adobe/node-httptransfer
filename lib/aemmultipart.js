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

'use strict';

const fs = require('fs').promises;
const { uploadFile } = require('./file');
const filterObject = require('filter-obj');

/**
 * @typedef {Object} UploadAEMMultipartOptions
 *
 * @property {String} [method] Optional HTTP method (defaults to 'PUT')
 * @property {Number} [timeout] Optional socket timeout
 * @property {Object} [headers] Optional override of request headers
 * @property {Number} [partSize] Optional custom preferred part size. Might be adjusted depending on the target.
 * @property {Number} [retryMax=60000] time to retry until throwing an error (ms)
 * @property {Number} [retryInterval=100] time between retries, used by exponential backoff (ms)
 * @property {Boolean} [retryEnabled=true] retry on failure enabled
 * @property {Boolean} [retryAllErrors=false] whether or not to retry on all http error codes or just >=500
 */
/**
 * @typedef {Object} UploadAEMMultipartTarget
 *
 * @property {String[]} urls URLs
 * @property {Number} [minPartSize] Minimum size of each part
 * @property {Number} [maxPartSize] Maximum size of each part
 */
/**
 * Upload a file in multiple parts to a set of URLs.
 * Intended to be used with AEM/Oak, see for more information:
 * http://jackrabbit.apache.org/oak/docs/apidocs/org/apache/jackrabbit/api/binary/BinaryUpload.html
 *
 * @param {String} filepath Source file path
 * @param {UploadAEMMultipartTarget} target Target urls
 * @param {UploadAEMMultipartOptions} [options] Upload options
 * @returns {Promise} resolves when upload completes
 */
async function uploadAEMMultipartFile(filepath, target, options) {
    if (!target) {
        throw Error('target not provided');
    } else if (!target.urls || target.urls.length === 0) {
        throw Error('invalid number of target urls');
    } else if (target.minPartSize && target.maxPartSize && (target.minPartSize > target.maxPartSize)) {
        throw Error(`minPartSize (${target.minPartSize}) > maxPartSize: (${target.maxPartSize})`);
    }

    // Calculate the partSize based on the number of urls
    const { size } = await fs.stat(filepath);
    let partSize = Math.ceil(size / target.urls.length);

    // Make sure that the file is not too large
    if (target.maxPartSize && (partSize > target.maxPartSize)) {
        throw Error(`File '${filepath}' is too large to upload: ${size} bytes, maxPartSize: ${target.maxPartSize} bytes, numUploadURIs: ${target.urls.length}`);
    }

    // Limit the lower bound to the minPartSize, since the estimated file size to generate uris
    // may be significantly larger than the actual file size. Also make sure that partSize is positive.
    partSize = Math.max(
        partSize,
        target.minPartSize || 1,
        1
    );

    // Override using the user provided partSize, clamp its value to ensure that its at least
    // the minimum calculated (otherwise there are not enough urls or the blocks are too small).
    if (options && options.partSize) {
        partSize = Math.max(partSize, options.partSize);
        partSize = (target.maxPartSize && Math.min(partSize, target.maxPartSize)) || partSize;
    }

    // extract upload options
    const uploadOptions = filterObject(
        options || {},
        [ 'method', 'timeout', 'headers',
            'retryMax', 'retryInterval', 'retryEnabled', 'retryAllErrors' ]
    );

    // upload blocks
    // rely on retry functionality in uploadFile
    let i = 0;
    let start = 0;
    while (start < size) {
        // uploadFile expects an inclusive start and end which is why the -1 is required
        const length = Math.min(size - start, partSize);
        await uploadFile(
            filepath,
            target.urls[i],
            { ...uploadOptions, start,
                end: start + length - 1}
        );
        start += length;
        ++i;
    }
}

module.exports = {
    uploadAEMMultipartFile
};
