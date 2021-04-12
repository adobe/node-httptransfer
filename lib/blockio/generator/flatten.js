/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2021 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/

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
