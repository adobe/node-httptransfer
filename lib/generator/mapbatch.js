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
 * @typedef {Object} MapBatchOptions
 * @property {Number} [maxBatchLength=1] Maximum batch length
 */
/**
 * Map the items out of input the batches while yielding the results in order
 */
class MapBatch extends AsyncGeneratorFunction {
    /**
     * Construct function that will execute the given function on list of items with 
     * a maximum of maxBatchLength.
     * 
     * @param {AsyncGeneratorFunction} func Function to execute on batches
     * @param {MapBatchOptions} [options] Map batch options
     */
    constructor(func, options) {
        super();
        this.func = func;
        this.maxBatchLength = Math.max((options && options.maxBatchLength) || 1, 1);
    }

    /**
     * Async generator that flattens recursively up to the specified depth until
     * the generated values are not longer (async) iterable
     * 
     * @generator
     * @param {Object[]|Generator||AsyncGenerator} items 
     * @yields {Object} 
     */
    async* execute(items) {
        // build batches of items up to the provided maxBatchLength and as long
        // as new items can be part of the same batch
        let batch = [];
        for await (const item of items) {
            if ((batch.length < this.maxBatchLength) && this.func.checkAddBatch(batch, item)) {
                batch.push(item);
            } else {
                yield* await this.func.execute(batch);
                batch = [item];
            }
        }
    
        // handle the remainder of an incomplete batch
        if (batch.length > 0) {
            yield* await this.func.execute(batch);
        }
    }
}

module.exports = {
    MapBatch
};
