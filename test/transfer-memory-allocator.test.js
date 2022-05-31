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
const { TransferMemoryBuffer } = require('../lib/transfer-memory-allocator');

describe.only('transfer-memory-allocator', function () {
    it('can create memory allocator (buffer pool)', async function() {
        const memoryAllocator = new TransferMemoryBuffer();
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined, "After instantiation, there should be no allocated block but there are");
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0, "After instantiation, allocated blocks length should be 0 but it isn't");
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
    });
});