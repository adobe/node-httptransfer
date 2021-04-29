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

const { AsyncGeneratorFunction } = require("./function");

/**
 * @callback CheckAddBatchCallback
 * @param {Object[]} batch Current batch
 * @param {Object} item Item to add to the batch
 * @returns {Boolean} True if the item should be added to the batch
 */
/**
 * @typedef {Object} MapBatchOptions
 * @property {Number} [maxBatchLength=1] Maximum batch length
 */
/**
 * Batch the items out of input in to sets of maxBatchLength.
 * 
 * The batch can be limited by the `checkAddBatch` callback, which can return
 * `false` and require a new batch to be created.
 */
class Batch extends AsyncGeneratorFunction {
    /**
     * Construct the Batch function
     * 
     * @param {AsyncGeneratorFunction} [checkAddBatch] Function to check if an item should be added to a batch
     * @param {MapBatchOptions} [options] Map batch options
     */
    constructor(checkAddBatch, options) {
        super();
        this.checkAddBatch = checkAddBatch || (() => true);
        this.maxBatchLength = Math.max((options && options.maxBatchLength) || 1, 1);
    }

    /**
     * Async generator that batches items in to sets of maxBatchLength
     * 
     * @generator
     * @param {Object[]|Generator||AsyncGenerator} items 
     * @yields {Object[]} batch of items 
     */
    async* execute(items) {
        // build batches of items up to the provided maxBatchLength and as long
        // as new items can be part of the same batch
        let batch = [];
        for await (const item of items) {
            if ((batch.length < this.maxBatchLength) && this.checkAddBatch(batch, item)) {
                batch.push(item);
            } else {
                yield batch;
                batch = [item];
            }
        }
    
        // handle the remainder of an incomplete batch
        if (batch.length > 0) {
            yield batch;
        }
    }
}

module.exports = {
    Batch
};
