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

/**
 * Check if the given item can be added to the batch being built
 * 
 * @callback canBatchCallback
 * @param {*} batch Current batch (may be empty)
 * @param {*} item Item to be added to the batch
 * @returns {Boolean} True if the item can be added to the batch, false if not
 */
/**
 * @typedef {object} MapBatchOptions
 * @property {number} [maxBatchLength=1] Maximum of items processed as a batch
 * @property {canBatchCallback} [canBatch] Optional callback to check if 2 items can be batched together
 */

/**
 * Map the items out of input the batches while yielding the results in order
 * 
 * @generator
 * @param {*} input 
 * @param {*} func 
 * @param {MapBatchOptions} [options] Options 
 * @yields {*} result from func in the same order as the input
 */
async function* map_batch(input, func, options) {
    const maxBatchLength = (options && options.maxBatchLength) || 1;
    if (maxBatchLength < 1) {
        throw Error(`maxBatchLength is invalid: ${maxBatchLength}`);
    }

    // build batches of items up to the provided maxBatchLength and as long
    // as new items can be part of the same batch
    const canBatch = (options && options.canBatch) || (() => true);
    let batch = [];
    for await (const item of input) {
        if ((batch.length < maxBatchLength) && canBatch(batch, item)) {
            batch.push(item);
        } else {
            yield* await func(batch);
            batch = [item];
        }
    }

    // handle the remainder of an incomplete batch
    if (batch.length > 0) {
        yield* await func(batch);
    }
}

module.exports = {
    map_batch
};
