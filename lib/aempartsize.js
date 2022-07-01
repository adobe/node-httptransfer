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

const DRange = require("drange");
const { IllegalArgumentError } = require("./error");
const { isPositiveNumber } = require("./util");

/**
 * Clamp a number in to the specified range
 * 
 * @param {Number} value Value 
 * @param {Number} min Minimum value
 * @param {Number} max Maximum value
 * @returns {Number} clamped value in the [min, max] range
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Calculate that partSize based on the the available urls, and server-side
 * provided limitations on each part.
 * 
 * @param {URL[]} targetUrls Target URLs
 * @param {Number} fileSize Size of the file
 * @param {Number} minPartSize Minimum part size
 * @param {Number} maxPartSize Maximum part size
 * @param {Number} [preferredPartSize] Preferred part size
 * @returns {Number} The calculated part size
 */
function calculatePartSize(numUrls, fileSize, minPartSize, maxPartSize, preferredPartSize) {
    if (!isPositiveNumber(numUrls)) {
        throw new IllegalArgumentError("'numUrls' must be a positive number", numUrls);
    } else if (!isPositiveNumber(fileSize)) {
        throw new IllegalArgumentError("'fileSize' must be a positive number", fileSize);
    } else if (!isPositiveNumber(minPartSize)) {
        throw new IllegalArgumentError("'minPartSize' must be a positive number", minPartSize);
    } else if (!isPositiveNumber(maxPartSize) || (maxPartSize < minPartSize)) {
        throw new IllegalArgumentError(`'maxPartSize' must be larger or equal to 'minPartSize' (minPartSize=${minPartSize})`, maxPartSize);
    } else if (preferredPartSize && !isPositiveNumber(preferredPartSize)) {
        throw new IllegalArgumentError("'preferredPartSize' must be a positive number", preferredPartSize);
    }

    // Calculate the part size to use the majority of the urls
    // Limit it to `minPartSize` to avoid a lot of tiny parts
    // Throw an error if the required part size is too large
    let partSize = Math.max(Math.ceil(fileSize / numUrls), minPartSize);
    if (partSize > maxPartSize) {
        throw Error(`File is too large to upload: ${fileSize} bytes, maxPartSize: ${maxPartSize} bytes, numUploadURIs: ${numUrls}`);
    }

    // Override using the preferredPartSize, clamp its value to ensure that its at least
    // the minimum calculated (otherwise there are not enough urls or the blocks are too small).
    if (preferredPartSize) {
        partSize = clamp(preferredPartSize, partSize, maxPartSize);
    }

    return partSize;
}

/**
 * Split the file size in to partSize parts
 * 
 * @generator
 * @param {Number} fileSize Size of the file
 * @param {Number} partSize Size of the part
 * @yield {DRange} Range
 */
function* generatePartRanges(fileSize, partSize) {
    let low = 0;
    const result = [];
    while (low < fileSize) {
        const end = Math.min(low + partSize, fileSize);
        yield new DRange(low, end - 1);
        low = end;
    }
    return result;
}

module.exports = {
    calculatePartSize,
    generatePartRanges
};