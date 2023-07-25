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

/* eslint-env mocha */

'use strict';

const nock = require('nock');
const assert = require('assert');
const { getCSRFToken } = require('../lib/csrf');

describe('csrf', function () {
    beforeEach(async function () {
        nock.cleanAll();
    });

    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it('success', async function () {
        nock('http://test')
            .get('/libs/granite/csrf/token.json')
            .reply(200, '{ "token": "test-csrf-token" }');

        const token = await getCSRFToken("http://test");
        assert.strictEqual(token, 'test-csrf-token');
    });

    it('throw expected error', async function () {
        nock('http://test')
            .get('/libs/granite/csrf/token.json')
            .reply(400, '');

        await assert.rejects(getCSRFToken("http://test"), err => {
            assert.strictEqual(err.message,
                `Fail to get CSRF token with err Error: GET 'http://test/libs/granite/csrf/token.json' failed with status 400`);
            return true;
        });
    });

    it('throw expected error with 2xx response other than 200', async function () {
        nock('http://test')
            .get('/libs/granite/csrf/token.json')
            .reply(201, '');
        
        await assert.rejects(getCSRFToken("http://test"), err => {
            assert.strictEqual(err.message,
                `Fail to get CSRF token with err Error: Bad response from server 201`);
            return true;
        });
    });

    it('confirm requestOptions are passed on to fetch', async function () {
        nock('http://test')
            .get('/libs/granite/csrf/token.json')
            .reply(200, function () {
                assert.strictEqual(this.req.options.agent, 'test');
                return { token: "test-csrf-token" };
            });

        const csrfOptions = {
            requestOptions: {
                agent: 'test'
            }
        };

        await getCSRFToken("http://test", csrfOptions);
    });

    it('confirm an empty requestOptions does not cause errors', async function () {
        nock('http://test')
            .get('/libs/granite/csrf/token.json')
            .reply(200, '{ "token": "test-csrf-token" }')
            .persist();

        await getCSRFToken("http://test");
        await getCSRFToken("http://test", {});
        await getCSRFToken("http://test", { requestOptions: false });
        await getCSRFToken("http://test", { requestOptions: {} });
    });
});