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
const { Flatten } = require('../lib/generator/flatten');
const { Batch } = require('../lib/generator/batch');
const { MapConcurrent } = require('../lib/generator/mapconcurrent');
const { Pipeline } = require('../lib/generator/pipeline');

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

describe.only('generator', function() {
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
    describe('mapbatch', function() {
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
        it('', async function() {
          
        });
    });
    describe('pipeline', function() {
        it('', async function() {
          
        });
    });
});
