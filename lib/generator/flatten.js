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

"use strict";

/**
 * Check if the given value is (async) iterable
 * 
 * @param {*} value Object to check
 * @returns True if value is iterable or async-iterable
 */
function isIterable(value) {
    const o = Object(value);
    return (Symbol.iterator in o) || (Symbol.asyncIterator in o);
}

async function* flatten_nested(input, depth, maxDepth) {
    if (depth > maxDepth) {
        yield* input;
    } else {
        for await (const i of input) {
            if (isIterable(i)) {
                yield* flatten_nested(i, depth+1, maxDepth);
            } else {
                yield i;
            }
        }
    }
}

/**
 * Async generator that flattens recursively up to the specified depth until
 * the generated values are not longer (async) iterable
 * 
 * @generator 
 * @param {*} input 
 * @param {*} [maxDepth=1]
 */
async function* flatten(input, maxDepth) {
    maxDepth = Math.max(maxDepth || 1, 0);
    yield* flatten_nested(input, 0, maxDepth);
}

module.exports = {
    flatten
};
