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

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const nock = require('nock');
const { postForm } = require('../lib/fetch');
const tough = require('tough-cookie');

describe('fetch', function() {
    afterEach(async function() {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });
    describe('postForm', function () {
        it('simple', async function() {
            const expectedResponse = {
                ok: 123
            };
    
            nock('http://post-form-test')
                .post('/path', 'name=value')
                .reply(200, JSON.stringify(expectedResponse), {
                    'content-type': 'application/json'
                });
    
            const form = new URLSearchParams();
            form.append("name", "value");
    
            const cookieJar = new tough.CookieJar();
            const result = await postForm("http://post-form-test/path", form, cookieJar);
            assert.deepStrictEqual(result, expectedResponse);
        });
        it('timeout-option', async function() {
            nock('http://post-form-test')
                .post('/path', 'name=value')
                .delayConnection(500)
                .reply(200, JSON.stringify({}), {
                    'content-type': 'application/json'
                });
    
            const form = new URLSearchParams();
            form.append("name", "value");
  
            try {
                const cookieJar = new tough.CookieJar();
                await postForm("http://post-form-test/path", form, cookieJar, {
                    timeout: 100
                });
                assert.ok(false, 'Post form expected to fail with timeout error');
            } catch (e) {
                assert.strictEqual(e.message, 'POST \'http://post-form-test/path\' connect failed: network timeout at: http://post-form-test/path');
            }
        });
        it('header-override', async function() {
            const expectedResponse = {
                ok: 123
            };
    
            nock('http://post-form-test', {
                reqheaders: {
                    authorization: 'Basic 123'
                }
            })
                .post('/path', 'name=value')
                .reply(200, JSON.stringify(expectedResponse), {
                    'content-type': 'application/json'
                });
    
            const form = new URLSearchParams();
            form.append("name", "value");
    
            const cookieJar = new tough.CookieJar();
            const result = await postForm("http://post-form-test/path", form, cookieJar, {
                headers: {
                    authorization: 'Basic 123'
                }
            });
            assert.deepStrictEqual(result, expectedResponse);
        });
        it('cookie-test', async function() {
            const cookieJar = new tough.CookieJar();
            const form = new URLSearchParams();
            form.append("name", "value");

            // invoke first post, make sure the cookie is set
            nock('http://post-form-test')
                .post('/path', 'name=value')
                .reply(200, JSON.stringify({}), {
                    'content-type': 'application/json',
                    'set-cookie': 'id=a3fWa; Max-Age=2592000'
                });
            const result1 = await postForm("http://post-form-test/path", form, cookieJar);
            assert.deepStrictEqual(result1, {});
            for (const cookie of await cookieJar.getCookies('http://post-form-test')) {
                assert.strictEqual(cookie.domain, 'post-form-test');
                assert.strictEqual(cookie.key, 'id');
                assert.strictEqual(cookie.value, 'a3fWa');
            }

            // invoke second post, make sure the cookie is returned to the server
            nock('http://post-form-test', {
                reqheaders: {
                    cookie: 'id=a3fWa'
                }
            })
                .post('/path', 'name=value')
                .reply(200, JSON.stringify({}), {
                    'content-type': 'application/json'
                });
            const result2 = await postForm("http://post-form-test/path", form, cookieJar);
            assert.deepStrictEqual(result2, {});
        });
        it('cookie-auth-test', async function() {
            // make sure the authorization header is passed through together with the cookie
            const cookieJar = new tough.CookieJar();
            const form = new URLSearchParams();
            form.append("name", "value");

            // invoke first post, make sure the cookie is set
            nock('http://post-form-test', {
                reqheaders: {
                    authorization: 'Basic 123',
                }
            })
                .post('/path', 'name=value')
                .reply(200, JSON.stringify({}), {
                    'content-type': 'application/json',
                    'set-cookie': 'id=a3fWa; Max-Age=2592000'
                });
            const result1 = await postForm("http://post-form-test/path", form, cookieJar, {
                headers: {
                    authorization: 'Basic 123'
                }
            });
            assert.deepStrictEqual(result1, {});
            for (const cookie of await cookieJar.getCookies('http://post-form-test')) {
                assert.strictEqual(cookie.domain, 'post-form-test');
                assert.strictEqual(cookie.key, 'id');
                assert.strictEqual(cookie.value, 'a3fWa');
            }

            // invoke second post, make sure the cookie is returned to the server
            nock('http://post-form-test', {
                reqheaders: {
                    authorization: 'Basic 123',
                    cookie: 'id=a3fWa'
                }
            })
                .post('/path', 'name=value')
                .reply(200, JSON.stringify({}), {
                    'content-type': 'application/json'
                });
            const result2 = await postForm("http://post-form-test/path", form, cookieJar, {
                headers: {
                    authorization: 'Basic 123'
                }
            });
            assert.deepStrictEqual(result2, {});
        });
    
    });
});
