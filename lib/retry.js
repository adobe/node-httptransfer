/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

"use strict";

const filterObject = require("filter-obj");
const { HttpConnectError, HttpStreamError, HttpResponseError } = require("./error");

const DEFAULT_INTERVAL_MILLIS = 100;
const DEFAULT_MAX_MILLIS = 60000;

/**
 * @typedef {Object} RetryOptions
 * @property {Date} startTime start time using `Date.now()`
 * @property {Number} retryMax time to retry until throwing an error
 * @property {Number} retryInterval time between retries, used by exponential backoff (ms)
 * @property {Boolean} retryAllErrors whether or not to retry on all http error codes or just >=500
 */

 /**
 * Initialize retry options
 * 
 * @param {Object} ]options=] Optional object containing retry options
 * @returns {RetryOptions} Resolved retry options
 */
function retryOptions(options) {
    // only disable when retryEnabled is set to false explicitly
    if (!options || (options.retryEnabled !== false)) {
        return {
            startTime: Date.now(),
            retryMax: (options && options.retryMax) || DEFAULT_MAX_MILLIS,
            retryInterval: (options && options.retryInterval) || DEFAULT_INTERVAL_MILLIS,
            retryAllErrors: (options && options.retryAllErrors) || false
        }
    } else {
        return null;
    }
}

/**
 * Filter out the retry options
 * 
 * @param {Object} options Options  
 * @returns {Object} Filtered options
 */
function filterOptions(options) {
    return options && filterObject(options, key => [
        "retryEnabled",
        "retryMax",
        "retryInterval",
        "retryAllErrors"
    ].indexOf(key) < 0);
}

/**
 * Calculate the retry delay
 * 
 * @param {Number} attempt Attempt count
 * @param {RetryOptions} options Retry options
 * @param {Boolean} [random=true] Add randomness
 */
function retryDelay(attempt, interval, random=true) {
    // 2^attempt * interval + 0-100ms random
    return (2**attempt) * interval + 
        (random ? Math.floor(Math.random() * 100) : 99);
}

/**
 * Check whether a given error requires retry
 * 
 * @param {Number} attempt Attempt count
 * @param {Error} error Error to analyze
 * @param {RetryOptions} options Retry options
 */
function retryOn(attempt, error, options) {
    if (options) {
        const waited = Date.now() - options.startTime;
        const toWait = retryDelay(attempt, options.retryInterval, false) + waited;
        return (toWait < options.retryMax) && (
            (error instanceof HttpConnectError) ||
            (error instanceof HttpStreamError)  ||
            ((error instanceof HttpResponseError) && 
                (options.retryAllErrors || error.status >= 500)
            )
        );
    } else {
        return false;
    }
}

/**
 * Invoke a function with retry one failure support
 * 
 * @param {Function} asyncFunc Asynchronous function to call
 * @param {Object} options Options to pass to asynchronous function
 * @param {RetryOptions} retryOptions Retry options
 */
async function retryInvoke(asyncFunc, options, retryOptions) {
    return new Promise((resolve, reject) => {
        async function invoke(attempt, ms) {
            try {
                if (attempt > 0) {
                    console.error(`Attempting retry ${attempt} after waiting ${ms} milliseconds.`);
                }
                return resolve(await asyncFunc(options));
            } catch (e) {
                if (retryOn(attempt, e, retryOptions)) {
                    const ms = retryDelay(attempt, retryOptions.retryInterval);
                    console.error(`Waiting ${ms} milliseconds to attempt retry ${attempt + 1}, failure: ${e.message}`);
                    setTimeout(invoke, ms, attempt + 1, ms);
                } else {
                    return reject(e);
                }
            }
        }
        setImmediate(invoke, 0, 0);
    });
}

/**
 * Add retry support to the given asynchronous function
 * 
 * @param {Function} asyncFunc Asynchronous function
 * @returns Asynchronous function with retry support
 */
async function retry(asyncFunc, options) {
    const retry = retryOptions(options);
    options = filterOptions(options);
    return retryInvoke(asyncFunc, options, retry);
}

module.exports = {
    retry
}
