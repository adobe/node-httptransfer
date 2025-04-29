/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

'use strict';

/**
 * Simple Blob mock for Node.js tests that doesn't rely on browser-specific APIs
 */
class BlobMock {
    constructor(parts, options = {}) {
        this.parts = parts || [];
        this.type = options.type || '';
        this.size = 0;
        
        // Calculate size by summing all parts
        this.parts.forEach(part => {
            if (typeof part === 'string') {
                this.size += Buffer.from(part).length;
            } else if (part instanceof Buffer) {
                this.size += part.length;
            } else if (part instanceof ArrayBuffer) {
                this.size += part.byteLength;
            } else if (part instanceof BlobMock) {
                this.size += part.size;
            }
        });
    }

    slice(start, end) {
        // Simple mock of slice that returns a new BlobMock with adjusted size
        const newBlob = new BlobMock([], { type: this.type });
        const sliceSize = (end || this.size) - (start || 0);
        newBlob.size = Math.max(0, sliceSize);
        return newBlob;
    }
}

module.exports = {
    Blob: BlobMock
}; 