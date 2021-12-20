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

const assert = require("assert");
const { AsyncGeneratorFunction } = require("./function");

/**
 * Wait for the next result
 * 
 * @param {Promise[]} pending Pending results
 * @param {Boolean} ordered True if the results should be returned in the same order as they entered
 * @returns {Object} next result
 */
async function waitResult(pending, ordered) {
    if (pending.length === 0) {
        throw Error("Invalid state: pending is empty");
    } else if (ordered) {
        const result = await pending[0];
        pending.shift();
        return result;
    } else {
        // Ensure the original pending promise is returned with the value, so we know
        // which promise to delete from the pending array.
        const { promise, result } = await Promise.race(pending.map(promise =>
            Promise.resolve(promise).then(result => {
                return { promise, result };
            })
        ));

        const i = pending.findIndex(pendingPromise => pendingPromise === promise);
        assert.ok(i >= 0, `Promise ${promise} -> ${result} not in pending state`);
        pending.splice(i, 1); // remove completed item
        return result;    
    }
}

/**
 * Check if the next item can be part of the current batch
 * 
 * @param {AsyncGeneratorFunction} mapFunction Asynchronous generator function
 * @param {Object[]} batch Current batch of items
 * @param {Object} item Next item
 * @param {Number} maxBatchLength Maximum batch length
 * @returns {Boolean} True when the item was added to the batch
 */
function checkAddBatch(mapFunction, batch, item, maxBatchLength) {
    if (batch.length === 0) {
        return true;
    } else if (batch.length >= maxBatchLength) {
        return false;
    } else if (mapFunction.checkAddBatch && !mapFunction.checkAddBatch(batch, item)) {
        return false;
    } else {
        return true;
    }
}

/**
 * Execute the function on a batch of values
 * 
 * @param {AsyncGeneratorFunction} mapFunction Asynchronous generator function
 * @param {Object[]} values Batch of values
 * @param {Object[]} args Additional arguments
 * @returns {Object[]} Batch of results
 */
async function executeBatch(mapFunction, values, args) {
    const result = [];
    for await (const x of mapFunction.execute(values, ...args)) {
        result.push(x);
    }
    return result;
}

/**
 * @callback CheckAddBatchCallback
 * @param {Object[]} batch Current batch of items (guaranteed to not be empty)
 * @param {Object} item Item to add to the batch
 * @returns {Boolean} True if the item can be added to the batch
 */
/**
 * @typedef {Object} MapConcurrentOptions
 * @property {Number} [maxBatchLength=1] Maximum batch length
 * @property {Number} [maxConcurrent=1] Maximum concurrency (defaults to no concurrency)
 * @property {Boolean} [ordered=false] Map the items out of input concurrently while keeping the results in the same order
 */

/**
 * Execute an AsyncGeneratorFunction on batches and concurrently
 * 
 * Defaults to no concurrency, and no batch creation, which results in the provided function to be executed on each item
 * one at a time.
 * 
 * Increasing `maxBatchLength` will result in the function to be executed on `maxBatchLength` number of items. A function
 * can limit batches to only "similar" items by implementing the `checkAddBatch(batch, item)` callback function.
 * 
 * Increasing `maxConcurrent` will result in items to be executed concurrently by invoking the providing function concurrently,
 * this works together with `maxBatchLength` where concurrent batches can be processed.
 * 
 * By default the mapping is unordered, so the first result is returned once available. Setting `ordered` to `true` will 
 * ensure the results are in the same order as the input.
 */
class MapConcurrent extends AsyncGeneratorFunction {
    /**
     * Construct MapConcurrent
     * 
     * @param {AsyncGeneratorFunction} [mapFunction] function to map the values
     * @param {MapConcurrentOptions} [options] Map concurrent options
     */
    constructor(mapFunction, options) {
        super();
        this.mapFunction = mapFunction;
        this.maxBatchLength = Math.max((options && options.maxBatchLength) || 1, 1);
        this.maxConcurrent = Math.max((options && options.maxConcurrent) || 1, 1);
        this.ordered = !!(options && options.ordered);
    }

    /**
     * Execute the generator, yields the same number of results as input items
     * 
     * @generator
     * @param {Object[]|Generator||AsyncGenerator} items Items to process
     * @param {Object[]} [args] Arguments
     * @yields {Object} 
     */
    async* execute(items, ...args) {
        const pending = [];
        let batch = [];
        for await (const item of items) {
            if (checkAddBatch(this.mapFunction, batch, item, this.maxBatchLength)) {
                batch.push(item);
            } else {
                while (pending.length >= this.maxConcurrent) {
                    yield* await waitResult(pending, this.ordered);
                }
                pending.push(executeBatch(this.mapFunction, batch, args));
                batch = [item];
            }
        }

        while ((batch.length > 0) || (pending.length > 0)) {
            // execute the remainder batch
            if ((batch.length > 0) && (pending.length < this.maxConcurrent)) {
                pending.push(executeBatch(this.mapFunction, batch, args));
                batch = [];
            }

            /// wait for the remainder results
            yield* await waitResult(pending, this.ordered);
        }
    }
}

module.exports = {
    MapConcurrent
};