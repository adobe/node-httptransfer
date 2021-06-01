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
const rewire = require('rewire');
const { AsyncGeneratorFunction } = require('../lib/generator/function');
const { MapConcurrent } = require('../lib/generator/mapconcurrent');
const mapconcurrent_rewire = rewire('../lib/generator/mapconcurrent');
const checkAddBatch = mapconcurrent_rewire.__get__('checkAddBatch');
const executeBatch = mapconcurrent_rewire.__get__('executeBatch');
const waitResult = mapconcurrent_rewire.__get__('waitResult');
const { Pipeline, executePipeline } = require('../lib/generator/pipeline');
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

async function sleepReturnValue(sleepMs, value) {
    await sleep(sleepMs);
    return value;
}

describe.skip('generator', function() {
    describe('mapconcurrent', function() {
        describe('checkAddBatch', function() {
            it('empty', function() {
                let callbackInvoked = false;
                const batch = [];
                const result = checkAddBatch({
                    checkAddBatch: () => {
                        callbackInvoked = true;
                        return true;
                    }
                }, batch, 1, 1);

                assert.strictEqual(result, true);
                assert.strictEqual(callbackInvoked, false);
            });
            it('full', function() {
                let callbackInvoked = false;
                const batch = [ 1 ];
                const result = checkAddBatch({
                    checkAddBatch: () => {
                        callbackInvoked = true;
                        return true;
                    }
                }, batch, 2, 1);

                assert.strictEqual(result, false);
                assert.strictEqual(callbackInvoked, false);
            });
            it('no-checkaddbatch', function() {
                const batch = [ 1 ];
                const result = checkAddBatch({ }, batch, 2, 2);
                assert.strictEqual(result, true);
            });
            it('checkaddbatch-false', function() {
                let callbackInvoked = false;
                const batch = [ 1 ];
                const result = checkAddBatch({ 
                    checkAddBatch: () => {
                        callbackInvoked = true;
                        return false;
                    }
                }, batch, 2, 2);
                assert.strictEqual(result, false);
                assert.strictEqual(callbackInvoked, true);
            });
            it('checkaddbatch-true', function() {
                let callbackInvoked = false;
                const batch = [ 1 ];
                const result = checkAddBatch({ 
                    checkAddBatch: () => {
                        callbackInvoked = true;
                        return true;
                    }
                }, batch, 2, 2);
                assert.strictEqual(result, true);
                assert.strictEqual(callbackInvoked, true);
            });
        });
        describe('executeBatch', function() {
            it('empty-array', async function() {
                const result = await executeBatch({
                    execute: async function*(values) {
                        for await (const value of values) {
                            yield value + 1;
                        }
                    }
                }, [ ]);
                assert.deepStrictEqual(result, [ ]);
            });
            it('array', async function() {
                const result = await executeBatch({
                    execute: async function*(values) {
                        for await (const value of values) {
                            yield value + 1;
                        }
                    }
                }, [ 1 ]);
                assert.deepStrictEqual(result, [ 2 ]);
            });
            it('empty-generator', async function() {
                const result = await executeBatch({
                    execute: async function*(values) {
                        for await (const value of values) {
                            yield value + 1;
                        }
                    }
                }, toGenerator([ ]));
                assert.deepStrictEqual(result, [ ]);
            });
            it('generator', async function() {
                const result = await executeBatch({
                    execute: async function*(values) {
                        for await (const value of values) {
                            yield value + 1;
                        }
                    }
                }, toGenerator([ 1 ]));
                assert.deepStrictEqual(result, [ 2 ]);
            });
        });
        describe('waitResult', function() {
            it('empty-ordered', async function() {
                try {
                    const pending = [];
                    await waitResult(pending, true);  
                    assert.ok(false, 'waitResult expected to reject empty pending');
                } catch (e) {
                    assert.strictEqual(e.message, 'Invalid state: pending is empty');
                }
            });
            it('empty-unordered', async function() {
                try {
                    const pending = [];
                    await waitResult(pending, false);  
                    assert.ok(false, 'waitResult expected to reject empty pending');
                } catch (e) {
                    assert.strictEqual(e.message, 'Invalid state: pending is empty');
                }
            });
            it('ordered', async function() {
                const pending = [
                    sleepReturnValue(200, 1),
                    sleepReturnValue(100, 2)
                ];
                const result1 = await waitResult(pending, true);
                assert.strictEqual(result1, 1);
                assert.strictEqual(pending.length, 1);
                const result2 = await waitResult(pending, true);
                assert.strictEqual(result2, 2);
                assert.strictEqual(pending.length, 0);
            });
            it('unordered', async function() {
                const pending = [
                    sleepReturnValue(200, 1),
                    sleepReturnValue(100, 2)
                ];
                const result1 = await waitResult(pending, false);
                assert.strictEqual(result1, 2);
                assert.strictEqual(pending.length, 1);
                const result2 = await waitResult(pending, false);
                assert.strictEqual(result2, 1);
                assert.strictEqual(pending.length, 0);
            });
        });
        describe('e2e', function () {
            it('empty', async function() {
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            yield value + 1;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                });
                const result = await toArray(map.execute([ ]));
                assert.deepStrictEqual(result, [ ]);
                assert.deepStrictEqual(countExecuteValues, [ ]);
            });
            it('single-threaded-generator', async function() {
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            yield value + 1;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                });
                const input = toGenerator([ 1, 2, 3, 4, 5 ]);
                const result = await toArray(map.execute(input));
                assert.deepStrictEqual(result, [ 2, 3, 4, 5, 6 ]);
                assert.deepStrictEqual(countExecuteValues, [ 1, 1, 1, 1, 1 ]);
            });
            it('single-threaded-nobatch', async function() {
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            yield value + 1;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                });
                const result = await toArray(map.execute([ 1, 2, 3, 4, 5 ]));
                assert.deepStrictEqual(result, [ 2, 3, 4, 5, 6 ]);
                assert.deepStrictEqual(countExecuteValues, [ 1, 1, 1, 1, 1 ]);
            });
            it('single-threaded-batch', async function() {
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            yield value + 1;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, {
                    maxBatchLength: 2
                });
                const result = await toArray(map.execute([ 1, 2, 3, 4, 5 ]));
                assert.deepStrictEqual(result, [ 2, 3, 4, 5, 6 ]);
                assert.deepStrictEqual(countExecuteValues, [ 2, 2, 1 ]);
            });
            it('single-threaded-batch-checkAdd', async function() {
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    checkAddBatch: function(batch, value) {
                        return batch[batch.length-1] < value;
                    },
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            yield value + 1;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, {
                    maxBatchLength: 2
                });
                const result = await toArray(map.execute([ 1, 2, 3, 1, 2 ]));
                assert.deepStrictEqual(result, [ 2, 3, 4, 2, 3 ]);
                assert.deepStrictEqual(countExecuteValues, [ 2, 1, 2 ]);
            });
            it('multi-unordered', async function() {
                // unordered should return the first one completed, use sleep to force
                // a reverse ordering
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            await sleep(500 - value * 100);
                            yield value;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, { maxConcurrent: 3 });
                const result = await toArray(map.execute([ 1, 2, 3 ]));
                assert.deepStrictEqual(result, [ 3, 2, 1 ]);        
                assert.deepStrictEqual(countExecuteValues, [ 1, 1, 1 ]);
            });
            it('multi-unordered-batch', async function() {
                // unordered should return the first one completed, use sleep to force
                // a reverse ordering
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            await sleep(500 - value * 100);
                            yield value;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, { maxBatchLength: 3, maxConcurrent: 3 });
                const result = await toArray(map.execute([ 1, 2, 3 ]));
                assert.deepStrictEqual(result, [ 1, 2, 3 ]);        
                assert.deepStrictEqual(countExecuteValues, [ 3 ]);
            });
            it('multi-unordered-batch-checkAdd', async function() {
                // unordered should return the first one completed, use sleep to force
                // a reverse ordering
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    checkAddBatch: function(batch, value) {
                        return batch[batch.length-1] < value;
                    },
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            await sleep(500 - value * 100);
                            yield value;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, { maxBatchLength: 3, maxConcurrent: 3 });
                const result = await toArray(map.execute([ 1, 2, 1 ]));
                assert.deepStrictEqual(result, [ 1, 1, 2  ]);        
                assert.deepStrictEqual(countExecuteValues, [ 1, 2 ]);
            });
            it('multi-ordered', async function() {
                // unordered should return the first one completed, use sleep to force
                // a reverse ordering
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            await sleep(500 - value * 100);
                            yield value;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, { maxConcurrent: 3, ordered: true });
                const result = await toArray(map.execute([ 1, 2, 3 ]));
                assert.deepStrictEqual(result, [ 1, 2, 3 ]);        
                assert.deepStrictEqual(countExecuteValues, [ 1, 1, 1 ]);
            });
            it('multi-ordered-batch', async function() {
                // unordered should return the first one completed, use sleep to force
                // a reverse ordering
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            await sleep(500 - value * 100);
                            yield value;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, { maxBatchLength: 3, maxConcurrent: 3, ordered: true });
                const result = await toArray(map.execute([ 1, 2, 3 ]));
                assert.deepStrictEqual(result, [ 1, 2, 3 ]);        
                assert.deepStrictEqual(countExecuteValues, [ 3 ]);
            });
            it('multi-ordered-batch-checkAdd', async function() {
                // unordered should return the first one completed, use sleep to force
                // a reverse ordering
                const countExecuteValues = [];
                const map = new MapConcurrent({
                    checkAddBatch: function(batch, value) {
                        return batch[batch.length-1] < value;
                    },
                    execute: async function*(values) {
                        let i = 0;
                        for await (const value of values) {
                            await sleep(500 - value * 100);
                            yield value;
                            ++i;
                        }
                        countExecuteValues.push(i);
                    }
                }, { maxBatchLength: 3, maxConcurrent: 3, ordered: true });
                const result = await toArray(map.execute([ 1, 2, 1 ]));
                assert.deepStrictEqual(result, [ 1, 2, 1  ]);        
                assert.deepStrictEqual(countExecuteValues, [ 1, 2 ]);
            });
        });
    });
    describe('function', function() {
        it('checkAddBatch-default', async function() {
            const func = new AsyncGeneratorFunction();
            const result = func.checkAddBatch([ 1 ], 2);
            assert.deepStrictEqual(result, true);
        });
        it('execute-default', async function() {
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
    });
});
