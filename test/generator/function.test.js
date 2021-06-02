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
const { AsyncGeneratorFunction } = require('../../lib/generator/function');

async function toArray(items) {
    const result = [];
    for await (const item of items) {
        result.push(item);
    }
    return result;
}

describe('function', function() {
    it('name', async function() {
        class MyFunc extends AsyncGeneratorFunction { }
        const myFunc = new MyFunc;
        assert.strictEqual(myFunc.name, 'MyFunc');
    });
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