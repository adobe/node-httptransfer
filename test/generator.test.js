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

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const { AsyncGeneratorFunction } = require('../lib/generator/function');
const { Flatten } = require('../lib/generator/flatten');
const { Batch } = require('../lib/generator/batch');
const { MapConcurrent } = require('../lib/generator/mapconcurrent');
const { Pipeline } = require('../lib/generator/pipeline');
const { promisify } = require('util');

const sleep = promisify(setTimeout);

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

async function* toGenerator(items) {
    for await (const item of items) {
        yield item;
    }
}

function checkAddBatchLessThan(batch, item) {
    const length = batch.length;
    return (length === 0) || (batch[length-1] < item);
}

describe('generator', function() {
    describe('flatten', function() {
        it('empty', async function() {
            const flatten = new Flatten();
            const result = await toArray(flatten.execute([]));
            assert.deepStrictEqual(result, []);
        });
        it('single item', async function() {
            const flatten = new Flatten();
            const result = await toArray(flatten.execute([ 1 ]));
            assert.deepStrictEqual(result, [ 1 ]);
        });
        it('single nested item', async function() {
            const flatten = new Flatten();
            const result = await toArray(flatten.execute([ [ 1 ] ]));
            assert.deepStrictEqual(result, [ 1 ]);
        });
        it('multiple nested items', async function() {
            const flatten = new Flatten();
            const result = await toArray(flatten.execute([ [ 1, 2, 3 ], [ 4, 5, 6 ] ]));
            assert.deepStrictEqual(result, [ 1, 2, 3, 4, 5, 6 ]);
        });
        it('deep nested items - limit 1', async function() {
            const flatten = new Flatten();
            const result = await toArray(flatten.execute([ [ [ 1, 2, 3 ] ], [ 4, 5, 6 ] ]));
            assert.deepStrictEqual(result, [ [ 1, 2, 3 ], 4, 5, 6 ]);
        });
        it('deep nested items - limit 2', async function() {
            const flatten = new Flatten({ maxDepth: 2 });
            const result = await toArray(flatten.execute([ [ [ 1, 2, 3 ] ], [ 4, 5, 6 ] ]));
            assert.deepStrictEqual(result, [ 1, 2, 3, 4, 5, 6 ]);
        });
        it('generator', async function() {
            const flatten = new Flatten();
            const generator = toGenerator([ [ 1, 2, 3 ], [ 4, 5, 6 ] ]);
            const result = await toArray(flatten.execute(generator));
            assert.deepStrictEqual(result, [ 1, 2, 3, 4, 5, 6 ]);
        });
    });
    describe('batch', function() {
        it('empty', async function() {
            const batch = new Batch();
            const result = await toArray(batch.execute([]));
            assert.deepStrictEqual(result, []);
        });
        it('single item', async function() {
            const batch = new Batch();
            const result = await toArray(batch.execute([ 1 ]));
            assert.deepStrictEqual(result, [ [ 1 ] ]);
        });
        it('multiple items', async function() {
            const batch = new Batch();
            const result = await toArray(batch.execute([ 1, 2, 3 ]));
            assert.deepStrictEqual(result, [ [ 1 ], [ 2 ], [ 3 ] ]);
        });
        it('multiple items - maxBatchLength 2', async function() {
            const batch = new Batch(() => true, { maxBatchLength: 2 });
            const result = await toArray(batch.execute([ 1, 2, 3 ]));
            assert.deepStrictEqual(result, [ [ 1, 2 ], [ 3 ] ]);
        });
        it('multiple items - maxBatchLength 3', async function() {
            const batch = new Batch(() => true, { maxBatchLength: 3 });
            const result = await toArray(batch.execute([ 1, 2, 3 ]));
            assert.deepStrictEqual(result, [ [ 1, 2, 3 ] ]);
        });
        it('multiple items - maxBatchLength 6, only <', async function() {
            const batch = new Batch(checkAddBatchLessThan, { maxBatchLength: 6 });
            const result = await toArray(batch.execute([ 1, 2, 3, 1, 2, 3 ]));
            assert.deepStrictEqual(result, [ [ 1, 2, 3 ], [ 1, 2, 3 ] ]);
        });
        it('multiple items - generator', async function() {
            const batch = new Batch(checkAddBatchLessThan, { maxBatchLength: 6 });
            const generator = toGenerator([ 1, 2, 3, 1, 2, 3 ]);
            const result = await toArray(batch.execute(generator));
            assert.deepStrictEqual(result, [ [ 1, 2, 3 ], [ 1, 2, 3 ] ]);
        });
    });
    describe('mapconcurrent', function() {
        it('empty', async function() {
            const map = new MapConcurrent(value => value + 1);
            const result = await toArray(map.execute([ ]));
            assert.deepStrictEqual(result, [ ]);        
        });
        it('single-threaded', async function() {
            const map = new MapConcurrent(value => value + 1);
            const result = await toArray(map.execute([ 1, 2, 3, 4, 5 ]));
            assert.deepStrictEqual(result, [ 2, 3, 4, 5, 6]);        
        });
        it('multi-unordered', async function() {
            // unordered should return the first one completed, use sleep to force
            // a reverse ordering
            const map = new MapConcurrent(async value => {
                await sleep(500 - value * 100);
                return value;
            }, { maxConcurrent: 3 });
            const result = await toArray(map.execute([ 1, 2, 3 ]));
            assert.deepStrictEqual(result, [ 3, 2, 1 ]);        
        });
        it('multi-ordered', async function() {
            // ordered should keep the same order as the entries entered, use sleep
            // to make sure this order is retained
            const map = new MapConcurrent(async value => {
                await sleep(500 - value * 100);
                return value;
            }, { ordered: true, maxConcurrent: 3 });
            const result = await toArray(map.execute([ 1, 2, 3 ]));
            assert.deepStrictEqual(result, [ 1, 2, 3 ]);        
        });
        it('multi-ordered-generator', async function() {
            // ordered should keep the same order as the entries entered, use sleep
            // to make sure this order is retained
            const generator = toGenerator([1, 2, 3, 4, 5]);
            const map = new MapConcurrent(async value => {
                await sleep(500 - value * 100);
                return value;
            }, { maxConcurrent: 5 });
            const result = await toArray(map.execute(generator));
            assert.deepStrictEqual(result, [ 5, 4, 3, 2, 1 ]);        
        });
    });
    describe('function', function() {
        it('test', async function() {
            const func = new AsyncGeneratorFunction();
            const result = await toArray(func.execute([1,2,3]));
            assert.deepStrictEqual(result, [ 1, 2, 3 ]);
        });
    });
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
        it('batch-map-flatten', async function() {
            const pipeline = new Pipeline(
                new Batch(() => true, { maxBatchLength: 3 }),
                new MapConcurrent(value => value.reverse()),
                new Flatten()
            );
            const result = await toArray(pipeline.execute([ 1, 2, 3, 4, 5 ]));
            assert.deepStrictEqual(result, [ 3, 2, 1, 5, 4 ]);    
        });
    });
});
