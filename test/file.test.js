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
const { downloadFile, uploadFile } = require('../lib/file');

describe('file', function() {
    describe('download', function() {
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
        it('status-200', async function() {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');
    
            await downloadFile('http://test-status-200/path/to/file.ext', '.testfile.dat');
            const result = await fs.readFile('.testfile.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
        })
        it('status-200-mkdir', async function() {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');
    
            await downloadFile('http://test-status-200/path/to/file.ext', '.testdir/.testfile.dat', {
                mkdirs: true
            });
            const result = await fs.readFile('.testdir/.testfile.dat', 'utf8');
            assert.strictEqual(result, 'hello world');
            await fs.unlink('.testdir/.testfile.dat');
            await fs.rmdir('.testdir');
        })
        it('status-404', async function() {
            try {
                nock('http://test-status-404')
                    .get('/path/to/file.ext')
                    .reply(404, 'hello world');
        
                await downloadFile('http://test-status-404/path/to/file.ext', '.testfile.dat');
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-status-404/path/to/file.ext\' failed with status 404');
                const result = await fs.readFile('.testfile.dat', 'utf8');
                assert.strictEqual(result, '');
            }
        })
    })
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
        it('status-201', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);
    
            await uploadFile('.testfile.dat', 'http://test-status-201/path/to/file.ext');
        })
        it('status-201-header', async function() {
            nock('http://test-status-201')
                .matchHeader('content-length', 15)
                .matchHeader('content-type', 'image/jpeg')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);
    
            await uploadFile('.testfile.dat', 'http://test-status-201/path/to/file.ext', {
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
                await uploadFile('.testfile.dat', 'http://test-status-404/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-status-404/path/to/file.ext\' failed with status 404');
            }
        })
    })
})
