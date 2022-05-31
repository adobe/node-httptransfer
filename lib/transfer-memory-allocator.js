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

"use strict";

console.log('### TMN - WIP:')

/**
 * Represents a memory block used as buffer for a file transfer
 */
class TransferMemoryBlock {
    /**
     * Construct a memory block used as buffer for a (file) transfer
     */
    constructor() {
        this[PRIVATE] = {};
    }
}

/**
 * Keeps track of memory usable for transfers, and allocates available 
 * memory as needed/when requested by transfers
 */
class TransferMemoryBuffer {
    constructor() {
        this[PRIVATE] = {};
    }
}

module.exports = {
    TransferMemoryBlock,
    TransferMemoryBuffer
};