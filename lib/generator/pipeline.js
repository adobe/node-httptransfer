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
     * Configure a filter function
     * 
     * The filter function is executed called on every item before every pipeline step,
     * this allows items to be filtered out or adjusted.
     * 
     * @param {AsyncGeneratorFunction} filterFunc Filter function 
     */
    setFilterFunction(filterFunc) {
        this.filterFunc = filterFunc;
    }

    /**
     * Execute the pipeline of functions
     * 
     * @generator
     * @param {Object[]|Generator||AsyncGenerator} items Items to process
     * @param {...Object} args Arguments to pass to the functions
     * @yields {Object} 
     */
    async* execute(items, ...args) {
        let generator = items;
        for (const func of this.funcs) {
            if (this.filterFunc) {
                generator = this.filterFunc.execute(generator, ...args);
            }
            generator = func.execute(generator, ...args);
        }
        yield* generator;
    }
}

/**
 * Execute pipeline
 * 
 * @param {Pipeline} pipeline Pipeline to execute
 * @param {Object[]|Generator|AsyncGenerator} input Input items
 * @param {Object..} [args] Arguments to pass to the pipeline
 */
async function executePipeline(pipeline, input, ...args) {
    for await (const item of pipeline.execute(input, ...args)) {
        item;
    }
}

module.exports = {
    Pipeline,
    executePipeline
};