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

'use strict';

const assert = require('assert');
const fs = require('fs').promises;
const nock = require('nock');
const { downloadFile, uploadFile } = require('../lib/file');
const { testSetResponseBodyOverride, testHasResponseBodyOverrides } = require('../lib/fetch');
const { createErrorReadable } = require('./streams');

describe('file', function() {
    describe('download', function() {
        afterEach(async function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
            try {
                await fs.unlink('test-transfer-file.dat');
            } catch (e) {
                // don't fail if the file doesn't exist, it's only done to clean up
                // after ourselves
                console.log(e);
            }
        })
        it('status-200', async function() {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-200/path/to/file.ext', 'test-transfer-file.dat');
            const result = await fs.readFile('test-transfer-file.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
        })
        it('status-200-mkdir', async function() {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-200/path/to/file.ext', '.testdir/test-transfer-file.dat', {
                mkdirs: true
            });
            const result = await fs.readFile('.testdir/test-transfer-file.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
            await fs.unlink('.testdir/test-transfer-file.dat');
            await fs.rmdir('.testdir');
        })
        it('status-200-truncate-retry', async function() {
            nock('http://test-status-200-truncate-retry')
                .get('/path/to/file.ext')
                .reply(200, 'hello world', {
                    'content-length': 5
                });

            nock('http://test-status-200-truncate-retry')
                .get('/path/to/file.ext')
                .reply(200, 'hello world', {
                    'content-length': 11
                });

            await downloadFile('http://test-status-200-truncate-retry/path/to/file.ext', 'test-transfer-file.dat');
            const result = await fs.readFile('test-transfer-file.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
        })
        it('status-200-stream-retry', async function() {
            nock('http://test-status-200-stream-retry')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            nock('http://test-status-200-stream-retry')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            testSetResponseBodyOverride("GET", createErrorReadable(Error('read error')));
            await downloadFile('http://test-status-200-stream-retry/path/to/file.ext', 'test-transfer-file.dat');
            const result = await fs.readFile('test-transfer-file.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
        })
        it('status-404', async function() {
            try {
                nock('http://test-status-404')
                    .get('/path/to/file.ext')
                    .reply(404, 'hello world');

                await downloadFile('http://test-status-404/path/to/file.ext', 'test-transfer-file.dat');
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-status-404/path/to/file.ext\' failed with status 404');
                const result = await fs.readFile('test-transfer-file.dat', 'utf8');
                assert.strictEqual(result, '');
            }
        })
        it('status-404-retry', async function() {
            nock('http://test-status-404')
                .get('/path/to/file.ext')
                .reply(404);

            nock('http://test-status-404')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-404/path/to/file.ext', 'test-transfer-file.dat', {
                retryAllErrors: true
            });
            const result = await fs.readFile('test-transfer-file.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
        })
        it('status-404-stream-retry', async function() {
            try {
                nock('http://test-status-404-stream-retry')
                    .get('/path/to/file.ext')
                    .reply(404, 'hello world', {
                        'content-type': 'text/plain'
                    });

                nock('http://test-status-404-stream-retry')
                    .get('/path/to/file.ext')
                    .reply(404, 'hello world', {
                        'content-type': 'text/plain'
                    });

                testSetResponseBodyOverride("GET", createErrorReadable(Error('read error')));
                await downloadFile('http://test-status-404-stream-retry/path/to/file.ext', 'test-transfer-file.dat');
                assert.fail('failure expected');
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-status-404-stream-retry/path/to/file.ext\' failed with status 404: hello world');
            }
        })
        it('status-503-retry', async function() {
            nock('http://test-status-503')
                .get('/path/to/file.ext')
                .reply(503);

            nock('http://test-status-503')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-503/path/to/file.ext', 'test-transfer-file.dat');
            const result = await fs.readFile('test-transfer-file.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
        })
        it('timeout-retry', async function() {
            nock('http://test-status-timeout')
                .get('/path/to/file.ext')
                .delayConnection(500)
                .reply(200, 'hello world');

            nock('http://test-status-timeout')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-timeout/path/to/file.ext', 'test-transfer-file.dat', {
                timeout: 200
            });
            const result = await fs.readFile('test-transfer-file.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
        })
        it('badhost-retry-failure (1)', async function() {
            const start = Date.now();
            try {
                await downloadFile('http://badhost/path/to/file.ext', 'test-transfer-file.dat', {
                    retryMaxDuration: 1000
                });
                assert.fail('failure expected')
            } catch (e) {
                // expect elapsed to be at least 500ms, since less than that a 3rd
                // retry would fit (400ms-500ms wait).
                const elapsed = Date.now() - start;
                assert.ok(elapsed >= 500, `elapsed time: ${elapsed}`);
                assert.ok(e.message.startsWith('GET \'http://badhost/path/to/file.ext\' connect failed: request to http://badhost/path/to/file.ext failed, reason: getaddrinfo ENOTFOUND badhost'));
            }
        })
    })
    describe('upload', function() {
        beforeEach(async function() {
            await fs.writeFile('test-transfer-file.dat', 'hello world 123', 'utf8');
        })
        afterEach(async function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
            try {
                await fs.unlink('test-transfer-file.dat');
            } catch (e) {
                // don't fail if the file doesn't exist, it's only done to clean up
                // after ourselves
                console.log(e);
            }
        })
        it('status-201', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await uploadFile('test-transfer-file.dat', 'http://test-status-201/path/to/file.ext');
        })
        it('status-201-header', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await uploadFile('test-transfer-file.dat', 'http://test-status-201/path/to/file.ext', {
                headers: {
                    'content-type': 'image/jpeg'
                }
            });
        })
        it('status-404', async function() {
            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404);

            try {
                await uploadFile('test-transfer-file.dat', 'http://test-status-404/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-status-404/path/to/file.ext\' failed with status 404');
            }
        })
        it('status-404-retry', async function() {
            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404);

            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await uploadFile('test-transfer-file.dat', 'http://test-status-404/path/to/file.ext', {
                retryAllErrors: true
            });
        })
        it('status-503-retry', async function() {
            nock('http://test-status-503')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(503);

            nock('http://test-status-503')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await uploadFile('test-transfer-file.dat', 'http://test-status-503/path/to/file.ext');
        })
        it('timeout-retry', async function() {
            nock('http://test-status-timeout')
                .put('/path/to/file.ext', 'hello world 123')
                .delayConnection(500)
                .reply(201);

            nock('http://test-status-timeout')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await uploadFile('test-transfer-file.dat', 'http://test-status-timeout/path/to/file.ext', {
                timeout: 200
            });
        })
        it('badhost-retry-failure (2)', async function() {
            const start = Date.now();
            try {
                await uploadFile('test-transfer-file.dat', 'http://badhost/path/to/file.ext', {
                    retryMaxDuration: 1000
                });
                assert.fail('failure expected')
            } catch (e) {
                // expect elapsed to be at least 500ms, since less than that a 3rd
                // retry would fit (400ms-500ms wait).
                const elapsed = Date.now() - start;
                assert.ok(elapsed >= 500, `elapsed time: ${elapsed}`);
                assert.ok(e.message.startsWith('PUT \'http://badhost/path/to/file.ext\' connect failed: request to http://badhost/path/to/file.ext failed, reason: getaddrinfo ENOTFOUND badhost'));
            }
        })
    })
})
