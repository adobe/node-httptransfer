/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2019 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const nock = require('nock');
const { uploadMultipartFile } = require('../lib/multipart');

describe('multipart', function() {
    describe('upload', function() {
        beforeEach(async function() {
            await fs.writeFile('.testfile.dat', 'hello world 123', 'utf8');
        })
        afterEach(async function() {
            nock.cleanAll()
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
    
            await uploadMultipartFile('.testfile.dat', {
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
    
            await uploadMultipartFile('.testfile.dat', {
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

            await uploadMultipartFile('.testfile.dat', {
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
    
            await uploadMultipartFile('.testfile.dat', {
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
    
            await uploadMultipartFile('.testfile.dat', {
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

            await uploadMultipartFile('.testfile.dat', {
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
                nock('http://test-status-201')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-201')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultipartFile('.testfile.dat', {
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
                nock('http://test-status-201')
                    .matchHeader('content-length', 8)
                    .put('/path/to/file-1.ext', 'hello wo')
                    .reply(201);
                nock('http://test-status-201')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultipartFile('.testfile.dat', {
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
                nock('http://test-status-201')
                    .matchHeader('content-length', 7)
                    .put('/path/to/file-2.ext', 'rld 123')
                    .reply(201);

                await uploadMultipartFile('.testfile.dat', {
                    maxPartSize: 14,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ]
                });
            } catch (e) {
                assert.strictEqual(e.message, 'Upload to \'http://test-status-201/path/to/file-1.ext\' failed with status 404');
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

                await uploadMultipartFile('.testfile.dat', {
                    maxPartSize: 14,
                    urls: [
                        'http://test-status-201/path/to/file-1.ext',
                        'http://test-status-201/path/to/file-2.ext'
                    ]
                });
            } catch (e) {
                assert.strictEqual(e.message, 'Upload to \'http://test-status-201/path/to/file-2.ext\' failed with status 404');
            }
        })
    })
})
