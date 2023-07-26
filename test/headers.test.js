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
const { 
    parseResourceHeaders, getResourceHeaders, 
    getLastModified, getETag, getContentRange, 
    getContentLength 
} = require('../lib/headers');
const { 
    testSetResponseBodyOverride, 
    testHasResponseBodyOverrides
} = require('../lib/fetch');
const {
    createErrorReadable
} = require('./streams');
const nock = require('nock');

function createHeadersMock(headers) {
    return {
        get: name => headers[name]
    };
}

function parse(headers) {
    return parseResourceHeaders(createHeadersMock(headers));
}

describe('headers', function() {
    describe('parsers', function() {
        it("last-modified-none", function() {
            const actual = getLastModified(createHeadersMock({}));
            assert.strictEqual(actual, undefined);
        });
        it("last-modified", function() {
            const actual = getLastModified(createHeadersMock({
                "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT"
            }));
            assert.strictEqual(actual, 1445412480000);
        });
        it("last-modified-invalid", function() {
            const actual = getLastModified(createHeadersMock({
                "last-modified": "invalid date time"
            }));
            assert.strictEqual(actual, undefined);
        });
        it("etag-none", function() {
            const actual = getETag(createHeadersMock({}));
            assert.strictEqual(actual, undefined);
        });
        it("etag", function() {
            const actual = getETag(createHeadersMock({
                "etag": "\"33a64df551425fcc55e4d42a148795d9f25f89d4\""
            }));
            assert.strictEqual(actual, "\"33a64df551425fcc55e4d42a148795d9f25f89d4\"");
        });
        it("weak-etag", function() {
            const actual = getETag(createHeadersMock({
                "etag": "W/\"0815\""
            }));
            assert.strictEqual(actual, undefined);
        });
        it("content-range-none", function() {
            const actual = getETag(createHeadersMock({}));
            assert.strictEqual(actual, undefined);
        });
        it("content-range", function() {
            const actual = getContentRange(createHeadersMock({
                "content-range": "bytes 200-1000/67589"
            }));
            assert.deepStrictEqual(actual, {
                unit: "bytes",
                start: 200,
                end: 1000,
                size: 67589
            });
        });
        it("content-range-invalid", function() {
            const actual = getContentRange(createHeadersMock({
                "content-range": "invalid-range"
            }));
            assert.strictEqual(actual, null);
        });
        it("content-length", function() {
            const actual = getContentLength(createHeadersMock({
                "content-length": "200"
            }));
            assert.strictEqual(actual, 200);
        });
        it("content-length-invalid", function() {
            const actual = getContentLength(createHeadersMock({
                "content-length": "invalid-length"
            }));
            assert.strictEqual(actual, undefined);
        });
    });

    describe('parseResourceHeaders', function() {
        it('content-disposition-none', function() {
            const result = parse({});
            assert.strictEqual(result.filename, undefined);
        });
        it('content-disposition-empty', function() {
            const result = parse({
                'content-disposition': ''
            });
            assert.strictEqual(result.filename, undefined);
        });
        it('content-disposition-filename', function() {
            const result = parse({
                'content-disposition': 'attachment; filename="filename.jpg"'
            });
            assert.strictEqual(result.filename, 'filename.jpg');
        });
        it('content-disposition-unicode', function() {
            const result = parse({
                'content-disposition': 'attachment; filename*=UTF-8\'\'Na%C3%AFve%20file.txt'
            });
            assert.strictEqual(result.filename, 'Naïve file.txt');
        });
        it('content-type-none', function() {
            const result = parse({});
            assert.strictEqual(result.mimetype, 'application/octet-stream');
        });
        it('content-type-empty', function() {
            const result = parse({
                'content-type': ''
            });
            assert.strictEqual(result.mimetype, 'application/octet-stream');
        });
        it('content-type-jpeg', function() {
            const result = parse({
                'content-type': 'image/jpeg'
            });
            assert.strictEqual(result.mimetype, 'image/jpeg');
        });
        it('content-range-none', function() {
            const result = parse({});
            assert.strictEqual(result.size, 0);
        });
        it('content-range-empty', function() {
            const result = parse({
                'content-range': ''
            });
            assert.strictEqual(result.size, 0);
        });
        it('content-range-invalid', function() {
            const result = parse({
                'content-range': 'abc'
            });
            assert.strictEqual(result.size, 0);
        });
        it('content-range-value', function() {
            const result = parse({
                'content-range': 'bytes 0-0/100'
            });
            assert.strictEqual(result.size, 100);
        });
    });

    describe('getResourceHeaders', function() {
        afterEach(async function () {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });
        
        it('head 404 failure', async function() {
            try {
                nock('http://test-headers')
                    .head('/path/to/file.ext')
                    .reply(404);

                await getResourceHeaders('http://test-headers/path/to/file.ext');
                assert.fail('exception expected');
            } catch (e) {
                assert.ok(e.message.includes('HEAD'));
                assert.ok(e.message.includes('failed with status 404'));
            }
        });
        it('invalid content-disposition', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(200, '', {
                    'content-disposition': 'XX invalid value XX'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext');
            assert.deepStrictEqual(result, {
                mimetype: 'application/octet-stream',
                size: 0
            });
        });
        it('invalid content-type', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(200, '', {
                    'content-type': 'XX invalid value XX'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext');
            assert.deepStrictEqual(result, {
                mimetype: 'application/octet-stream',
                size: 0
            });
        });
        it('no headers - head', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(200);

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext');
            assert.deepStrictEqual(result, {
                mimetype: 'application/octet-stream',
                size: 0
            });
        });
        it('headers - head', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(200, '', {
                    'content-disposition': 'attachment; filename="filename.jpg"',
                    'content-length': 200,
                    'content-type': 'image/jpeg'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext');
            assert.deepStrictEqual(result, {
                mimetype: 'image/jpeg',
                size: 200,
                filename: 'filename.jpg'
            });
        });
        it('request headers - head', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .matchHeader('accept', 'application/json')
                .reply(200);

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext', {
                headers: {
                    'accept': 'application/json'
                }
            });
            assert.deepStrictEqual(result, {
                mimetype: 'application/octet-stream',
                size: 0
            });
        });
        it('headers - head - 404 retry', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(404);
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(200, '', {
                    'content-disposition': 'attachment; filename="filename.jpg"',
                    'content-length': 200,
                    'content-type': 'image/jpeg'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext', {
                retryAllErrors: true
            });
            assert.deepStrictEqual(result, {
                mimetype: 'image/jpeg',
                size: 200,
                filename: 'filename.jpg'
            });
        });
        it('headers - head - 503 retry', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(503);
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(200, '', {
                    'content-disposition': 'attachment; filename="filename.jpg"',
                    'content-length': 200,
                    'content-type': 'image/jpeg'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext');
            assert.deepStrictEqual(result, {
                mimetype: 'image/jpeg',
                size: 200,
                filename: 'filename.jpg'
            });
        });
        it('no headers - get', async function() {
            nock('http://test-headers')
                .get('/path/to/file.ext')
                .matchHeader('range', 'bytes=0-0')
                .reply(200);

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext', {
                doGet: true
            });
            assert.deepStrictEqual(result, {
                mimetype: 'application/octet-stream',
                size: 0
            });
        });
        it('headers - get', async function() {
            nock('http://test-headers')
                .get('/path/to/file.ext')
                .matchHeader('range', 'bytes=0-0')
                .reply(200, '', {
                    'content-disposition': 'attachment; filename="filename.jpg"',
                    'content-range': 'bytes 0-0/200',
                    'content-type': 'image/jpeg'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext', {
                doGet: true
            });
            assert.deepStrictEqual(result, {
                mimetype: 'image/jpeg',
                size: 200,
                filename: 'filename.jpg'
            });
        });
        it('request headers - get', async function() {
            nock('http://test-headers')
                .get('/path/to/file.ext')
                .matchHeader('range', 'bytes=0-0')
                .matchHeader('accept', 'application/json')
                .reply(200);

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext', {
                doGet: true,
                headers: {
                    'accept': 'application/json'
                }
            });
            assert.deepStrictEqual(result, {
                mimetype: 'application/octet-stream',
                size: 0
            });
        });
        it('headers - get - 404 retry', async function() {
            nock('http://test-headers')
                .get('/path/to/file.ext')
                .reply(404);
            nock('http://test-headers')
                .get('/path/to/file.ext')
                .reply(200, '', {
                    'content-disposition': 'attachment; filename="filename.jpg"',
                    'content-range': 'bytes 0-0/200',
                    'content-type': 'image/jpeg'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext', {
                doGet: true,
                retryAllErrors: true
            });
            assert.deepStrictEqual(result, {
                mimetype: 'image/jpeg',
                size: 200,
                filename: 'filename.jpg'
            });
        });
        it('headers - get - 503 retry', async function() {
            nock('http://test-headers')
                .get('/path/to/file.ext')
                .reply(503);
            nock('http://test-headers')
                .get('/path/to/file.ext')
                .reply(200, '', {
                    'content-disposition': 'attachment; filename="filename.jpg"',
                    'content-range': 'bytes 0-0/200',
                    'content-type': 'image/jpeg'
                });

            const result = await getResourceHeaders('http://test-headers/path/to/file.ext', {
                doGet: true
            });
            assert.deepStrictEqual(result, {
                mimetype: 'image/jpeg',
                size: 200,
                filename: 'filename.jpg'
            });
        });
        it('headers - stream failure', async function() {
            try {
                nock('http://test-headers')
                    .head('/path/to/file.ext')
                    .reply(200, '', {
                        'content-disposition': 'attachment; filename="filename.jpg"',
                        'content-range': 'bytes 0-0/200',
                        'content-type': 'image/jpeg'
                    });

                testSetResponseBodyOverride("HEAD", createErrorReadable(Error('read failure')));
                await getResourceHeaders('http://test-headers/path/to/file.ext', {
                    retryEnabled: false
                });
                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('HEAD'));
                assert.ok(e.message.includes('response failed'));
                assert.ok(e.message.includes('read failure'));
            }
        });
        it('headers - requestOptions are passed to fetch (used for things like proxy support)', async function() {
            nock('http://test-headers')
                .head('/path/to/file.ext')
                .reply(200, function() {
                    // confirm requestOptions were sent as part of HEAD request
                    assert.strictEqual(this.req.options.agent, 'unit-test-agent');
                });

            const options = {
                requestOptions: {
                    agent: 'unit-test-agent'
                }
            };

            await getResourceHeaders('http://test-headers/path/to/file.ext', options);
        });
        it('headers - empty options do not cause errors', async function() {
            nock('http://test-headers')
                .persist()
                .head('/path/to/file.ext')
                .reply(200);

            // no options object
            await getResourceHeaders('http://test-headers/path/to/file.ext');

            // empty options object
            await getResourceHeaders('http://test-headers/path/to/file.ext', {});

            // empty requestOptions object
            await getResourceHeaders('http://test-headers/path/to/file.ext', { requestOptions: {} });
        });
    });
});
