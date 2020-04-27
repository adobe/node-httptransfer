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
const { uploadAEMMultipartFile } = require('../lib/aemmultipart');
const { testHasResponseBodyOverrides } = require('../lib/fetch');

describe('multipart', function () {
    describe('upload', function () {
        beforeEach(async function () {
            // 15 characters
            await fs.writeFile('test-transfer-file.dat', 'hello world 123', 'utf8');
        });

        afterEach(async function () {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
            try {
                await fs.unlink('test-transfer-file.dat');
            } catch (e) {
                // don't fail if the file doesn't exist, it's only clean up
                console.log(e);
            }
        });
        it('no target', async function () {
            try {
                await uploadAEMMultipartFile('test-transfer-file.dat');
            } catch (e) {
                assert.equal(e.message, 'target not provided');
            }
        });
        it('no target urls', async function () {
            try {
                await uploadAEMMultipartFile('test-transfer-file.dat', {});
            } catch (e) {
                assert.equal(e.message, 'invalid number of target urls');
            }
        });
        it('min-part-size larger than max-part-size', async function () {
            try {
                await uploadAEMMultipartFile('test-transfer-file.dat', {
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                    ],
                    minPartSize: 1000,
                    maxPartSize: 500
                });
            } catch (e) {
                assert.equal(e.message, 'minPartSize (1000) > maxPartSize: (500)');
            }
        });
        it('status-201-1url', async function () {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext'
                ]
            });
        });
        it('status-201-2urls', async function () {
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        });
        it('status-201-2urls-maxpartjustenough', async function () {
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                maxPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        });
        it('status-201-2urls-maxparttoosmall', async function () {
            try {
                await uploadAEMMultipartFile('test-transfer-file.dat', {
                    maxPartSize: 7,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ]
                });
                assert.fail('expected to fail');
            } catch (e) {
                assert.ok(e.message.includes('File \'test-transfer-file.dat\' is too large to upload'));
            }
        });
        it('status-201-2urls-fitminpart', async function () {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                minPartSize: 15,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        });
        it('status-201-10urls-fits2', async function () {
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
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
        });
        it('status-201-2urls-minparttoosmall', async function () {
            // this works, because min part is only a suggestion
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                minPartSize: 7,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        });
        it('status-201-2urls-smallerpreferred', async function () {
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 7,
            });
        });
        it('status-201-2urls-largerpreferred', async function () {
            nock('http://test-status-201')
                .matchHeader('content-length', 9)
                .put('/path/to/file-1.ext', 'hello wor')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 6)
                .put('/path/to/file-2.ext', 'ld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 9,
            });
        });
        it('status-201-2urls-preferred-smallerminsize', async function () {
            // minPartSize smaller than preferred has no effect
            nock('http://test-status-201')
                .matchHeader('content-length', 9)
                .put('/path/to/file-1.ext', 'hello wor')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 6)
                .put('/path/to/file-2.ext', 'ld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                minPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 9,
            });
        });
        it('status-201-2urls-preferred-largerminsize', async function () {
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

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                minPartSize: 9,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 8,
            });
        });
        it('status-201-2urls-preferred-smallermaxsize', async function () {
            // minPartSize smaller than preferred has no effect
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                maxPartSize: 8,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 9,
            });
        });
        it('status-201-2urls-preferred-largermaxsize', async function () {
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

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                maxPartSize: 9,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            }, {
                partSize: 8,
            });
        });
        it('status-404-url1', async function () {
            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(404);

                await uploadAEMMultipartFile('test-transfer-file.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext'
                    ]
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }
        });
        it('status-404-url2', async function () {
            try {
                nock('http://test-status-404')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-404')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(404);

                await uploadAEMMultipartFile('test-transfer-file.dat', {
                    urls: [
                        'http://test-status-404/path/to/file-1.ext',
                        'http://test-status-404/path/to/file-2.ext'
                    ]
                });
            } catch (e) {
                assert.ok(e.message.includes('PUT'));
                assert.ok(e.message.includes('failed with status 404'));
            }
        });
        it('method-post', async function () {
            nock('http://test-method-post')
                .matchHeader('content-length', 8)
                .post('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-method-post')
                .matchHeader('content-length', 7)
                .post('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://test-method-post/path/to/file-1.ext',
                    'http://test-method-post/path/to/file-2.ext'
                ]
            }, {
                method: 'POST'
            });
        });
        it('timeout-error-1', async function () {
            try {
                nock('http://timeout-error')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .delayConnection(500)
                    .reply(201);

                await uploadAEMMultipartFile('test-transfer-file.dat', {
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
        });
        it('timeout-error-2', async function () {
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

                await uploadAEMMultipartFile('test-transfer-file.dat', {
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
        });
        it('header-override', async function () {
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

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://header-override/path/to/file-1.ext',
                    'http://header-override/path/to/file-2.ext'
                ]
            }, {
                headers: {
                    "content-type": "image/jpeg"
                }
            });
        });
        it('status-404-retry', async function () {
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

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://status-404-retry/path/to/file-1.ext',
                    'http://status-404-retry/path/to/file-2.ext'
                ]
            }, {
                retryAllErrors: true
            });
        });
        it('status-503-retry', async function () {
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

            await uploadAEMMultipartFile('test-transfer-file.dat', {
                urls: [
                    'http://status-503-retry/path/to/file-1.ext',
                    'http://status-503-retry/path/to/file-2.ext'
                ]
            });
        });
    });
});
