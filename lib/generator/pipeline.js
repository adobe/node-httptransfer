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
 * Pipeline of functions are invoked sequentially
 * 
 * new PipelineFunction(func1, func2).execute(input) is equivalent to:
 * func2.execute(func1.execute(input))
 */
class Pipeline extends AsyncGeneratorFunction {
    /**
     * Compose a pipeline of functions that are invoked in-order
     * 
     * @param {...AsyncGeneratorFunction} funcs List of async generator functions
     */
    constructor(...funcs) {
        super();
        this.funcs = funcs;
    }

    /**
     * Execute the pipeline of functions
     * 
     * @generator
     * @param {Object[]|Generator||AsyncGenerator} items 
     * @yields {Object} 
     */
    async* execute(items) {
        let generator = items;
        for (const func of this.funcs) {
            generator = func.execute(generator);
        }
        yield* generator;
    }
}

/**
 * @callback PipelineReduceCallback
 * @param {Object} accumulator Accumulates callback's return values
 * @param {Object} currentValue Current item being processed
 * @param {Number} index Index of the item being processed
 * @returns {Object} Single accumulation value
 */
/**
 * Execute pipeline
 * 
 * @param {Pipeline} pipeline Pipeline to execute
 * @param {Object[]|Generator|AsyncGenerator} input Input items
 * @param {PipelineReduceCallback} [reduceCallback] Callback to accumulate the results in to a single report
 * @param {Object} [initialValue] Initial accumulation value, if not provided it will start with the first item
 */
async function executePipeline(pipeline, input, reduceCallback, initialValue) {
    let accumulator = initialValue;
    let initializeAccumulator = !initialValue;
    let index = 0;
    for await (const item of pipeline.execute(input)) {
        if (initializeAccumulator) {
            accumulator = item;
            initializeAccumulator = false;
        } else if (reduceCallback) {
            accumulator = reduceCallback(accumulator, item, index);
        }
        ++index;
    }
    return accumulator;
}

module.exports = {
    Pipeline,
    executePipeline
};