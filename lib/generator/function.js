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
 * Base async function class that can be executed on a single item
 */
class AsyncFunction {
    /**
     * Execute the function
     * 
     * @param {Object} item Input item
     * @returns {Object} Output item
     */
    async execute(item) {
        return item;
    }
}

/**
 * Base async generator function class that can be executed on a set of items,
 * which yields the same number of results as input items.
 */
class AsyncGeneratorFunction {
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
     * @param {Object[]|Generator||AsyncGenerator} items 
     * @yields {Object} 
     */
    async* execute(items) {
        yield* items;
    }
}

module.exports = {
    AsyncFunction,
    AsyncGeneratorFunction
};