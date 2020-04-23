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

/* eslint-env mocha */

"use strict";

const assert = require("assert");
const rewire = require("rewire");

const { HttpConnectError, HttpStreamError, HttpResponseError } = require("../lib/error");
const { retry } = require("../lib/retry");
const rewireRetry = rewire("../lib/retry.js");
const retryDelay = rewireRetry.__get__("retryDelay");
const retryOn = rewireRetry.__get__("retryOn");
const retryInit = rewireRetry.__get__("retryInit");
const filterOptions = rewireRetry.__get__("filterOptions");

function assertStartTime(options) {
    const now = Date.now();
    assert.ok((now - options.startTime) < 100, `startTime: ${options.startTime}, now: ${now}`);
}

describe("retry", function () {
    describe("retryDelay", function () {
        it("attempts with default interval value", function () {
            const ms = retryDelay(100);
            assert.ok(ms >= 100 && ms < 201, ms);
        })

        it("attempt starting with custom interval value", function () {
            const ms = retryDelay(164);
            assert.ok(ms >= 164 && ms < 265, ms);
        })
    })
    describe("retryOn", function () {
        it("connect-error", function () {
            // retry on connect error
            const retryObj = retryOn(new HttpConnectError("GET", "url", "message"), {
                startTime: Date.now(),
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
            });
            assert.ok(retryObj);
        })
        it("connect-error-timeout", function () {
            // reached max time on retry
            const startTime = Date.now() - 60000;
            assert.ok(!retryOn(new HttpConnectError("GET", "url", "message"), {
                startTime,
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
            }));
        })
        it("response-error-500", function () {
            // retry on >= 500 status with transfer error
            assert.ok(retryOn(new HttpResponseError("GET", "url", 500, "message"), {
                startTime: Date.now(),
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
            }));
        })
        it("response-error-404", function () {
            // do not retry < 500 status errors
            assert.ok(!retryOn(new HttpResponseError("GET", "url", 404, "message"), {
                startTime: Date.now(),
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
            }));
        })
        it("response-error-404-allerror", function () {
            // retry all failures
            assert.ok(retryOn(new HttpResponseError("GET", "url", 404, "message"), {
                startTime: Date.now(),
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
                retryAllErrors: true
            }));
        })
    })
    describe("retryInit", function () {
        this.beforeEach( () => {
            delete process.env.__OW_ACTION_DEADLINE;
        })
        it("none", function () {
            const options = retryInit();
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
                retryAllErrors: false,
                retryBackoff: 2,
                timeout: 30000
            });
        })
        it("empty", function () {
            const options = retryInit({});
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
                retryAllErrors: false,
                retryBackoff: 2,
                timeout: 30000
            });
        })
        it("disabled", function () {
            const options = retryInit({
                retryEnabled: false
            });
            assert.ok(!options, options);
        })
        it("all-errors", function () {
            const options = retryInit({
                retryAllErrors: true
            });
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
                retryAllErrors: true,
                retryBackoff: 2,
                timeout: 30000
            });
        })
        it("retryMaxDuration", function () {
            const options = retryInit({
                retryMaxDuration: 40000
            });
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMaxDuration: 40000,
                retryInitialDelay: 100,
                retryAllErrors: false,
                retryBackoff: 2,
                timeout: 30000
            });
        })
        it("retryMaxDuration will surpass action timeout", function () {
            process.env.__OW_ACTION_DEADLINE = Date.now() + 2000;
            const options = retryInit();
            assertStartTime(options);
            assert.ok(options.retryMaxDuration < 3000, options.retryMaxDuration > 0);
            assert.strictEqual(options.retryInitialDelay, 100);
            assert.strictEqual(options.retryBackoff, 2);
            assert.strictEqual(options.retryAllErrors, false);
            assert.strictEqual(options.timeout, options.retryMaxDuration * 0.5);
        })
        it("socketTimeout is greater than retryMaxDuration", function () {
            const options = retryInit({
                socketTimeout: 70000
            });
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMaxDuration: 60000,
                retryInitialDelay: 100,
                retryAllErrors: false,
                retryBackoff: 2,
                timeout: 30000
            });
        })
        it("retryInitialDelay", function () {
            const options = retryInit({
                retryInitialDelay: 400
            });
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMaxDuration: 60000,
                retryInitialDelay: 400,
                retryAllErrors: false,
                retryBackoff: 2,
                timeout: 30000
            });
        })
    })
    describe("filterOptions", function () {
        it("none", function () {
            const args = filterOptions();
            assert.strictEqual(args, undefined);
        })
        it("empty", function () {
            const args = filterOptions({});
            assert.deepStrictEqual(args, {});
        })
        it("filter", function () {
            const args = filterOptions({
                arg1: "arg1",
                retryEnabled: true,
                retryMaxDuration: 1000,
                retryInitialDelay: 100,
                timeout: 60000
            });
            assert.deepStrictEqual(args, {
                arg1: "arg1",
                timeout: 60000
            });
        })
    })
    describe("retry", function () {
        it("empty", async function () {
            const result = await retry(async () => 1);
            assert.strictEqual(result, 1);
        })
        it("options", async function () {
            const result = await retry(async options => options, {
                myOption: 123,
                retryAllErrors: true,
                retryMaxDuration: 76000,
                retryInitialDelay: 250
            });
            assert.deepStrictEqual(result, {
                myOption: 123
            });
        })
        it("no-retry-generic-error", async function () {
            try {
                let attempt = 0;
                await retry(async () => {
                    if (attempt === 0) {
                        ++attempt;
                        throw Error("message");
                    }
                    return 1;
                });
                assert.fail("not expected to succeed");
            } catch (e) {
                assert.strictEqual(e.message, "message");
            }
        })
        it("fail-once-retry-connect", async function () {
            let attempt = 0;
            const result = await retry(async () => {
                if (attempt === 0) {
                    ++attempt;
                    throw new HttpConnectError("GET", "url", "message");
                }
                return 1;
            });
            assert.strictEqual(result, 1);
        })
        it("fail-second-retry-connect", async function () {
            let attempt = 0;
            const result = await retry(async () => {
                if (attempt < 2) {
                    ++attempt;
                    throw new HttpConnectError("GET", "url", "message");
                }
                return 1;
            });
            assert.strictEqual(result, 1);
        })
        it("fail-once-noretry-stream", async function () {
            try {
                let attempt = 0;
                await retry(async () => {
                    if (attempt === 0) {
                        ++attempt;
                        throw new HttpStreamError("GET", "url", 200, "message");
                    }
                    return 1;
                }, {
                    retryEnabled: false
                });

                assert.fail("not expected to succeed");
            } catch (e) {
                assert.strictEqual(e.message, "GET 'url' stream 200 response failed: message");
            }
        })
        it("fail-once-retry-stream", async function () {
            let attempt = 0;
            const result = await retry(async () => {
                if (attempt === 0) {
                    ++attempt;
                    throw new HttpStreamError("GET", "url", 200, "message");
                }
                return 1;
            });
            assert.strictEqual(result, 1);
        })
        it("fail-second-retry-stream", async function () {
            let attempt = 0;
            const result = await retry(async () => {
                if (attempt < 2) {
                    ++attempt;
                    throw new HttpStreamError("GET", "url", 200, "message");
                }
                return 1;
            });
            assert.strictEqual(result, 1);
        })
        it("fail-once-noretry-response", async function () {
            try {
                let attempt = 0;
                await retry(async () => {
                    if (attempt === 0) {
                        ++attempt;
                        throw new HttpResponseError("GET", "url", 404, "message");
                    }
                    return 1;
                });
                assert.fail("not expected to succeed");
            } catch (e) {
                assert.strictEqual(e.message, "GET 'url' failed with status 404: message");
            }
        })
        it("fail-once-retry-response", async function () {
            try {
                let attempt = 0;
                await retry(async () => {
                    if (attempt === 0) {
                        ++attempt;
                        throw new HttpResponseError("GET", "url", 404, "message");
                    }
                    return 1;
                });
                assert.fail("not expected to succeed");
            } catch (e) {
                assert.strictEqual(e.message, "GET 'url' failed with status 404: message");
            }
        }, {
            retryAllErrors: true
        })

        it("fail-till-max-retry", async function () {
            let attempt = 0;
            const start = Date.now();
            const retryMax = 1500;
            const buffer = 200; // buffer to finish calls if backoff is too large

            try {
                await retry(async () => {
                    attempt++;
                    console.log("Attempt:", attempt);
                    throw new HttpResponseError("GET", "url", 200, "message");
                }, {
                    retryMaxDuration: retryMax,
                    retryAllErrors: true
                });
                assert.fail('Should have failed');
            } catch (e) {
                console.log(e);
                const duration = Date.now() - start;
                assert.ok(attempt === 4); // will always fail at 4th attempt with new rules
                assert.ok(duration <= retryMax + buffer);
            }
        })
    })
})
