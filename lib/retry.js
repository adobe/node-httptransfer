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

// introduced env var to support sharing config with other libs
const DEFAULT_INITIAL_WAIT_MS = process.env.DEFAULT_INITIAL_WAIT_MS || 100; // in custom implementation
const DEFAULT_MAX_MS_TO_TRY = process.env.DEFAULT_MAX_MS_TO_TRY || 60000; // in custom implementation
const DEFAULT_BACKOFF = process.env.DEFAULT_BACKOFF || 2.0; // adding backoff
const DEFAULT_MS_SOCKET_TIMEOUT = process.env.DEFAULT_MS_SOCKET_TIMEOUT || 60000; // socket timeout

/**
 * @typedef {Object} RetryOptions
 * @property {Date} startTime start time using `Date.now()`
 * @property {Number} retryMaxDuration time to retry until throwing an error
 * @property {Number} retryInitialDelay time between retries, used by exponential backoff (ms)
 * @property {Boolean} retryAllErrors whether or not to retry on all http error codes or just >=500
 */

/**
* Initialize retry options
* 
* @param {Object} ]options=] Optional object containing retry options
* @returns {RetryOptions} Resolved retry options
*/
function retryInit(options={}) {
    // only disable when retryEnabled is set to false explicitly
    if (!options || (options.retryEnabled !== false)) {
        const retryMaxDuration = options.retryMaxDuration || DEFAULT_MAX_MS_TO_TRY;

        let timeoutValue = options.timeout || DEFAULT_MS_SOCKET_TIMEOUT;
        if (timeoutValue > retryMaxDuration) {
            timeoutValue = retryMaxDuration;
        }

        return {
            startTime: Date.now(),
            retryMaxDuration: retryMaxDuration,
            retryInitialDelay: options.retryInitialDelay || DEFAULT_INITIAL_WAIT_MS,
            retryBackoff: options.retryBackoff || DEFAULT_BACKOFF,
            retryAllErrors: options.retryAllErrors || false,
            timeout: timeoutValue,
        };
    } else {
        return null;
    }
}

/**
 * Filter out the retry options
 * 
 * @param {Object} options Options  
 * @returns {Object} Filtered options (without retryOptions)
 */
function filterOptions(options) {
    return options && filterObject(options, key => [
        "retryEnabled",
        "retryMaxDuration",
        "retryInitialDelay",
        "retryAllErrors",
        "retryBackoff"
    ].indexOf(key) < 0);
}

/**
 * Calculate the retry delay
 * 
 * @param {Integer} interval Min time to wait for retry
 * @param {Boolean} [random=true] Add randomness
 */
function retryDelay(interval, random = true) {
    return interval +
        (random ? Math.floor(Math.random() * 100) : 99);
}

/**
 * Check whether a given error requires retry
 * 
 * @param {Error} error Error to analyze
 * @param {RetryOptions} options Retry options
 */
function retryOn(error, options) {
    if (options) {
        const waited = Date.now() - options.startTime;
        const toWait = retryDelay(options.retryInitialDelay) + waited;
        return (toWait < options.retryMaxDuration) && (
            (error instanceof HttpConnectError) ||
            (error instanceof HttpStreamError) ||
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
 * @param {RetryOptions} retryOpts Retry options
 */
async function retryInvoke(asyncFunc, options, retryOpts) {
    return new Promise((resolve, reject) => {
        async function invoke(attempt, ms) {
            try {
                if (attempt > 0) {
                    console.error(`Attempting retry ${attempt} after waiting ${ms} milliseconds.`);
                }
                return resolve(await asyncFunc(options));
            } catch (e) {
                if (retryOn(e, retryOpts)) {
                    retryOpts.retryInitialDelay *= retryOpts.retryBackoff; // update retry interval using backoff

                    const ms = retryDelay(retryOpts.retryInitialDelay);
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
    const retryOpts = retryInit(options || {});
    options = filterOptions(options); // remove retry options from options passed to actual fetch
    return retryInvoke(asyncFunc, options, retryOpts);
}

module.exports = {
    retry
}
