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
const retryOptions = rewireRetry.__get__("retryOptions");
const filterOptions = rewireRetry.__get__("filterOptions");

function assertStartTime(options) {
    const now = Date.now();
    assert.ok((now - options.startTime) < 100, `startTime: ${options.startTime}, now: ${now}`);
}

describe("retry", function() {
    describe("retryDelay", function() {
        it("attempt-0", function() {
            const ms = retryDelay(0, 100);
            assert.ok(ms >= 100 && ms < 200, ms);
        })
        it("attempt-1", function() {
            const ms = retryDelay(1, 100);
            assert.ok(ms >= 200 && ms < 300, ms);
        })
        it("attempt-2", function() {
            const ms = retryDelay(2, 100);
            assert.ok(ms >= 400 && ms < 500, ms);
        })
        it("attempt-3", function() {
            const ms = retryDelay(3, 100);
            assert.ok(ms >= 800 && ms < 900, ms);
        })
        it("attempt-4-400", function() {
            const ms = retryDelay(4, 400);
            assert.ok(ms >= 6400 && ms < 6500, ms);
        })        
    })
    describe("retryOn", function() {
        it("connect-error", function() {
            // retry on connect error
            assert.ok(retryOn(0, new HttpConnectError("GET", "url", "message"), {
                startTime: Date.now(),
                retryMax: 60000,
                retryInterval: 100,
            }));
        })
        it("connect-error-timeout", function() {
            // reached max time on retry
            const startTime = Date.now() - 60000;
            assert.ok(!retryOn(0, new HttpConnectError("GET", "url", "message"), {
                startTime,
                retryMax: 60000,
                retryInterval: 100,
            }));
        })
        it("response-error-500", function() {
            // retry on >= 500 status with transfer error
            assert.ok(retryOn(0, new HttpResponseError("GET", "url", 500, "message"), {
                startTime: Date.now(),
                retryMax: 60000,
                retryInterval: 100,
            }));
        })
        it("response-error-404", function() {
            // do not retry < 500 status errors
            assert.ok(!retryOn(0, new HttpResponseError("GET", "url", 404, "message"), {
                startTime: Date.now(),
                retryMax: 60000,
                retryInterval: 100,
            }));
        })
        it("response-error-404-allerror", function() {
            // retry all failures
            assert.ok(retryOn(0, new HttpResponseError("GET", "url", 404, "message"), {
                startTime: Date.now(),
                retryMax: 60000,
                retryInterval: 100,
                retryAllErrors: true
            }));
        })
    })
    describe("retryOptions", function() {
        it("none", function() {
            const options = retryOptions();
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMax: 60000,
                retryInterval: 100,
                retryAllErrors: false
            });
        })
        it("empty", function() {
            const options = retryOptions({});
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMax: 60000,
                retryInterval: 100,
                retryAllErrors: false
            });
        })
        it("disabled", function() {
            const options = retryOptions({
                retryEnabled: false
            });
            assert.ok(!options, options);
        })
        it("all-errors", function() {
            const options = retryOptions({
                retryAllErrors: true
            });
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMax: 60000,
                retryInterval: 100,
                retryAllErrors: true
            });
        })
        it("retryMax", function() {
            const options = retryOptions({
                retryMax: 40000
            });
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMax: 40000,
                retryInterval: 100,
                retryAllErrors: false
            });
        })
        it("retryInterval", function() {
            const options = retryOptions({
                retryInterval: 400
            });
            assertStartTime(options);
            assert.deepStrictEqual(options, {
                startTime: options.startTime,
                retryMax: 60000,
                retryInterval: 400,
                retryAllErrors: false
            });
        })
    })
    describe("filterOptions", function() {
        it("none", function() {
            const args = filterOptions();
            assert.strictEqual(args, undefined);
        })
        it("empty", function() {
            const args = filterOptions({});
            assert.deepStrictEqual(args, {});
        })
        it("filter", function() {
            const args = filterOptions({
                arg1: "arg1",
                retryEnabled: true,
                retryMax: 1000,
                retryInterval: 100
            });
            assert.deepStrictEqual(args, {
                arg1: "arg1"
            });
        })
    })
    describe("retry", function() {
        it("empty", async function() {
            const result = await retry(async () => 1);
            assert.strictEqual(result, 1);
        })
        it("options", async function() {
            const result = await retry(async options => options, {
                myOption: 123,
                retryAllErrors: true,
                retryMax: 76000,
                retryInterval: 250
            });
            assert.deepStrictEqual(result, {
                myOption: 123
            });
        })
        it("no-retry-generic-error", async function() {
            try {
                let attempt = 0;
                await retry(async () => {
                    if (attempt === 0) {
                        ++attempt;
                        throw Error("message");
                    }
                    return 1;
                });
                assert.fail("not expected to succeed")
            } catch (e) {
                assert.strictEqual(e.message, "message");
            }
        })
        it("fail-once-retry-connect", async function() {
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
        it("fail-second-retry-connect", async function() {
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
        it("fail-once-noretry-stream", async function() {
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

                assert.fail("not expected to succeed")
            } catch (e) {
                assert.strictEqual(e.message, "GET 'url' stream 200 response failed: message");
            }
        })
        it("fail-once-retry-stream", async function() {
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
        it("fail-second-retry-stream", async function() {
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
        it("fail-once-noretry-response", async function() {
            try {
                let attempt = 0;
                await retry(async () => {
                    if (attempt === 0) {
                        ++attempt;
                        throw new HttpResponseError("GET", "url", 404, "message");
                    }
                    return 1;
                });
                assert.fail("not expected to succeed")
            } catch (e) {
                assert.strictEqual(e.message, "GET 'url' failed with status 404: message");
            }
        })
        it("fail-once-retry-response", async function() {
            try {
                let attempt = 0;
                await retry(async () => {
                    if (attempt === 0) {
                        ++attempt;
                        throw new HttpResponseError("GET", "url", 404, "message");
                    }
                    return 1;
                });
                assert.fail("not expected to succeed")
            } catch (e) {
                assert.strictEqual(e.message, "GET 'url' failed with status 404: message");
            }
        }, {
            retryAllErrors: true
        })
    })
})
