/*
 * Copyright 2022 Adobe. All rights reserved.
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
    it('can create memory allocator (buffer pool)', async function () {
        const memoryAllocator = new TransferMemoryBuffer(); // use default suggested Buffer size
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined, "After instantiation, there should be no allocated block but there are");
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0, "After instantiation, allocated blocks length should be 0 but it isn't");
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
    });

    it('can create memory allocator (buffer pool) using a suggested size of 1024 bytes', async function () {
        const suggestedSize = 1024; // 1Kb

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined, "After instantiation, there should be no allocated block but there are");
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0, "After instantiation, allocated blocks length should be 0 but it isn't");
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);

        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);
    });

    it('can allocate a first block of memory (256 bytes) from the buffer pool', async function () {
        const suggestedSize = 1024; // 1Kb

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);

        const initialBlockSize = 256;
        const allocatedMemory = await memoryAllocator.obtainBuffer(initialBlockSize);
        assert.ok(allocatedMemory !== null && allocatedMemory !== undefined);
        assert.ok(Buffer.isBuffer(allocatedMemory.buffer));
        assert.strictEqual(allocatedMemory.size, initialBlockSize);
        assert.strictEqual(allocatedMemory.startIndex, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 1);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head === memoryAllocator.allocatedBlocks.tail);
    });

    it('can release an allocated first and only block of memory (256 bytes)', async function () {
        const suggestedSize = 1024; // 1Kb

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);

        const initialBlockSize = 256;
        const allocatedMemory = await memoryAllocator.obtainBuffer(initialBlockSize);
        assert.ok(allocatedMemory !== null && allocatedMemory !== undefined);
        assert.ok(Buffer.isBuffer(allocatedMemory.buffer));
        assert.strictEqual(allocatedMemory.size, initialBlockSize);
        assert.strictEqual(allocatedMemory.startIndex, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 1);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head === memoryAllocator.allocatedBlocks.tail);

        memoryAllocator.releaseBuffer(allocatedMemory);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);
    });

    it('can allocate two blocks of memory from the buffer pool', async function () {
        const suggestedSize = 100; // bytes

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);

        // first memory block
        const initialBlockSize = 2;
        const allocatedMemory = await memoryAllocator.obtainBuffer(initialBlockSize);
        assert.ok(allocatedMemory !== null && allocatedMemory !== undefined);
        assert.ok(Buffer.isBuffer(allocatedMemory.buffer));
        assert.strictEqual(allocatedMemory.size, initialBlockSize);
        assert.strictEqual(allocatedMemory.startIndex, 0);
        assert.strictEqual(allocatedMemory.endIndex, allocatedMemory.startIndex + initialBlockSize - 1);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 1);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head === memoryAllocator.allocatedBlocks.tail);

        // second memory block
        const secondBlockSize = 12;
        const anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(secondBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 2);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, secondBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, allocatedMemory.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + secondBlockSize - 1);
    });

    it('can allocate contiguous blocks of memory from the buffer pool', async function () {
        const suggestedSize = 100; // bytes

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);

        // first memory block
        const initialBlockSize = 2;
        const allocatedMemory = await memoryAllocator.obtainBuffer(initialBlockSize);
        assert.ok(allocatedMemory !== null && allocatedMemory !== undefined);
        assert.ok(Buffer.isBuffer(allocatedMemory.buffer));
        assert.strictEqual(allocatedMemory.size, initialBlockSize);
        assert.strictEqual(allocatedMemory.startIndex, 0);
        assert.strictEqual(allocatedMemory.endIndex, allocatedMemory.startIndex + initialBlockSize - 1);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 1);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head === memoryAllocator.allocatedBlocks.tail);

        // second memory block
        const secondBlockSize = 12;
        let anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(secondBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 2);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, secondBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, allocatedMemory.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + secondBlockSize - 1);

        // other continuous memory blocks
        let otherBlockSize = 5;
        let previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);

        otherBlockSize = 3;
        previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);

        otherBlockSize = 2;
        previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);
    });

    it('can release a memory block anywhere from allocated memory blocks to the buffer pool', async function () {
        const suggestedSize = 100; // bytes

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);

        // first memory block
        const initialBlockSize = 2;
        const allocatedMemory = await memoryAllocator.obtainBuffer(initialBlockSize);
        assert.ok(allocatedMemory !== null && allocatedMemory !== undefined);
        assert.ok(Buffer.isBuffer(allocatedMemory.buffer));
        assert.strictEqual(allocatedMemory.size, initialBlockSize);
        assert.strictEqual(allocatedMemory.startIndex, 0);
        assert.strictEqual(allocatedMemory.endIndex, allocatedMemory.startIndex + initialBlockSize - 1);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 1);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head === memoryAllocator.allocatedBlocks.tail);

        const secondBlockSize = 12;
        let anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(secondBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 2);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, secondBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, allocatedMemory.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + secondBlockSize - 1);

        let otherBlockSize = 5;
        let previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);
        // we'll use this block to release it later and create a "hole" in the contiguous used memory blocks
        const blockToReleaseLater = anotherAllocatedMemoryBlock;

        otherBlockSize = 4;
        previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);

        // release block of size 5, which creates a "hole" in allocated buffer blocks (memory fragments)
        memoryAllocator.releaseBuffer(blockToReleaseLater);
        const usedSize = initialBlockSize + secondBlockSize + otherBlockSize;
        assert.strictEqual(memoryAllocator.availablePoolSize, (suggestedSize - usedSize));
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 3);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== memoryAllocator.allocatedBlocks.tail);
    });

    it('can allocate non-contiguous blocks of memory from the buffer pool', async function () {
        const suggestedSize = 100; // bytes

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);

        // first memory block
        const initialBlockSize = 2;
        const allocatedMemory = await memoryAllocator.obtainBuffer(initialBlockSize);
        assert.ok(allocatedMemory !== null && allocatedMemory !== undefined);
        assert.ok(Buffer.isBuffer(allocatedMemory.buffer));
        assert.strictEqual(allocatedMemory.size, initialBlockSize);
        assert.strictEqual(allocatedMemory.startIndex, 0);
        assert.strictEqual(allocatedMemory.endIndex, allocatedMemory.startIndex + initialBlockSize - 1);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 1);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head === memoryAllocator.allocatedBlocks.tail);

        const secondBlockSize = 12;
        let anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(secondBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 2);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, secondBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, allocatedMemory.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + secondBlockSize - 1);

        let otherBlockSize = 5;
        let previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);
        // we'll use this block to release it later and create a "hole" in the contiguous used memory blocks
        const blockToReleaseLater = anotherAllocatedMemoryBlock;

        otherBlockSize = 4;
        previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);

        // release block of size 5 to create a "hole" in allocated buffer blocks
        memoryAllocator.releaseBuffer(blockToReleaseLater);
        assert.strictEqual(blockToReleaseLater.size, 0);
        assert.strictEqual(blockToReleaseLater.startIndex, -1);
        assert.strictEqual(blockToReleaseLater.buffer, null);
        const usedSize = initialBlockSize + secondBlockSize + otherBlockSize;
        assert.strictEqual(memoryAllocator.availablePoolSize, (suggestedSize - usedSize));
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 3);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== memoryAllocator.allocatedBlocks.tail);

        // allocated a new memory block of size 1, which should fit in the "hole" left by memory which was just released
        otherBlockSize = 1;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 4);
        let expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        otherBlockSize = 3;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 5);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        otherBlockSize = 3;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 6);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        otherBlockSize = 17;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 7);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            },
            {
                memoryBlockSize: 17,
                memoryBlockStartIndex: 26,
                memoryBlockEndIndex: 42
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);
    });

    it('can release all memory allocated from the buffer pool back to the buffer pool', async function () {
        const suggestedSize = 100; // bytes

        const memoryAllocator = new TransferMemoryBuffer(suggestedSize);
        assert.ok(memoryAllocator !== null && memoryAllocator !== undefined);

        assert.ok(memoryAllocator.allocatedBlocks !== null && memoryAllocator.allocatedBlocks !== undefined);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 0);
        assert.strictEqual(memoryAllocator.allocatedBlocks.tail, null);
        assert.strictEqual(memoryAllocator.allocatedBlocks.head, null);
        assert.strictEqual(memoryAllocator.poolSize, suggestedSize);

        // first memory block
        const initialBlockSize = 2;
        const allocatedMemory = await memoryAllocator.obtainBuffer(initialBlockSize);
        const block1 = allocatedMemory;
        assert.ok(allocatedMemory !== null && allocatedMemory !== undefined);
        assert.ok(Buffer.isBuffer(allocatedMemory.buffer));
        assert.strictEqual(allocatedMemory.size, initialBlockSize);
        assert.strictEqual(allocatedMemory.startIndex, 0);
        assert.strictEqual(allocatedMemory.endIndex, allocatedMemory.startIndex + initialBlockSize - 1);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 1);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head === memoryAllocator.allocatedBlocks.tail);

        const secondBlockSize = 12;
        let anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(secondBlockSize);
        const block2 = anotherAllocatedMemoryBlock;
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 2);
        assert.strictEqual(anotherAllocatedMemoryBlock.size, secondBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, allocatedMemory.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + secondBlockSize - 1);

        let otherBlockSize = 5;
        let previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        // we'll use this block to release it later and create a "hole" in the contiguous used memory blocks

        const block3 = anotherAllocatedMemoryBlock;
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);

        otherBlockSize = 4;
        previousAllocatedBlock = anotherAllocatedMemoryBlock;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        const block4 = anotherAllocatedMemoryBlock;
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(anotherAllocatedMemoryBlock.startIndex, previousAllocatedBlock.endIndex + 1);
        assert.strictEqual(anotherAllocatedMemoryBlock.endIndex, anotherAllocatedMemoryBlock.startIndex + otherBlockSize - 1);

        // release block of size 5 to create a "hole" in allocated buffer blocks
        memoryAllocator.releaseBuffer(block3);
        assert.strictEqual(block3.size, 0);
        assert.strictEqual(block3.startIndex, -1);
        assert.strictEqual(block3.buffer, null);
        const usedSize = initialBlockSize + secondBlockSize + otherBlockSize;
        assert.strictEqual(memoryAllocator.availablePoolSize, (suggestedSize - usedSize));
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 3);
        assert.ok(memoryAllocator.allocatedBlocks.tail !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== null);
        assert.ok(memoryAllocator.allocatedBlocks.head !== memoryAllocator.allocatedBlocks.tail);

        // allocated a new memory block of size 1, which should fit in the "hole" left by memory which was just released
        otherBlockSize = 1;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        const block5 = anotherAllocatedMemoryBlock;
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 4);
        let expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        otherBlockSize = 3;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        const block6 = anotherAllocatedMemoryBlock;
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 5);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        otherBlockSize = 3;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        const block7 = anotherAllocatedMemoryBlock;
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 6);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        otherBlockSize = 17;
        anotherAllocatedMemoryBlock = await memoryAllocator.obtainBuffer(otherBlockSize);
        const block8 = anotherAllocatedMemoryBlock;
        assert.strictEqual(anotherAllocatedMemoryBlock.size, otherBlockSize);
        assert.strictEqual(memoryAllocator.allocatedBlocks.length, 7);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 2,
                memoryBlockStartIndex: 0,
                memoryBlockEndIndex: 1
            },
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            },
            {
                memoryBlockSize: 17,
                memoryBlockStartIndex: 26,
                memoryBlockEndIndex: 42
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        memoryAllocator.releaseBuffer(block1);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 4,
                memoryBlockStartIndex: 19,
                memoryBlockEndIndex: 22
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            },
            {
                memoryBlockSize: 17,
                memoryBlockStartIndex: 26,
                memoryBlockEndIndex: 42
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);
        assert.strictEqual(block1.size, 0);
        assert.strictEqual(block1.startIndex, -1);
        assert.strictEqual(block1.buffer, null);

        memoryAllocator.releaseBuffer(block4);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            },
            {
                memoryBlockSize: 17,
                memoryBlockStartIndex: 26,
                memoryBlockEndIndex: 42
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);
        memoryAllocator.releaseBuffer(block4);
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);
        memoryAllocator.releaseBuffer(block4);
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        memoryAllocator.releaseBuffer(block8);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 12,
                memoryBlockStartIndex: 2,
                memoryBlockEndIndex: 13
            },
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        memoryAllocator.releaseBuffer(block2);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 15,
                memoryBlockEndIndex: 17
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        memoryAllocator.releaseBuffer(block6);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            },
            {
                memoryBlockSize: 3,
                memoryBlockStartIndex: 23,
                memoryBlockEndIndex: 25
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        memoryAllocator.releaseBuffer(block7);
        expectedMemoryStructure = [
            {
                memoryBlockSize: 1,
                memoryBlockStartIndex: 14,
                memoryBlockEndIndex: 14
            }
        ];
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), expectedMemoryStructure);

        memoryAllocator.releaseBuffer(block5);
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), []);
        assert.strictEqual(block5.size, 0);
        assert.strictEqual(block5.startIndex, -1);
        assert.strictEqual(block5.buffer, null);

        memoryAllocator.releaseBuffer(block5);
        assert.deepStrictEqual(memoryAllocator.dumpBufferBlockUsedMemory(), []);
        assert.strictEqual(block5.size, 0);
        assert.strictEqual(block5.startIndex, -1);
        assert.strictEqual(block5.buffer, null);
    });
});