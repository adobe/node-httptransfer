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
const fs = require('fs').promises;
const nock = require('nock');
const path = require('path');
const { downloadFile, uploadFile, uploadFileConcurrently } = require('../lib/file');
const { testSetResponseBodyOverride, testHasResponseBodyOverrides } = require('../lib/fetch');
const { createErrorReadable } = require('./streams');

describe('file', function() {
    describe('download', function() {
        afterEach(async function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });
        it('status-200', async function() {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'));
            const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-200-mkdir', async function() {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-200/path/to/file.ext', path.resolve('./testdir/test-transfer-file-mkdir.dat'), {
                mkdirs: true
            });
            const result = await fs.readFile(path.resolve('./testdir/test-transfer-file-mkdir.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try{
                await fs.unlink(path.resolve('./testdir/test-transfer-file-mkdir.dat'));
            } catch(e){
                // don't fail if it doesn't exist, it's only clean up
                console.log(e);
            }

            try{
                await fs.rmdir(path.resolve('./testdir'));
            } catch(e){
                // don't fail if it doesn't exist, it's only clean up
                console.log(e);
            }
        });
        it('status-200-mkdir-failure', async function() {
            try {
                await downloadFile('http://test-status-200/path/to/file.ext', path.resolve('./index.js/hello.dat'), {
                    mkdirs: true
                });  
                assert.fail('test is supposed to fail');
            } catch (e) {
                assert.ok(e.message.includes('index.js is not a directory'));
            }
        });
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

            await downloadFile('http://test-status-200-truncate-retry/path/to/file.ext', path.resolve('./test-transfer-file-status-200-truncated.dat'));
            const result = await fs.readFile(path.resolve('./test-transfer-file-status-200-truncated.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-status-200-truncated.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-200-stream-retry', async function() {
            nock('http://test-status-200-stream-retry')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            nock('http://test-status-200-stream-retry')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            testSetResponseBodyOverride("GET", createErrorReadable(Error('read error')));
            await downloadFile('http://test-status-200-stream-retry/path/to/file.ext', path.resolve('./test-transfer-file-filestream.dat'));
            const result = await fs.readFile(path.resolve('./test-transfer-file-filestream.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-filestream.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-404', async function() {
            try {
                nock('http://test-status-404')
                    .get('/path/to/file.ext')
                    .reply(404, 'hello world');

                await downloadFile('http://test-status-404/path/to/file.ext', path.resolve('./test-transfer-file-status-404.dat'));
            } catch (e) {
                assert.ok(e.message.includes('GET'), e.message);
                assert.ok(e.message.includes('failed with status 404'));
                const result = await fs.readFile(path.resolve('./test-transfer-file-status-404.dat'), 'utf8');
                assert.strictEqual(result, '');
            }

            try {
                await fs.unlink(path.resolve('./test-transfer-file-status-404.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-404-retry', async function() {
            nock('http://test-status-404')
                .get('/path/to/file.ext')
                .reply(404);

            nock('http://test-status-404')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-404/path/to/file.ext', path.resolve('./test-transfer-file-status-404-retry.dat'), {
                retryAllErrors: true
            });
            const result = await fs.readFile(path.resolve('./test-transfer-file-status-404-retry.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-status-404-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        }).timeout(20000);
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
                await downloadFile('http://test-status-404-stream-retry/path/to/file.ext', path.resolve('./test-transfer-file-status-404-stream-retry.dat'));
                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('GET'), e.message);
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink(path.resolve('./test-transfer-file-status-404-stream-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-503-retry', async function() {
            nock('http://test-status-503')
                .get('/path/to/file.ext')
                .reply(503);

            nock('http://test-status-503')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-503/path/to/file.ext', path.resolve('./test-transfer-file-status-503-retry.dat'));
            const result = await fs.readFile(path.resolve('./test-transfer-file-status-503-retry.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-status-503-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        }).timeout(10000);
        it('timeout-retry', async function() {
            nock('http://test-status-timeout')
                .get('/path/to/file.ext')
                .delayConnection(500)
                .reply(200, 'hello world');

            nock('http://test-status-timeout')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');

            await downloadFile('http://test-status-timeout/path/to/file.ext', path.resolve('./test-transfer-file-timeout-retry.dat'), {
                timeout: 200
            });
            const result = await fs.readFile(path.resolve('./test-transfer-file-timeout-retry.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-timeout-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('badhost-retry-failure (1)', async function() {
            const start = Date.now();
            try {
                await downloadFile('http://badhost/path/to/file.ext', path.resolve('./test-transfer-file-timeout-retry-1.dat'), {
                    retryMaxDuration: 1000
                });
                assert.fail('failure expected');
            } catch (e) {
                // expect elapsed to be at least 500ms, since less than that a 3rd
                // retry would fit (400ms-500ms wait).
                const elapsed = Date.now() - start;
                assert.ok(elapsed >= 500, `elapsed time: ${elapsed}`);
                assert.ok(e.message.includes('GET'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok((e.message.includes('ENOTFOUND') || e.message.includes('EAI_AGAIN'))); 
                assert.ok(e.message.includes('badhost'));
            }

            try {
                await fs.unlink(path.resolve('./test-transfer-file-timeout-retry-1.dat'));
            } catch (e) {
                console.log(e);
            }
        }).timeout(20000);
    });
    describe('upload', function() {
        afterEach(async function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });

        it('status-201', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-201.dat'), 'hello world 123', 'utf8');
            await uploadFile(path.resolve('./test-transfer-file-up-status-201.dat'), 'http://test-status-201/path/to/file.ext');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-201.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-201-header', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-201.dat'), 'hello world 123', 'utf8');
            await uploadFile(path.resolve('./test-transfer-file-up-status-201.dat'), 'http://test-status-201/path/to/file.ext', {
                headers: {
                    'content-type': 'image/jpeg'
                }
            });

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-201.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-404', async function() {
            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-404.dat'), 'hello world 123', 'utf8');
            try {
                await uploadFile(path.resolve('./test-transfer-file-up-status-404.dat'), 'http://test-status-404/path/to/file.ext');
                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-404.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-404-retry', async function() {
            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404);

            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-404-retry.dat'), 'hello world 123', 'utf8');
            await uploadFile(path.resolve('./test-transfer-file-up-status-404-retry.dat'), 'http://test-status-404/path/to/file.ext', {
                retryAllErrors: true
            });

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-404-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        }).timeout(20000);
        it('status-503-retry', async function() {
            nock('http://test-status-503')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(503);

            nock('http://test-status-503')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-503-retry.dat'), 'hello world 123', 'utf8');
            await uploadFile(path.resolve('./test-transfer-file-up-status-503-retry.dat'), 'http://test-status-503/path/to/file.ext');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-503-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('timeout-retry', async function() {
            nock('http://test-status-timeout')
                .put('/path/to/file.ext', 'hello world 123')
                .delayConnection(500)
                .reply(201);

            nock('http://test-status-timeout')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-timeout-retry.dat'), 'hello world 123', 'utf8');
            await uploadFile(path.resolve('./test-transfer-file-up-timeout-retry.dat'), 'http://test-status-timeout/path/to/file.ext', {
                timeout: 200
            });

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-timeout-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('badhost-retry-failure (2)', async function() {
            const start = Date.now();
            try {
                await fs.writeFile(path.resolve('./test-transfer-file-up-badhost-retry-failure-2.dat'), 'hello world 123', 'utf8');
                await uploadFile(path.resolve('./test-transfer-file-up-badhost-retry-failure-2.dat'), 'http://badhost/path/to/file.ext', {
                    retryMaxDuration: 1000
                });
                assert.fail('failure expected');
            } catch (e) {
                // expect elapsed to be at least 500ms, since less than that a 3rd
                // retry would fit (400ms-500ms wait).
                const elapsed = Date.now() - start;
                assert.ok(elapsed >= 500, `elapsed time: ${elapsed}`);
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok((e.message.includes('ENOTFOUND') || e.message.includes('EAI_AGAIN'))); 
                assert.ok(e.message.includes('badhost'));
            }

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-badhost-retry-failure-2.dat'));
            } catch (e) {
                console.log(e);
            }
        }).timeout(20000);
    });
    describe('upload concurrently', function() {
        afterEach(async function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });

        it('status-201', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-201.dat'), 'hello world 123', 'utf8');
            await uploadFileConcurrently(path.resolve('./test-transfer-file-up-status-201.dat'), 'http://test-status-201/path/to/file.ext');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-201.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-201-header', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-201.dat'), 'hello world 123', 'utf8');
            await uploadFileConcurrently(path.resolve('./test-transfer-file-up-status-201.dat'), 'http://test-status-201/path/to/file.ext', {
                headers: {
                    'content-type': 'image/jpeg'
                }
            });

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-201.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-404', async function() {
            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-404.dat'), 'hello world 123', 'utf8');
            try {
                await uploadFileConcurrently(path.resolve('./test-transfer-file-up-status-404.dat'), 'http://test-status-404/path/to/file.ext');
                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-404.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('status-404-retry', async function() {
            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404);

            nock('http://test-status-404')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-404-retry.dat'), 'hello world 123', 'utf8');
            await uploadFileConcurrently(path.resolve('./test-transfer-file-up-status-404-retry.dat'), 'http://test-status-404/path/to/file.ext', {
                retryAllErrors: true
            });

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-404-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        }).timeout(20000);
        it('status-503-retry', async function() {
            nock('http://test-status-503')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(503);

            nock('http://test-status-503')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-status-503-retry.dat'), 'hello world 123', 'utf8');
            await uploadFileConcurrently(path.resolve('./test-transfer-file-up-status-503-retry.dat'), 'http://test-status-503/path/to/file.ext');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-status-503-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('timeout-retry', async function() {
            nock('http://test-status-timeout')
                .put('/path/to/file.ext', 'hello world 123')
                .delayConnection(1000)
                .reply(201);

            nock('http://test-status-timeout')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);

            await fs.writeFile(path.resolve('./test-transfer-file-up-timeout-retry.dat'), 'hello world 123', 'utf8');
            await uploadFileConcurrently(path.resolve('./test-transfer-file-up-timeout-retry.dat'), 'http://test-status-timeout/path/to/file.ext', {
                timeout: 200
            });

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-timeout-retry.dat'));
            } catch (e) {
                console.log(e);
            }
        });
        it('badhost-retry-failure (2)', async function() {
            const start = Date.now();
            try {
                await fs.writeFile(path.resolve('./test-transfer-file-up-badhost-retry-failure-2.dat'), 'hello world 123', 'utf8');
                await uploadFileConcurrently(path.resolve('./test-transfer-file-up-badhost-retry-failure-2.dat'), 'http://badhost/path/to/file.ext', {
                    retryMaxDuration: 1000
                });
                assert.fail('failure expected');
            } catch (e) {
                // expect elapsed to be at least 500ms, since less than that a 3rd
                // retry would fit (400ms-500ms wait).
                const elapsed = Date.now() - start;
                assert.ok(elapsed >= 500, `elapsed time: ${elapsed}`);
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok((e.message.includes('ENOTFOUND') || e.message.includes('EAI_AGAIN'))); 
                assert.ok(e.message.includes('badhost'));
            }

            try {
                await fs.unlink(path.resolve('./test-transfer-file-up-badhost-retry-failure-2.dat'));
            } catch (e) {
                console.log(e);
            }
        }).timeout(20000);
    });
});
