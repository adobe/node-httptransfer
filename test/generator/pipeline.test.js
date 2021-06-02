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

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const { MapConcurrent } = require('../../lib/generator/mapconcurrent');
const { Pipeline, executePipeline } = require('../../lib/generator/pipeline');

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

describe('pipeline', function() {
    it('empty-pipeline', async function() {
        const pipeline = new Pipeline();
        const result = await toArray(pipeline.execute([ 1, 2, 3, 4, 5 ]));
        assert.deepStrictEqual(result, [ 1, 2, 3, 4, 5 ]);    
    });
    it('single-operation-pipeline', async function() {
        const pipeline = new Pipeline({
            execute: async function*(items) {
                for await (const item of items) {
                    yield item + 1;
                }
            }
        });
        const result = await toArray(pipeline.execute([ 1, 2, 3, 4, 5 ]));
        assert.deepStrictEqual(result, [ 2, 3, 4, 5, 6 ]);    
    });
    it('two-operation-pipeline', async function() {
        const pipeline = new Pipeline({
            execute: async function*(items) {
                for await (const item of items) {
                    yield item + 1;
                }
            }
        }, {
            execute: async function*(items) {
                for await (const item of items) {
                    yield item * 2;
                }
            }
        });
        const result = await toArray(pipeline.execute([ 1, 2, 3, 4, 5 ]));
        assert.deepStrictEqual(result, [ 4, 6, 8, 10, 12 ]);    
    });
    it('pipeline-batch-map', async function() {
        const pipeline = new Pipeline(
            new MapConcurrent({
                execute: async function*(values) {
                    const batch = [];
                    for await (const value of values) {
                        batch.push(value);
                    }
                    yield* batch.reverse();
                }
            }, {
                maxBatchLength: 3
            })
        );
        const result = await toArray(pipeline.execute([ 1, 2, 3, 4, 5 ]));
        assert.deepStrictEqual(result, [ 3, 2, 1, 5, 4 ]);    
    });
    it('args', async function() {
        const pipeline = new Pipeline({
            execute: async function*(values, arg) {
                for await (const value of values) {
                    yield value + arg;
                }
            }
        });
        const result = await toArray(pipeline.execute([ 1, 2, 3, 4 ], 7));
        assert.deepStrictEqual(result, [ 8, 9, 10, 11 ]);    
    });
    it('executePipeline', async function() {
        let sum = 0;
        const pipeline = new Pipeline({
            execute: async function*(values) {
                for await (const value of values) {
                    sum += value;
                    yield value;
                }
            }
        });
        await executePipeline(pipeline, [1, 2, 3, 4]);
        assert.strictEqual(sum, 10);
    });
    it('executePipeline-args', async function() {
        let sum = 0;
        const pipeline = new Pipeline({
            execute: async function*(values, arg) {
                for await (const value of values) {
                    sum += value + arg;
                    yield value;
                }
            }
        });
        await executePipeline(pipeline, [1, 2, 3, 4], 7);
        assert.strictEqual(sum, 38);
    });
    it('filter-single-pipeline', async function() {
        let sum = 0;
        const pipeline = new Pipeline({
            execute: async function*(values) {
                for await (const value of values) {
                    sum += value;
                    yield value;
                }
            }
        });
        pipeline.setFilterFunction({
            execute: async function*(values) {
                for await (const value of values) {
                    if ((value % 2) === 0) {
                        yield value;
                    }
                }
            }
        });
        await executePipeline(pipeline, [1, 2, 3, 4, 5, 6]);
        assert.strictEqual(sum, 12);
    });
    it('filter-two-function-pipeline', async function() {
        const pipeline = new Pipeline({
            execute: async function*(values) {
                for await (const value of values) {
                    yield value + 1;
                }
            }
        }, {
            execute: async function*(values) {
                for await (const value of values) {
                    yield value * 2;
                }
            }            
        });
        pipeline.setFilterFunction({
            execute: async function*(values) {
                let firstValue = true;
                for await (const value of values) {
                    if (!firstValue) {
                        yield value;
                    }
                    firstValue = false;
                }
            }
        });
        const result = await toArray(pipeline.execute([1, 2, 3, 4, 5, 6]));
        assert.deepStrictEqual(result, [8, 10, 12, 14]); // 1 and 2 were filtered out
    });
});
