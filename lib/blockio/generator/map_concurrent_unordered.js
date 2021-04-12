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
 * @typedef {object} MapConcurrentOptions
 * @property {number} [max_concurrent=1] Maximum of items concurrently 
 */

/**
 * Returns a promise that fulfills or rejects as soon as one of the promises in the 
 * set fulfills or rejects.
 * 
 * Once a promise fulfills, it will be automatically removed from the set of pending promises.
 * 
 * @param {Set} pending Set of pending promises
 * @returns Promise that fulfills or rejects as soon as one of the given promises settles 
 */
async function race(pending) {
    // Ensure the original pending promise is returned with the value, so we know
    // which promise to delete from the pending set.
    const { promise, value } = await Promise.race(Array.from(pending, promise =>
        Promise.resolve(promise).then(value => {
            return { promise, value };
        })
    ));

    if (!pending.delete(promise)) {
        throw Error(`[internal] Promise ${promise} -> ${value} not in pending state`);
    }

    return value;
}

/**
 * Map the items out of input concurrently while keeping the results in the same order
 * 
 * Prefers to invoke the provided function on items received from the input generator 
 * to ensure concurrent execution. This works well when the items provided by the input 
 * generator can be provided quickly.
 * 
 * If input generator is slower than the receiver accepting the yielded items, an alternative 
 * may be considered to prefer yielding finished results as soon as they become available.
 * 
 * Yielding items without waiting for a receiver to accept them should not be done, because it 
 * will result in an unbounded number of pending items. 
 * 
 * The overall intent is to ensure we accommodate back pressure from the receiver and have a fixed
 * upper limit on the amount of items in flight.
 * 
 * @generator
 * @param {*} input 
 * @param {*} func 
 * @param {MapConcurrentOptions} [options] Options 
 * @yields {*} result from func in the same order as the input
 */
async function* map_concurrent_unordered(input, func, options) {
    const max_concurrent = (options && options.max_concurrent) || 1;
    if (max_concurrent < 1) {
        throw Error(`max_concurrent is invalid: ${max_concurrent}`);
    }

    const pending = new Set();

    // invoke func on each element until it hit the max concurrency limit
    // at that point wait for the first one that settles
    for await (const i of input) {
        pending.add(func(i));

        while (pending.size >= max_concurrent) {
            yield await race(pending);
        }    
    }

    // handle remainder
    while (pending.size > 0) {
        yield await race(pending);
    }
}

module.exports = {
    map_concurrent_unordered
};
