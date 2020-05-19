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
const crypto = require('crypto');
const { uploadAEMMultipartFile } = require('../lib/aemmultipart');
const { testHasResponseBodyOverrides } = require('../lib/fetch');

describe('multipart', function () {
    describe('upload', function () {
        afterEach(async function () {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        });
        it('no target', async function () {
            await fs.writeFile('test-transfer-file-1.dat', 'hello world 123', 'utf8');

            try {
                await uploadAEMMultipartFile('test-transfer-file-1.dat');
            } catch (e) {
                assert.equal(e.message, 'target not provided');
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
                await uploadAEMMultipartFile('test-transfer-file-2.dat', {});
            } catch (e) {
                assert.equal(e.message, 'invalid number of target urls');
            }

            try {
                await fs.unlink('test-transfer-file-2.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('min-part-size larger than max-part-size', async function () {
            await fs.writeFile('test-transfer-file-3.dat', 'hello world 123', 'utf8');

            try {
                await uploadAEMMultipartFile('test-transfer-file-3.dat', {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                    ],
                    minPartSize: 1000,
                    maxPartSize: 500
                });
            } catch (e) {
                assert.equal(e.message, 'minPartSize (1000) > maxPartSize: (500)');
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

            await uploadAEMMultipartFile('test-transfer-file-4.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext'
                ]
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

            await uploadAEMMultipartFile('test-transfer-file-5.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });

            try {
                await fs.unlink('test-transfer-file-5.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
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

            await uploadAEMMultipartFile('test-binary.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ],
                minPartSize: 50,
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

            await uploadAEMMultipartFile('test-transfer-file-6.dat', {
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
                await uploadAEMMultipartFile('test-transfer-file-7.dat', {
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
        it('status-201-2urls-fitminpart', async function () {
            await fs.writeFile('test-transfer-file-8.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file-8.dat', {
                minPartSize: 15,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });

            try {
                await fs.unlink('test-transfer-file-8.dat');
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

            await uploadAEMMultipartFile('test-transfer-file-9.dat', {
                minPartSize: 8,
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
        it('status-201-2urls-minparttoosmall', async function () {
            await fs.writeFile('test-transfer-file-10.dat', 'hello world 123', 'utf8');

            // this works, because min part is only a suggestion
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file-10.dat', {
                minPartSize: 7,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });

            try {
                await fs.unlink('test-transfer-file-10.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('status-201-2urls-smallerpreferred', async function () {
            await fs.writeFile('test-transfer-file-11.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file-11.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 7,
            });

            try {
                await fs.unlink('test-transfer-file-11.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('status-201-2urls-largerpreferred', async function () {
            await fs.writeFile('test-transfer-file-12.dat', 'hello world 123', 'utf8');

            nock('http://test-status-201')
                .matchHeader('content-length', 9)
                .put('/path/to/file-1.ext', 'hello wor')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 6)
                .put('/path/to/file-2.ext', 'ld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file-12.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 9,
            });

            try {
                await fs.unlink('test-transfer-file-12.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('status-201-2urls-preferred-smallerminsize', async function () {
            await fs.writeFile('test-transfer-file-13.dat', 'hello world 123', 'utf8');

            // minPartSize smaller than preferred has no effect
            nock('http://test-status-201')
                .matchHeader('content-length', 9)
                .put('/path/to/file-1.ext', 'hello wor')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 6)
                .put('/path/to/file-2.ext', 'ld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file-13.dat', {
                minPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 9,
            });

            try {
                await fs.unlink('test-transfer-file-13.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('status-201-2urls-preferred-largerminsize', async function () {
            await fs.writeFile('test-transfer-file-14.dat', 'hello world 123', 'utf8');

            // preferred is limited on the lower-bound by minPartSize, so
            // the picked part size is the minPartSize
            nock('http://test-status-201')
                .matchHeader('content-length', 9)
                .put('/path/to/file-1.ext', 'hello wor')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 6)
                .put('/path/to/file-2.ext', 'ld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file-14.dat', {
                minPartSize: 9,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 8,
            });

            try {
                await fs.unlink('test-transfer-file-14.dat');
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

            await uploadAEMMultipartFile('test-transfer-file-15.dat', {
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

            await uploadAEMMultipartFile('test-transfer-file-16.dat', {
                maxPartSize: 9,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 8,
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

                await uploadAEMMultipartFile('test-transfer-file-17.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext'
                    ]
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

                await uploadAEMMultipartFile('test-transfer-file-18.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext'
                    ]
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

            await uploadAEMMultipartFile('test-transfer-file-19.dat', {
                urls: [
                    'http://test-method-post/path/to/file-1.ext',
                    'http://test-method-post/path/to/file-2.ext'
                ]
            }, {
                method: 'POST'
            });

            try {
                await fs.unlink('test-transfer-file-19.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        });
        it('timeout-error-1', async function () {
            await fs.writeFile('test-transfer-file-20.dat', 'hello world 123', 'utf8');

            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(500)
                    .reply(201);

                await uploadAEMMultipartFile('test-transfer-file-20.dat', {
                    urls: [
                        'http://timeout-error/path/to/file-1.ext',
                        'http://timeout-error/path/to/file-2.ext'
                    ]
                }, {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected')
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

                await uploadAEMMultipartFile('test-transfer-file-21.dat', {
                    urls: [
                        'http://timeout-error/path/to/file-1.ext',
                        'http://timeout-error/path/to/file-2.ext'
                    ]
                }, {
                    timeout: 200,
                    retryEnabled: false
                });

                assert.fail('failure expected')
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

            await uploadAEMMultipartFile('test-transfer-file-22.dat', {
                urls: [
                    'http://header-override/path/to/file-1.ext',
                    'http://header-override/path/to/file-2.ext'
                ]
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

            await uploadAEMMultipartFile('test-transfer-file-23.dat', {
                urls: [
                    'http://status-404-retry/path/to/file-1.ext',
                    'http://status-404-retry/path/to/file-2.ext'
                ]
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

            await uploadAEMMultipartFile('test-transfer-file-24.dat', {
                urls: [
                    'http://status-503-retry/path/to/file-1.ext',
                    'http://status-503-retry/path/to/file-2.ext'
                ]
            });

            try {
                await fs.unlink('test-transfer-file-24.dat');
            } catch (e) { // ignore cleanup failures
                console.log(e);
            }
        }).timeout(10000);
    });
});
