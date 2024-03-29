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

const assert = require('assert');
const fs = require('fs').promises;
const nock = require('nock');
const path = require('path');
const crypto = require('crypto');
const { downloadFileConcurrently, uploadFileConcurrently, uploadMultiPartFileConcurrently, uploadFilesConcurrently } = require('../lib/file');
const { testSetResponseBodyOverride, testHasResponseBodyOverrides } = require('../lib/fetch');
const { createErrorReadable } = require('./streams');

describe('download concurrently', function () {
    beforeEach(async function () {
        nock.cleanAll();
    });

    afterEach(async function () {
        assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
        assert.ok(nock.isDone(), `check if all nocks have been used, ${nock.pendingMocks()}`);
        nock.cleanAll();
    });

    it('status-200', async function () {
        nock('http://test-status-200')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="image-file-1.jpg"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-type': 'image/jpeg',
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'));
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('status-200-no-head-req', async function () {
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-type': 'image/jpeg',
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'), {
            contentType: 'image/jpeg',
            fileSize: 11
        });
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
        } catch (e) {
            console.log(e);
        }
    });
    it('status-200-multiple-chunks', async function () {
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'hello w', {
                'content-type': 'image/jpeg',
                'content-length': 7
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'orld', {
                'content-type': 'image/jpeg',
                'content-length': 4
            });

        await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'), {
            contentType: 'image/jpeg',
            fileSize: 11,
            preferredPartSize: 7
        });
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
        } catch (e) {
            console.log(e);
        }
    });
    it('status-200-many-chunks', async function () {
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'h', {
                'content-type': 'image/jpeg',
                'content-length': 1
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'e', {
                'content-type': 'image/jpeg',
                'content-length': 1
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'l', {
                'content-type': 'image/jpeg',
                'content-length': 1
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'l', {
                'content-type': 'image/jpeg',
                'content-length': 1
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'o', {
                'content-type': 'image/jpeg',
                'content-length': 1
            });
        await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'), {
            contentType: 'image/jpeg',
            fileSize: 5,
            preferredPartSize: 1
        });
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
        assert.strictEqual(result, 'hello');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('status-200-no-head-req (repeated)', async function () {
        for (let i = 0; i < 3; i++) {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world', {
                    'content-type': 'image/jpeg',
                    'content-length': 11
                });

            await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'), {
                contentType: 'image/jpeg',
                fileSize: 11
            });
            const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
            } catch (e) {
                console.log(e);
            }
        }
    });

    it('status-200-no-content-type', async function () {
        nock('http://test-status-200')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="image-file-1.jpg"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-type': 'image/jpeg',
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'), {
            fileSize: 11
        });
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('status-200-no-file-size', async function () {
        nock('http://test-status-200')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="image-file-1.jpg"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-type': 'image/jpeg',
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./test-transfer-file-status-200.dat'), {
            contentType: 'image/jpeg'
        });
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-200.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-200.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('status-200-mkdir', async function () {
        nock('http://test-status-200')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="image-file-1.jpg"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });
        nock('http://test-status-200')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-type': 'image/jpeg',
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./testdir/test-transfer-file-mkdir.dat'), {
            mkdirs: true
        });
        const result = await fs.readFile(path.resolve('./testdir/test-transfer-file-mkdir.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./testdir/test-transfer-file-mkdir.dat'));
        } catch (e) {
            // don't fail if it doesn't exist, it's only clean up
            console.log(e);
        }

        try {
            await fs.rmdir(path.resolve('./testdir'));
        } catch (e) {
            // don't fail if it doesn't exist, it's only clean up
            console.log(e);
        }
    });

    it('status-200-mkdir-failure', async function () {
        try {
            await downloadFileConcurrently('http://test-status-200/path/to/file.ext', path.resolve('./index.js/hello.dat'), {
                mkdirs: true
            });
            assert.fail('test is supposed to fail');
        } catch (e) {
            assert.ok(e.message.includes('index.js is not a directory'));
        }
    });

    it('status-200-truncate-retry', async function () {
        // truncated errors are not retried
        nock('http://test-status-200-truncate-retry')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="image-file-1.jpg"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });
        nock('http://test-status-200-truncate-retry')
            .get('/path/to/file.ext')
            .reply(200, 'hello', {
                'content-length': 11
            });

        nock('http://test-status-200-truncate-retry')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-200-truncate-retry/path/to/file.ext', path.resolve('./test-transfer-file-status-200-truncated.dat'));
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-200-truncated.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-200-truncated.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('status-200-stream-retry', async function () {
        nock('http://test-status-200-stream-retry')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="image-file-1.jpg"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });
        nock('http://test-status-200-stream-retry')
            .get('/path/to/file.ext')
            .twice()
            .reply(200, 'hello world', {
                'content-type': 'image/jpeg',
                'content-length': 11
            });

        testSetResponseBodyOverride("GET", createErrorReadable(Error('read error')));
        await downloadFileConcurrently('http://test-status-200-stream-retry/path/to/file.ext', path.resolve('./test-transfer-file-filestream.dat'));
        const result = await fs.readFile(path.resolve('./test-transfer-file-filestream.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-filestream.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('status-200-stream-retry (repeated)', async function () {
        for (let i = 0; i < 3; i++) {
            nock('http://test-status-200-stream-retry')
                .head('/path/to/file.ext')
                .reply(200, "OK", {
                    'content-type': 'image/jpeg',
                    'content-length': 11,
                    'content-disposition': 'attachment; filename="image-file-1.jpg"',
                    'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                    'etag': ''
                });
            nock('http://test-status-200-stream-retry')
                .get('/path/to/file.ext')
                .twice()
                .reply(200, 'hello world', {
                    'content-type': 'image/jpeg',
                    'content-length': 11
                });

            testSetResponseBodyOverride("GET", createErrorReadable(Error('read error')));
            await downloadFileConcurrently('http://test-status-200-stream-retry/path/to/file.ext', path.resolve('./test-transfer-file-filestream.dat'));
            const result = await fs.readFile(path.resolve('./test-transfer-file-filestream.dat'), 'utf8');
            assert.strictEqual(result, 'hello world');

            try {
                await fs.unlink(path.resolve('./test-transfer-file-filestream.dat'));
            } catch (e) {
                console.log(e);
            }
        }
    });

    it('status-404', async function () {
        try {
            nock('http://test-status-404')
                .head('/path/to/file.ext')
                .reply(200, "OK", {
                    'content-type': 'text/plain',
                    'content-length': 11,
                    'content-disposition': 'attachment; filename="image-file-1.jpg"',
                    'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                    'etag': ''
                });
            nock('http://test-status-404')
                .get('/path/to/file.ext')
                .reply(404, 'hello world');

            await downloadFileConcurrently('http://test-status-404/path/to/file.ext', path.resolve('./test-transfer-file-status-404.dat'));
        } catch (e) {
            assert.ok(e.message.includes('GET'), e.message);
            assert.ok(e.message.includes('failed with status 404'));

            try {
                const result = await fs.readFile(path.resolve('./test-transfer-file-status-404.dat'), 'utf8');
                assert.strictEqual(result, '');
            } catch (err) {
                assert.ok(err.code === "ENOENT"); // nothing was downloaded or even created
            }
        }

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-404.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('status-404-retry', async function () {
        nock('http://test-status-404')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="file.ext"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });

        nock('http://test-status-404')
            .get('/path/to/file.ext')
            .reply(404);

        nock('http://test-status-404')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-404/path/to/file.ext', path.resolve('./test-transfer-file-status-404-retry.dat'), {
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

    it('status-404-stream-retry', async function () {
        try {
            nock('http://test-status-404-stream-retry')
                .head('/path/to/file.ext')
                .reply(200, "OK", {
                    'content-type': 'text/plain',
                    'content-length': 11,
                    'content-disposition': 'attachment; filename="file.ext"',
                    'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                    'etag': ''
                });

            nock('http://test-status-404-stream-retry')
                .get('/path/to/file.ext')
                .reply(404, 'hello world', {
                    'content-type': 'text/plain'
                });

            nock('http://test-status-404-stream-retry')
                .get('/path/to/file.ext')
                .reply(404, 'hello world', {
                    'content-type': 'text/plain',
                    'content-length': 11
                });

            testSetResponseBodyOverride("GET", createErrorReadable(Error('read error')));
            await downloadFileConcurrently('http://test-status-404-stream-retry/path/to/file.ext', path.resolve('./test-transfer-file-status-404-stream-retry.dat'));
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

    it('status-503-retry', async function () {
        nock('http://test-status-503')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'text/plain',
                'content-length': 11,
                'content-disposition': 'attachment; filename="file.ext"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });

        nock('http://test-status-503')
            .get('/path/to/file.ext')
            .reply(503);

        nock('http://test-status-503')
            .get('/path/to/file.ext')
            .reply(200, 'hello world', {
                'content-type': 'text/plain',
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-503/path/to/file.ext', path.resolve('./test-transfer-file-status-503-retry.dat'));
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-503-retry.dat'), 'utf8');
        assert.strictEqual(result, 'hello world');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-503-retry.dat'));
        } catch (e) {
            console.log(e);
        }
    }).timeout(10000);
    it('status-503-one-chunk-fails', async function () {
        nock('http://test-status-503', {
            reqheaders: {
                'range': 'bytes=0-0'
            },
        })
            .get('/path/to/file.ext')
            .reply(200, 'c', {
                'content-type': 'text/plain',
                'content-length': 1
            });
        // `a` fails at first with 503
        nock('http://test-status-503', {
            reqheaders: {
                'range': 'bytes=1-1'
            },
        })
            .get('/path/to/file.ext')
            .reply(503);
        nock('http://test-status-503', {
            reqheaders: {
                'range': 'bytes=1-1'
            },
        })
            .get('/path/to/file.ext')
            .reply(200, 'a', {
                'content-type': 'text/plain',
                'content-length': 1
            });
        nock('http://test-status-503', {
            reqheaders: {
                'range': 'bytes=2-2'
            },
        })
            .get('/path/to/file.ext')
            .reply(200, 't', {
                'content-type': 'text/plain',
                'content-length': 1
            });

        await downloadFileConcurrently('http://test-status-503/path/to/file.ext', path.resolve('./test-transfer-file-status-503-retry.dat'),{
            contentType: 'text/plain',
            fileSize: 3,
            preferredPartSize: 1
        });
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-503-retry.dat'), 'utf8');
        assert.strictEqual(result, 'cat');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-503-retry.dat'));
        } catch (e) {
            console.log(e);
        }
    });
    it('status-etimedout-one-chunk-fails', async function () {
        nock('http://test-status-etimedout', {
            reqheaders: {
                'range': 'bytes=0-0'
            },
        })
            .get('/path/to/file.ext')
            .reply(200, 'c', {
                'content-type': 'text/plain',
                'content-length': 1
            });
        // `a` fails at first with etimedout
        nock('http://test-status-etimedout', {
            reqheaders: {
                'range': 'bytes=1-1'
            },
        })
            .get('/path/to/file.ext')
            .replyWithError({
                code: 'ETIMEDOUT'
            });
        nock('http://test-status-etimedout', {
            reqheaders: {
                'range': 'bytes=1-1'
            },
        })
            .get('/path/to/file.ext')
            .reply(200, 'a', {
                'content-type': 'text/plain',
                'content-length': 1
            });
        nock('http://test-status-etimedout', {
            reqheaders: {
                'range': 'bytes=2-2'
            },
        })
            .get('/path/to/file.ext')
            .reply(200, 't', {
                'content-type': 'text/plain',
                'content-length': 1
            });

        await downloadFileConcurrently('http://test-status-etimedout/path/to/file.ext', path.resolve('./test-transfer-file-status-etimedout-retry.dat'),{
            contentType: 'text/plain',
            fileSize: 3,
            preferredPartSize: 1
        });
        const result = await fs.readFile(path.resolve('./test-transfer-file-status-etimedout-retry.dat'), 'utf8');
        assert.strictEqual(result, 'cat');

        try {
            await fs.unlink(path.resolve('./test-transfer-file-status-etimedout-retry.dat'));
        } catch (e) {
            console.log(e);
        }
    });

    it('timeout-retry', async function () {
        nock('http://test-status-timeout')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'text/plain',
                'content-length': 11,
                'content-disposition': 'attachment; filename="file.ext"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });

        nock('http://test-status-timeout')
            .get('/path/to/file.ext')
            .delayConnection(500)
            .reply(200, 'hello world', {
                'content-type': 'text/plain',
                'content-length': 11
            });

        await downloadFileConcurrently('http://test-status-timeout/path/to/file.ext', path.resolve('./test-transfer-file-timeout-retry.dat'), {
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

    it('badhost-retry-failure (1)', async function () {
        nock('http://badhost')
            .head('/path/to/file.ext')
            .reply(200, "OK", {
                'content-type': 'image/jpeg',
                'content-length': 11,
                'content-disposition': 'attachment; filename="file.ext"',
                'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'etag': ''
            });

        try {
            await downloadFileConcurrently('http://badhost/path/to/file.ext', path.resolve('./test-transfer-file-timeout-retry-1.dat'), {
                retryMaxDuration: 1000
            });
            assert.fail('failure expected');
        } catch (e) {
            console.log(e);
            assert.ok(e.message.includes('GET'));
            assert.ok(e.message.includes('connect failed'));
            // assert.ok((e.message.includes('ENOTFOUND') || e.message.includes('EAI_AGAIN'))); // no nock also leads to retries
            assert.ok(e.message.includes('badhost'));
        }

        try {
            await fs.unlink(path.resolve('./test-transfer-file-timeout-retry-1.dat'));
        } catch (e) {
            console.log(e);
        }
    }).timeout(20000);
});

describe('upload concurrently', function () {
    beforeEach(async function () {
        nock.cleanAll();
    });

    afterEach(async function () {
        assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        nock.cleanAll();
    });

    it('status-201', async function () {
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

    it('status-201 (repeated)', async function () {
        for (let i = 0; i < 3; i++) {
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
        }
    });

    it('status-201-header', async function () {
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

    it('status-404', async function () {
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

    it('status-404-retry', async function () {
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

    it('status-503-retry', async function () {
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

    it('timeout-retry', async function () {
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

    it('badhost-retry-failure (2)', async function () {
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

describe('multipart upload concurrently', function () {
    describe('upload', function () {
        afterEach(async function () {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });

        it('no target', async function () {
            await fs.writeFile('test-transfer-file-1.dat', 'hello world 123', 'utf8');

            try {
                await uploadMultiPartFileConcurrently('test-transfer-file-1.dat');
            } catch (e) {
                assert.strictEqual(e.message, 'target not provided: undefined');
            }

            try {
                await fs.unlink('test-transfer-file-1.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('no target urls', async function () {
            await fs.writeFile('test-transfer-file-2.dat', 'hello world 123', 'utf8');

            try {
                await uploadMultiPartFileConcurrently('test-transfer-file-2.dat', {});
            } catch (e) {
                assert.strictEqual(e.message, '\'target.urls\' must be a non-empty array: undefined');
            }

            try {
                await fs.unlink('test-transfer-file-2.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('max-part-size is missing', async function () {
            await fs.writeFile('test-transfer-file-3.dat', 'hello world 123', 'utf8');

            try {
                await uploadMultiPartFileConcurrently('test-transfer-file-3.dat', {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                    ]
                });
            } catch (e) {
                assert.strictEqual(e.message, '\'target.maxPartSize\' must be a positive number: undefined');
            }

            try {
                await fs.unlink('test-transfer-file-3.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-1url', async function () {
            await fs.writeFile('test-transfer-file-4.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-4.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext'
                ],
                maxPartSize: 15
            });

            try {
                await fs.unlink('test-transfer-file-4.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls', async function () {
            await fs.writeFile('test-transfer-file-5.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-5.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ],
                maxPartSize: 8
            });

            try {
                await fs.unlink('test-transfer-file-5.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls (repeated)', async function () {
            for (let i = 0; i < 3; i++) {
                await fs.writeFile('test-transfer-file-5.dat', 'hello world 123', 'utf8');

                nock('http://test-status-201')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-201')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultiPartFileConcurrently('test-transfer-file-5.dat', {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ],
                    maxPartSize: 8
                });

                try {
                    await fs.unlink('test-transfer-file-5.dat');
                } catch (e) { // ignore cleanup failures
                    console.log(e);
                }
            }
        });

        it('status-201-2urls binary', async function () {
            const data = crypto.randomBytes(100);

            await fs.writeFile('test-binary.dat', data);

            nock('http://test-status-201')
                .matchHeader('content-length', 50)
                .put('/path/to/file-1.ext', data.slice(0, 50))
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 50)
                .put('/path/to/file-2.ext', data.slice(50))
                .reply(201);

            await uploadMultiPartFileConcurrently('test-binary.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ],
                maxPartSize: 50
            });

            try {
                await fs.unlink('test-binary.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls-maxpartjustenough', async function () {
            await fs.writeFile('test-transfer-file-6.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-6.dat', {
                maxPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });

            try {
                await fs.unlink('test-transfer-file-6.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls-maxparttoosmall', async function () {
            await fs.writeFile('test-transfer-file-7.dat', 'hello world 123', 'utf8');

            try {
                await uploadMultiPartFileConcurrently('test-transfer-file-7.dat', {
                    maxPartSize: 7,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ]
                });
                assert.fail('expected to fail');
            } catch (e) {
                assert.ok(e.message.includes('too large to upload'));
            }

            try {
                await fs.unlink('test-transfer-file-7.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-10urls-fits2', async function () {
            await fs.writeFile('test-transfer-file-9.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-9.dat', {
                maxPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext',
                    'http://test-status-201/path/to/file-3.ext',
                    'http://test-status-201/path/to/file-4.ext',
                    'http://test-status-201/path/to/file-5.ext',
                    'http://test-status-201/path/to/file-6.ext',
                    'http://test-status-201/path/to/file-7.ext',
                    'http://test-status-201/path/to/file-8.ext',
                    'http://test-status-201/path/to/file-9.ext',
                    'http://test-status-201/path/to/file-10.ext',
                ]
            });

            try {
                await fs.unlink('test-transfer-file-9.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls-preferred-smallermaxsize', async function () {
            await fs.writeFile('test-transfer-file-15.dat', 'hello world 123', 'utf8');

            // minPartSize smaller than preferred has no effect
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-15.dat', {
                maxPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 9,
            });

            try {
                await fs.unlink('test-transfer-file-15.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls-preferred-largermaxsize', async function () {
            await fs.writeFile('test-transfer-file-16.dat', 'hello world 123', 'utf8');

            // preferred is limited on the lower-bound by minPartSize, so
            // the picked part size is the minPartSize
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-16.dat', {
                maxPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 7,
            });

            try {
                await fs.unlink('test-transfer-file-16.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url1', async function () {
            await fs.writeFile('test-transfer-file-17.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(404);
                nock('http://test-status-404')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(200);

                await uploadMultiPartFileConcurrently('test-transfer-file-17.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-17.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url1-concurrency-1', async function () {
            await fs.writeFile('test-transfer-file-17.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-1.ext', 'hel')
                    .reply(404);

                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-2.ext', 'lo ')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-3.ext', 'wor')
                    .reply(200);
                // TODO, look into why this is happening
                // first URL fails first
                // two (out of 4 remaining) urls get executed before the filter function causes the request to end due to an error


                await uploadMultiPartFileConcurrently('test-transfer-file-17.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext',
                        'http://test-status-404/path/to/file-3.ext',
                        'http://test-status-404/path/to/file-4.ext',
                        'http://test-status-404/path/to/file-5.ext',
                    ],
                    maxPartSize: 3,
                }, {
                    maxConcurrent: 1
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-17.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url1-concurrency-5', async function () {
            await fs.writeFile('test-transfer-file-17.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-1.ext', 'hel')
                    .reply(404);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-2.ext', 'lo ')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-3.ext', 'wor')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-4.ext', 'ld ')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-5.ext', '123')
                    .reply(200);
                // since the 5 chunk requests happen concurrently, if one fails, the rest still continue


                await uploadMultiPartFileConcurrently('test-transfer-file-17.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext',
                        'http://test-status-404/path/to/file-3.ext',
                        'http://test-status-404/path/to/file-4.ext',
                        'http://test-status-404/path/to/file-5.ext',
                    ],
                    maxPartSize: 3,
                }, {
                    maxConcurrent: 5
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-17.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url2', async function () {
            await fs.writeFile('test-transfer-file-18.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-404')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(404);

                await uploadMultiPartFileConcurrently('test-transfer-file-18.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-18.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('method-post', async function () {
            await fs.writeFile('test-transfer-file-19.dat', 'hello world 123', 'utf8');

            nock('http://test-method-post')
                .matchHeader('content-length', 8)
                .post('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-method-post')
                .matchHeader('content-length', 7)
                .post('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-19.dat', {
                urls: [
                    'http://test-method-post/path/to/file-1.ext',
                    'http://test-method-post/path/to/file-2.ext'
                ],
                maxPartSize: 8,
            }, {
                method: 'POST'
            });

            try {
                await fs.unlink('test-transfer-file-19.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('method-post (repeated)', async function () {
            for (let i = 0; i < 5; i++) {
                await fs.writeFile('test-transfer-file-19.dat', 'hello world 123', 'utf8');

                nock('http://test-method-post')
                    .matchHeader('content-length', 8)
                    .post('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-method-post')
                    .matchHeader('content-length', 7)
                    .post('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultiPartFileConcurrently('test-transfer-file-19.dat', {
                    urls: [
                        'http://test-method-post/path/to/file-1.ext',
                        'http://test-method-post/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }, {
                    method: 'POST'
                });

                try {
                    await fs.unlink('test-transfer-file-19.dat');
                } catch (e) { // ignore cleanup failures
                    console.log(e);
                }
            }
        });

        it('timeout-error-1', async function () {
            await fs.writeFile('test-transfer-file-20.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(700)
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultiPartFileConcurrently('test-transfer-file-20.dat', {
                    urls: [
                        'http://timeout-error/path/to/file-1.ext',
                        'http://timeout-error/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }, {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-20.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('timeout-error-1-no-retry', async function () {
            await fs.writeFile('test-transfer-file-20.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(500)
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultiPartFileConcurrently('test-transfer-file-20.dat', {
                    urls: [
                        'http://timeout-error/path/to/file-1.ext',
                        'http://timeout-error/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }, {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-20.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('timeout-error-1-retry-max-duration', async function () {
            await fs.writeFile('test-transfer-file-20.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(500)
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultiPartFileConcurrently('test-transfer-file-20.dat', {
                    urls: [
                        'http://timeout-error/path/to/file-1.ext',
                        'http://timeout-error/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }, {
                    timeout: 200,
                    retryMaxDuration: 1
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-20.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('timeout-error-2', async function () {
            await fs.writeFile('test-transfer-file-21.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .delayConnection(500)
                    .reply(201);

                await uploadMultiPartFileConcurrently('test-transfer-file-21.dat', {
                    urls: [
                        'http://timeout-error/path/to/file-1.ext',
                        'http://timeout-error/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }, {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-21.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('header-override', async function () {
            await fs.writeFile('test-transfer-file-22.dat', 'hello world 123', 'utf8');

            nock('http://header-override')
                .matchHeader('content-length', 8)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://header-override')
                .matchHeader('content-length', 7)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-22.dat', {
                urls: [
                    'http://header-override/path/to/file-1.ext',
                    'http://header-override/path/to/file-2.ext'
                ],
                maxPartSize: 8,
            }, {
                headers: {
                    "content-type": "image/jpeg"
                }
            });

            try {
                await fs.unlink('test-transfer-file-22.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-retry', async function () {
            await fs.writeFile('test-transfer-file-23.dat', 'hello world 123', 'utf8');

            nock('http://status-404-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(404);
            nock('http://status-404-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://status-404-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(404);
            nock('http://status-404-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-23.dat', {
                urls: [
                    'http://status-404-retry/path/to/file-1.ext',
                    'http://status-404-retry/path/to/file-2.ext'
                ],
                maxPartSize: 8,
            }, {
                retryAllErrors: true
            });

            try {
                await fs.unlink('test-transfer-file-23.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-503-retry', async function () {
            await fs.writeFile('test-transfer-file-24.dat', 'hello world 123', 'utf8');

            nock('http://status-503-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(503);
            nock('http://status-503-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://status-503-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(503);
            nock('http://status-503-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadMultiPartFileConcurrently('test-transfer-file-24.dat', {
                urls: [
                    'http://status-503-retry/path/to/file-1.ext',
                    'http://status-503-retry/path/to/file-2.ext'
                ],
                maxPartSize: 8,
            });

            try {
                await fs.unlink('test-transfer-file-24.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        }).timeout(10000);
    });

    it('status-connect-error-retry', async function () {
        await fs.writeFile('test-transfer-file-24.dat', 'hello world 123', 'utf8');

        nock('http://status-503-retry')
            .matchHeader('content-length', 8)
            .put('/path/to/file-1.ext', 'hello wo')
            .replyWithError({
                code: 'ECONNRESET',
                message: 'Connection Reset'
            });
        nock('http://status-503-retry')
            .matchHeader('content-length', 8)
            .put('/path/to/file-1.ext', 'hello wo')
            .reply(201);
        nock('http://status-503-retry')
            .matchHeader('content-length', 7)
            .put('/path/to/file-2.ext', 'rld 123')
            .reply(201);

        await uploadMultiPartFileConcurrently('test-transfer-file-24.dat', {
            urls: [
                'http://status-503-retry/path/to/file-1.ext',
                'http://status-503-retry/path/to/file-2.ext'
            ],
            maxPartSize: 8,
        });
        console.log(nock.pendingMocks());
        assert(nock.isDone());
        try {
            await fs.unlink('test-transfer-file-24.dat');
        } catch (e) { // ignore cleanup failures
            console.log(e);
        }
    }).timeout(10000);
});


describe('multipart upload concurrently -- multiple files', function () {
    describe('upload single file', function () {
        afterEach(async function () {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });

        it('no target', async function () {
            await fs.writeFile('test-transfer-file-1.dat', 'hello world 123', 'utf8');

            try {
                await uploadFilesConcurrently(['test-transfer-file-1.dat']);
            } catch (e) {
                assert.strictEqual(e.message, 'target not provided: undefined');
            }

            try {
                await fs.unlink('test-transfer-file-1.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('no target urls', async function () {
            await fs.writeFile('test-transfer-file-2.dat', 'hello world 123', 'utf8');

            try {
                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-2.dat',
                    target: {}
                }]);
            } catch (e) {
                assert.strictEqual(e.message, '\'target.urls\' must be a non-empty array: undefined');
            }

            try {
                await fs.unlink('test-transfer-file-2.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('max-part-size is missing', async function () {
            await fs.writeFile('test-transfer-file-3.dat', 'hello world 123', 'utf8');

            try {
                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-3.dat', 
                    target: {
                        urls: [
                            'http://test-status-201/path/to/file-1.ext',
                        ]
                    }}
                ]);
            } catch (e) {
                assert.strictEqual(e.message, '\'target.maxPartSize\' must be a positive number: undefined');
            }

            try {
                await fs.unlink('test-transfer-file-3.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-1url', async function () {
            await fs.writeFile('test-transfer-file-4.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-4.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext'
                    ],
                    maxPartSize: 15
                }
            }]);

            try {
                await fs.unlink('test-transfer-file-4.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls', async function () {
            await fs.writeFile('test-transfer-file-5.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-5.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ],
                    maxPartSize: 8
                }
            }]);

            try {
                await fs.unlink('test-transfer-file-5.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls (repeated)', async function () {
            for (let i = 0; i < 3; i++) {
                await fs.writeFile('test-transfer-file-5.dat', 'hello world 123', 'utf8');

                nock('http://test-status-201')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-201')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-5.dat', 
                    target: {
                        urls: [
                            'http://test-status-201/path/to/file-1.ext',
                            'http://test-status-201/path/to/file-2.ext'
                        ],
                        maxPartSize: 8
                    }
                }]);

                try {
                    await fs.unlink('test-transfer-file-5.dat');
                } catch (e) { // ignore cleanup failures
                    console.log(e);
                }
            }
        });

        it('status-201-2urls binary', async function () {
            const data = crypto.randomBytes(100);

            await fs.writeFile('test-binary.dat', data);

            nock('http://test-status-201')
                .matchHeader('content-length', 50)
                .put('/path/to/file-1.ext', data.slice(0, 50))
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 50)
                .put('/path/to/file-2.ext', data.slice(50))
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-binary.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ],
                    maxPartSize: 50
                }
            }]);

            try {
                await fs.unlink('test-binary.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls-maxpartjustenough', async function () {
            await fs.writeFile('test-transfer-file-6.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);
            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-6.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ],
                    maxPartSize: 8
                }
            }]);

            try {
                await fs.unlink('test-transfer-file-6.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('status-201-2urls-maxparttoosmall', async function () {
            await fs.writeFile('test-transfer-file-7.dat', 'hello world 123', 'utf8');

            try {
                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-7.dat', 
                    target: {
                        urls: [
                            'http://test-status-201/path/to/file-1.ext',
                            'http://test-status-201/path/to/file-2.ext'
                        ],
                        maxPartSize: 7
                    }
                }]);
                assert.fail('expected to fail');
            } catch (e) {
                assert.ok(e.message.includes('too large to upload'));
            }

            try {
                await fs.unlink('test-transfer-file-7.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-10urls-fits2', async function () {
            await fs.writeFile('test-transfer-file-9.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-9.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext',
                        'http://test-status-201/path/to/file-3.ext',
                        'http://test-status-201/path/to/file-4.ext',
                        'http://test-status-201/path/to/file-5.ext',
                        'http://test-status-201/path/to/file-6.ext',
                        'http://test-status-201/path/to/file-7.ext',
                        'http://test-status-201/path/to/file-8.ext',
                        'http://test-status-201/path/to/file-9.ext',
                        'http://test-status-201/path/to/file-10.ext',
                    ],
                    maxPartSize: 8
                }
            }]);

            try {
                await fs.unlink('test-transfer-file-9.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls-preferred-smallermaxsize', async function () {
            await fs.writeFile('test-transfer-file-15.dat', 'hello world 123', 'utf8');

            // minPartSize smaller than preferred has no effect
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-15.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ],
                    maxPartSize: 8
                }
            }],
            {
                partSize: 9,
            });

            try {
                await fs.unlink('test-transfer-file-15.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls-preferred-largermaxsize', async function () {
            await fs.writeFile('test-transfer-file-16.dat', 'hello world 123', 'utf8');

            // preferred is limited on the lower-bound by minPartSize, so
            // the picked part size is the minPartSize
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-16.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ],
                    maxPartSize: 8
                }
            }],
            {
                partSize: 7,
            });

            try {
                await fs.unlink('test-transfer-file-16.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url1', async function () {
            await fs.writeFile('test-transfer-file-17.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(404);
                nock('http://test-status-404')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(200);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-17.dat', 
                    target: {
                        urls: [
                            'http://test-status-404/path/to/file-1.ext',
                            'http://test-status-404/path/to/file-2.ext'
                        ],
                        maxPartSize: 8
                    }
                }]);
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-17.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url1-concurrency-1', async function () {
            await fs.writeFile('test-transfer-file-17.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-1.ext', 'hel')
                    .reply(404);

                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-2.ext', 'lo ')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-3.ext', 'wor')
                    .reply(200);
                // TODO, look into why this is happening
                // first URL fails first
                // two (out of 4 remaining) urls get executed before the filter function causes the request to end due to an error

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-17.dat', 
                    target: {
                        urls: [
                            'http://test-status-404/path/to/file-1.ext',
                            'http://test-status-404/path/to/file-2.ext',
                            'http://test-status-404/path/to/file-3.ext',
                            'http://test-status-404/path/to/file-4.ext',
                            'http://test-status-404/path/to/file-5.ext',
                        ],
                        maxPartSize: 3,
                    }
                }], {
                    maxConcurrent: 1
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-17.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url1-concurrency-5', async function () {
            await fs.writeFile('test-transfer-file-17.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-1.ext', 'hel')
                    .reply(404);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-2.ext', 'lo ')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-3.ext', 'wor')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-4.ext', 'ld ')
                    .reply(200);
                nock('http://test-status-404')
                    .matchHeader('content-length', 3)
                    .put('/path/to/file-5.ext', '123')
                    .reply(200);
                // since the 5 chunk requests happen concurrently, if one fails, the rest still continue
                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-17.dat', 
                    target: {
                        urls: [
                            'http://test-status-404/path/to/file-1.ext',
                            'http://test-status-404/path/to/file-2.ext',
                            'http://test-status-404/path/to/file-3.ext',
                            'http://test-status-404/path/to/file-4.ext',
                            'http://test-status-404/path/to/file-5.ext',
                        ],
                        maxPartSize: 3,
                    }
                }], {
                    maxConcurrent: 5
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-17.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-url2', async function () {
            await fs.writeFile('test-transfer-file-18.dat', 'hello world 123', 'utf8');

            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-404')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(404);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-18.dat', 
                    target: {
                        urls: [
                            'http://test-status-404/path/to/file-1.ext',
                            'http://test-status-404/path/to/file-2.ext'
                        ],
                        maxPartSize: 8,
                    }
                }]);
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }

            try {
                await fs.unlink('test-transfer-file-18.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('method-post', async function () {
            await fs.writeFile('test-transfer-file-19.dat', 'hello world 123', 'utf8');

            nock('http://test-method-post')
                .matchHeader('content-length', 8)
                .post('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-method-post')
                .matchHeader('content-length', 7)
                .post('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-19.dat', 
                target: {
                    urls: [
                        'http://test-method-post/path/to/file-1.ext',
                        'http://test-method-post/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }
            }], {
                method: 'POST'
            });

            try {
                await fs.unlink('test-transfer-file-19.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('method-post (repeated)', async function () {
            for (let i = 0; i < 5; i++) {
                await fs.writeFile('test-transfer-file-19.dat', 'hello world 123', 'utf8');

                nock('http://test-method-post')
                    .matchHeader('content-length', 8)
                    .post('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-method-post')
                    .matchHeader('content-length', 7)
                    .post('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-19.dat', 
                    target: {
                        urls: [
                            'http://test-method-post/path/to/file-1.ext',
                            'http://test-method-post/path/to/file-2.ext'
                        ],
                        maxPartSize: 8,
                    }
                }], {
                    method: 'POST'
                });

                try {
                    await fs.unlink('test-transfer-file-19.dat');
                } catch (e) { // ignore cleanup failures
                    console.log(e);
                }
            }
        });

        it('timeout-error-1', async function () {
            await fs.writeFile('test-transfer-file-20.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(700)
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-20.dat', 
                    target: {
                        urls: [
                            'http://timeout-error/path/to/file-1.ext',
                            'http://timeout-error/path/to/file-2.ext'
                        ],
                        maxPartSize: 8,
                    }
                }], {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-20.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('timeout-error-1-no-retry', async function () {
            await fs.writeFile('test-transfer-file-20.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(500)
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-20.dat', 
                    target: {
                        urls: [
                            'http://timeout-error/path/to/file-1.ext',
                            'http://timeout-error/path/to/file-2.ext'
                        ],
                        maxPartSize: 8,
                    }
                }], {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-20.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('timeout-error-1-retry-max-duration', async function () {
            await fs.writeFile('test-transfer-file-20.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(500)
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-20.dat', 
                    target: {
                        urls: [
                            'http://timeout-error/path/to/file-1.ext',
                            'http://timeout-error/path/to/file-2.ext'
                        ],
                        maxPartSize: 8,
                    }
                }], {
                    timeout: 200,
                    retryMaxDuration: 1
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-20.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('timeout-error-2', async function () {
            await fs.writeFile('test-transfer-file-21.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://timeout-error')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .delayConnection(500)
                    .reply(201);

                await uploadFilesConcurrently([{
                    filepath: 'test-transfer-file-21.dat', 
                    target: {
                        urls: [
                            'http://timeout-error/path/to/file-1.ext',
                            'http://timeout-error/path/to/file-2.ext'
                        ],
                        maxPartSize: 8,
                    }
                }], {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected');
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('connect failed'));
                assert.ok(e.message.includes('network timeout'));
            }

            try {
                await fs.unlink('test-transfer-file-21.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('header-override', async function () {
            await fs.writeFile('test-transfer-file-22.dat', 'hello world 123', 'utf8');

            nock('http://header-override')
                .matchHeader('content-length', 8)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://header-override')
                .matchHeader('content-length', 7)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-22.dat', 
                target: {
                    urls: [
                        'http://header-override/path/to/file-1.ext',
                        'http://header-override/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }
            }], {
                headers: {
                    "content-type": "image/jpeg"
                }
            });

            try {
                await fs.unlink('test-transfer-file-22.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-404-retry', async function () {
            await fs.writeFile('test-transfer-file-23.dat', 'hello world 123', 'utf8');

            nock('http://status-404-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(404);
            nock('http://status-404-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://status-404-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(404);
            nock('http://status-404-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-23.dat', 
                target: {
                    urls: [
                        'http://status-404-retry/path/to/file-1.ext',
                        'http://status-404-retry/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }
            }], {
                retryAllErrors: true
            });

            try {
                await fs.unlink('test-transfer-file-23.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-503-retry', async function () {
            await fs.writeFile('test-transfer-file-24.dat', 'hello world 123', 'utf8');

            nock('http://status-503-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(503);
            nock('http://status-503-retry')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://status-503-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(503);
            nock('http://status-503-retry')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-24.dat', 
                target: {
                    urls: [
                        'http://status-503-retry/path/to/file-1.ext',
                        'http://status-503-retry/path/to/file-2.ext'
                    ],
                    maxPartSize: 8,
                }
            }]);

            try {
                await fs.unlink('test-transfer-file-24.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        }).timeout(10000);
    });

    it('status-connect-error-retry', async function () {
        await fs.writeFile('test-transfer-file-24.dat', 'hello world 123', 'utf8');

        nock('http://status-503-retry')
            .matchHeader('content-length', 8)
            .put('/path/to/file-1.ext', 'hello wo')
            .replyWithError({
                code: 'ECONNRESET',
                message: 'Connection Reset'
            });
        nock('http://status-503-retry')
            .matchHeader('content-length', 8)
            .put('/path/to/file-1.ext', 'hello wo')
            .reply(201);
        nock('http://status-503-retry')
            .matchHeader('content-length', 7)
            .put('/path/to/file-2.ext', 'rld 123')
            .reply(201);

        await uploadFilesConcurrently([{
            filepath: 'test-transfer-file-24.dat', 
            target: {
                urls: [
                    'http://status-503-retry/path/to/file-1.ext',
                    'http://status-503-retry/path/to/file-2.ext'
                ],
                maxPartSize: 8,
            }
        }]);
        console.log(nock.pendingMocks());
        assert(nock.isDone());
        try {
            await fs.unlink('test-transfer-file-24.dat');
        } catch (e) { // ignore cleanup failures
            console.log(e);
        }
    }).timeout(10000);
    describe('upload multiple files', function () {
        afterEach(async function () {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });
        it('status-201-1url-each', async function () {
            await fs.writeFile('test-transfer-file-1.dat', 'hello world 123', 'utf8');
            await fs.writeFile('test-transfer-file-2.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-2.ext', 'hello world 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-1.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext'
                    ],
                    maxPartSize: 15
                }
            },
            {
                filepath: 'test-transfer-file-2.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-2.ext'
                    ],
                    maxPartSize: 15
                }
            }]);

            try {
                await fs.unlink('test-transfer-file-1.dat');
                await fs.unlink('test-transfer-file-2.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('status-201-1url-each-50-files', async function () {
            const uploadFiles = [];
            for (let i=0; i<50; i++) {
                await fs.writeFile(`test-transfer-file-${i}.dat`, 'hello world 123', 'utf8');
                nock('http://test-status-201')
                    .matchHeader('content-length', 15)
                    .put(`/path/to/file-${i}.ext`, 'hello world 123')
                    .reply(201);
                uploadFiles.push({
                    filepath: `test-transfer-file-${i}.dat`, 
                    target: {
                        urls: [
                            `http://test-status-201/path/to/file-${i}.ext`
                        ],
                        maxPartSize: 15
                    }
                });
            }

            await uploadFilesConcurrently(uploadFiles);

            try {
                for (let i=0; i<50; i++) {
                    await fs.unlink(`test-transfer-file-${i}.dat`);
                }
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });

        it('status-201-2urls', async function () {
            await fs.writeFile('test-transfer-file-1.dat', 'hello world 123', 'utf8');
            await fs.writeFile('test-transfer-file-2.dat', 'hello world 123', 'utf8');

            // file 1
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-1-2.ext', 'rld 123')
                .reply(201);
            // file 2
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-2-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-1.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1-1.ext',
                        'http://test-status-201/path/to/file-1-2.ext'
                    ],
                    maxPartSize: 8
                }
            }, {
                filepath: 'test-transfer-file-2.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-2-1.ext',
                        'http://test-status-201/path/to/file-2-2.ext'
                    ],
                    maxPartSize: 8
                }
            }]);

            try {
                await fs.unlink('test-transfer-file-1.dat');
                await fs.unlink('test-transfer-file-2.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
    });

    it('one file fails', async function () {
        await fs.writeFile('test-transfer-file-success.dat', 'hello world 123', 'utf8');
        await fs.writeFile('test-transfer-file-failure.dat', 'hello world 123', 'utf8');

        try {
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-1-2.ext', 'rld 123')
                .reply(201);

            nock('http://timeout-error')
                .matchHeader('content-length', 8)
                .put('/path/to/file-2-1.ext', 'hello wo')
                .delayConnection(700)
                .reply(201);
            nock('http://timeout-error')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2-2.ext', 'rld 123')
                .reply(201);

            await uploadFilesConcurrently([{
                filepath: 'test-transfer-file-success.dat', 
                target: {
                    urls: [
                        'http://test-status-201/path/to/file-1-1.ext',
                        'http://test-status-201/path/to/file-1-2.ext'
                    ],
                    maxPartSize: 8
                }
            },{
                filepath: 'test-transfer-file-failure.dat', 
                target: {
                    urls: [
                        'http://timeout-error/path/to/file-2-1.ext',
                        'http://timeout-error/path/to/file-2-2.ext'
                    ],
                    maxPartSize: 8,
                }
            }], {
                timeout: 200,
                retryEnabled: false
            });

            assert.fail('failure expected');
        } catch (e) {
            assert.ok(e.message.includes('PUT'));
            assert.ok(e.message.includes('connect failed'));
            assert.ok(e.message.includes('network timeout'));
            // since all nocks are done, we know the successful one uploaded regardless of the other files failure
            assert.ok(nock.isDone());
        }

        try {
            await fs.unlink('test-transfer-file-success.dat');
            await fs.unlink('test-transfer-file-failure.dat');
        } catch (e) { // ignore cleanup failures
            console.log(e);
        }
    });
});

