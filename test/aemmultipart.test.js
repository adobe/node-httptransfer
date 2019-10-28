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
const fs = require('fs-extra');
const nock = require('nock');
const { uploadAEMMultipartFile } = require('../lib/aemmultipart');

describe('multipart', function() {
    describe('upload', function() {
        beforeEach(async function() {
            await fs.writeFile('.testfile.dat', 'hello world 123', 'utf8');
        })
        afterEach(async function() {
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
            try {
                await fs.unlink('.testfile.dat');
            } catch (e) {
                // don't fail if the file doesn't exist, it's only done to clean up 
                // after ourselves
            }
        })
        it('status-201-1url', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);
    
            await uploadAEMMultipartFile('.testfile.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext'
                ]
            });
        })
        it('status-201-2urls', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);
    
            await uploadAEMMultipartFile('.testfile.dat', {
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        })
        it('status-201-2urls-maxpart14', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('.testfile.dat', {
                maxPartSize: 14,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        })
        it('status-201-2urls-maxpart15', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);
    
            await uploadAEMMultipartFile('.testfile.dat', {
                maxPartSize: 15,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        })
        it('status-201-2urls-maxpart16', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file-1.ext', 'hello world 123')
                .reply(201);
    
            await uploadAEMMultipartFile('.testfile.dat', {
                maxPartSize: 16,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        })
        it('status-201-2urls-maxpart14-minpart7', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 8)
                .put('/path/to/file-1.ext', 'hello wo')
                .reply(201);
            nock('http://test-status-201')
                .matchHeader('content-length', 7)
                .put('/path/to/file-2.ext', 'rld 123')
                .reply(201);

            await uploadAEMMultipartFile('.testfile.dat', {
                maxPartSize: 14,
                minPartSize: 7,
                urls: [
                    'http://test-status-201/path/to/file-1.ext',
                    'http://test-status-201/path/to/file-2.ext'
                ]
            });
        })
        it('status-201-2urls-maxpart14-minpart8', async function() {
            try {
                await uploadAEMMultipartFile('.testfile.dat', {
                    maxPartSize: 14,
                    minPartSize: 8,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ]
                });
                assert.fail('expected to fail');
            } catch (e) {
                assert.strictEqual(e.message, 'Unable to upload, part size 7 is below minimum 8');
            }
        })
        it('status-201-1url-maxpart14', async function() {
            try {
                await uploadAEMMultipartFile('.testfile.dat', {
                    maxPartSize: 14,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext'
                    ]
                });
            } catch (e) {
                assert.strictEqual(e.message, 'Unable to upload, file is too large');
            }
        })
        it('status-201-2urls-maxpart14-404url1', async function() {
            try {
                nock('http://test-status-201')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(404);

                await uploadAEMMultipartFile('.testfile.dat', {
                    maxPartSize: 14,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ]
                });
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-status-201/path/to/file-1.ext\' failed with status 404');
            }
        })
        it('status-201-2urls-maxpart14-404url2', async function() {
            try {
                nock('http://test-status-201')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-201')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(404);

                await uploadAEMMultipartFile('.testfile.dat', {
                    maxPartSize: 14,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ]
                });
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-status-201/path/to/file-2.ext\' failed with status 404');
            }
        })
    })
})
