/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

'use strict';

const fs = require('fs-extra');
const { uploadStream } = require('./stream');
const { createReadStream } = require('./util');

/**
 * @typedef {Object} UploadMultipartOptions
 * 
 * @property {String} method HTTP method (defaults to 'PUT')
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 */
/**
 * @typedef {Object} MultipartTarget
 * 
 * @property {String[]} urls URLs 
 * @property {Number} maxPartSize Maximum size of each part 
 * @property {Number} minPartSize Minimum size of each part
 */
/**
 * Upload a file in multiple parts to a set of URLs.
 * Intended to be used with 
 * 
 * @param {String} filepath Source file path
 * @param {MultipartTarget} target Target urls
 * @param {UploadMultipartOptions} options Upload options
 * @returns {Promise} resolves when upload completes
 */
async function uploadMultipartFile(filepath, target, options) {
    if (!target) {
        throw Error('target not provided');
    } else if (!target.urls || target.urls.length === 0) {
        throw Error('invalid number of urls');
    }

    const { size } = await fs.stat(filepath);
    const maxPartSize = target.maxPartSize || size;
    const numParts = Math.ceil(size / maxPartSize);
    const partSize = Math.ceil(size / numParts);
    const lastPartSize = size - (partSize * (numParts - 1));

    if (target.minPartSize && (target.minPartSize > lastPartSize)) {
        throw Error(`Unable to upload, part size ${lastPartSize} is below minimum ${target.minPartSize}`);
    }
    if (numParts > target.urls.length) {
        throw Error(`Unable to upload, file is too large`);
    }

    let i = 0;
    let start = 0;
    while (start < size) {
        const length = Math.min(size - start, partSize);
        // read stream expects an inclusive start and end which is why the -1 is required
        const readStream = await createReadStream(filepath, { 
            start, 
            end: start + length - 1 
        });
        const opts = Object.assign({}, options, {
            headers: {
                'content-length': length
            }
        })
        await uploadStream(readStream, target.urls[i], opts);
        start += length;
        ++i;
    }
}

module.exports = {
    uploadMultipartFile
}
