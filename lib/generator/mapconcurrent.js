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
 * @callback MapFunctionCallback
 * @param {Object} item Item to add to the batch
 * @returns {Object} Mapped value
 */

/**
 * Returns a promise that fulfills or rejects as soon as one of the promises in the 
 * set fulfills or rejects.
 * 
 * Once a promise fulfills, it will be automatically removed from the set of pending promises.
 * 
 * @param {Set} pending Set of pending promises
 * @returns Promise that fulfills or rejects as soon as one of the given promises settles 
 */
async function race(pending) {
    // Ensure the original pending promise is returned with the value, so we know
    // which promise to delete from the pending set.
    const { promise, value } = await Promise.race(Array.from(pending, promise =>
        Promise.resolve(promise).then(value => {
            return { promise, value };
        })
    ));

    if (!pending.delete(promise)) {
        throw Error(`[internal] Promise ${promise} -> ${value} not in pending state`);
    }

    return value;
}

/**
 * @typedef {Object} MapConcurrentOptions
 * @property {Number} [maxConcurrent=1] Maximum concurrency (defaults to no concurrency)
 * @property {Boolean} [ordered=false] Map the items out of input concurrently while keeping the results in the same order
 */
/**
 * Invoke the given function concurrently up to the given limit.
 * 
 * When "ordered", the yielded results are in the same order as the items generator.
 * Otherwise, the first available result is yielded.
 */
class MapConcurrent extends AsyncGeneratorFunction {
    /**
     * Construct MapConcurrent
     * 
     * @param {MapFunctionCallback} mapFunction Function to map values
     * @param {MapConcurrentOptions} [options] Map concurrent options
     */
    constructor(mapFunction, options) {
        super();
        this.mapFunction = mapFunction;
        this.maxConcurrent = Math.max((options && options.maxConcurrent) || 1, 1);
        this.ordered = !!(options && options.ordered);
    }

    /**
     * Execute the generator, yields the same number of results as input items
     * 
     * @generator
     * @param {Object[]|Generator||AsyncGenerator} items 
     * @yields {Object} 
     */
    async* execute(items) {
        if (this.ordered) {
            // keep maxConcurrent invocations of mapFunction running
            // yield in fifo order
            const pending = [];
            for await (const value of items) {
                pending.push(this.mapFunction(value));
                while (pending.length >= this.maxConcurrent) {
                    const result = await pending[0];
                    pending.shift();
                    yield result;
                }
            }        
            if (pending.length > 0) {
                yield* pending;
            }
        } else {
            // keep maxConcurrent invocations of mapFunction running
            // yield in first one to complete
            const pending = new Set();
            for await (const i of items) {
                pending.add(this.mapFunction(i));        
                while (pending.size >= this.maxConcurrent) {
                    yield await race(pending);
                }    
            }
            while (pending.size > 0) {
                yield await race(pending);
            }
        }
    }
}

module.exports = {
    MapConcurrent
};