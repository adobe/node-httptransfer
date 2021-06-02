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

const PRIVATE = Symbol("PRIVATE");

/**
 * Base async generator function class that can be executed on a set of items,
 * which yields the same number of results as input items.
 */
class AsyncGeneratorFunction {
    /**
     * Constructor
     */
    constructor() {
        this[PRIVATE] = {
            name: this.constructor.name
        };
    }

    /**
     * Name of the function
     *
     * @returns {String} Name of the function
     */
    get name() {
        return this[PRIVATE].name;
    }

    /**
     * Check if the given item can be added to the batch of items
     * 
     * This is used by MapConcurrent to determine if the next item can be 
     * added to the batch. This allows the implementer to make sure that 
     * batches only contain compatible items.
     * 
     * @param {Object[]} batch Current batch of items (not empty)
     * @param {Object} item Item to check
     * @returns {Boolean} True if the item can be added to the batch
     */
    checkAddBatch(batch, transferAsset) {
        batch;
        transferAsset;
        return true;
    }

    /**
     * Execute the generator, yields the same number of results as input items
     * 
     * @generator
     * @param {Object[]|Generator||AsyncGenerator} items Items to process
     * @param {Object[]} [...args] Additional arguments
     * @yields {Object} Processed item
     */
    async* execute(items, ...args) {
        args;
        yield* items;
    }
}

module.exports = {
    AsyncGeneratorFunction
};