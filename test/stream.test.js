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
const nock = require('nock');
const { downloadStream, uploadStream, transferStream } = require('../lib/stream');
const { 
    StringReadable, 
    StringWritable, 
    createErrorReadable, 
    createErrorWritable 
} = require('./streams');

describe('stream', function() {
    describe('download', function() {
        afterEach(async function() {
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        })
        it('status-200', async function() {
            nock('http://test-status-200')
                .get('/path/to/file.ext')
                .reply(200, 'hello world');
    
            const writeStream = new StringWritable();
            await downloadStream('http://test-status-200/path/to/file.ext', writeStream);
            assert.strictEqual(writeStream.data, 'hello world');
        })
        it('status-200-empty', async function() {
            nock('http://test-status-200-empty')
                .get('/path/to/file.ext')
                .reply(200);
    
            const writeStream = new StringWritable();
            await downloadStream('http://test-status-200-empty/path/to/file.ext', writeStream);
            assert.strictEqual(writeStream.data, '');
        })
        it('status-404-empty', async function() {
            nock('http://test-status-404-empty')
                .get('/path/to/file.ext')
                .reply(404);
    
            try {
                const writeStream = new StringWritable();
                await downloadStream('http://test-status-404-empty/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-status-404-empty/path/to/file.ext\' failed with status 404');
            }
        })
        it('status-404-octet', async function() {
            nock('http://test-status-404-octet')
                .get('/path/to/file.ext')
                .reply(404, 'error message', {
                    'Content-Type': 'application/octet-stream'
                });
    
            try {
                const writeStream = new StringWritable();
                await downloadStream('http://test-status-404-octet/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-status-404-octet/path/to/file.ext\' failed with status 404');
            }
        })
        it('status-404-text', async function() {
            nock('http://test-status-404-text')
                .get('/path/to/file.ext')
                .reply(404, 'error message', {
                    'Content-Type': 'text/plain'
                });
    
            try {
                const writeStream = new StringWritable();
                await downloadStream('http://test-status-404-text/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-status-404-text/path/to/file.ext\' failed with status 404: error message');
            }
        })
        it('host-not-found', async function() {
            try {
                const writeStream = new StringWritable();
                await downloadStream('http://badhost/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'request to http://badhost/path/to/file.ext failed, reason: getaddrinfo ENOTFOUND badhost badhost:80');
            }
        })
        it('timeout-error', async function() {
            try {
                nock('http://test-timeout')
                    .get('/path/to/file.ext')
                    .delayConnection(500)
                    .reply(200, 'hello world');
    
                const writeStream = new StringWritable();
                await downloadStream('http://test-timeout/path/to/file.ext', writeStream, { timeout: 200 });
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'network timeout at: http://test-timeout/path/to/file.ext');
            }
        })
        // node-fetch uses a PassThrough stream, but any errors are not caught before 
        // the PassThrough stream leading to uncaught errors
        it.skip('200-stream-error', async function() {
            try {
                nock('http://test-200-stream-error')
                    .get('/path/to/file.ext')
                    .reply(200, () => {
                        return createErrorReadable(Error('200 read failure'))
                    });
    
                const writeStream = new StringWritable();
                await downloadStream('http://test-200-stream-error/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'Download \'http://test-200-stream-error/path/to/file.ext\' failed: 200 read failure');
            }
        })
        // node-fetch uses a PassThrough stream, but any errors are not caught before 
        // the PassThrough stream leading to uncaught errors
        it.skip('404-stream-error', async function() {
            try {
                nock('http://test-404-stream-error')
                    .get('/path/to/file.ext')
                    .reply(404, () => {
                        return createErrorReadable(Error('404 read failure'))
                    }, {
                        'Content-Type': 'text/plain'
                    });
        
                const writeStream = new StringWritable();
                await downloadStream('http://test-404-stream-error/path/to/file.ext', writeStream);
            } catch (e) {
                assert.strictEqual(e.message, 'Download \'http://test-404-stream-error/path/to/file.ext\' failed with status 404: 404 read failure');
            }
        })
        it('200-stream-write-error', async function() {
            try {
                nock('http://test-200-stream-write-error')
                    .get('/path/to/file.ext')
                    .reply(200, 'hello world');
    
                const writeStream = createErrorWritable(Error('200 write failure'))
                await downloadStream('http://test-200-stream-write-error/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-200-stream-write-error/path/to/file.ext\' failed with status 200: 200 write failure');
            }
        })
    })
    describe('upload', function() {
        afterEach(async function() {
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        })
        it('status-201', async function() {
            nock('http://test-status-201')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201, 'goodbye');
    
            const readStream = new StringReadable('hello world 123');
            await uploadStream(readStream, 'http://test-status-201/path/to/file.ext');
        })
        it('status-201-empty', async function() {
            nock('http://test-status-201-empty')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201);
    
            const readStream = new StringReadable('hello world 123');
            await uploadStream(readStream, 'http://test-status-201-empty/path/to/file.ext');
        })
        it('status-404-empty', async function() {
            nock('http://test-status-404-empty')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404);
    
            try {
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://test-status-404-empty/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-status-404-empty/path/to/file.ext\' failed with status 404');
            }
        })
        it('status-404-octet', async function() {
             nock('http://test-status-404-octet')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404, 'error message', {
                    'Content-Type': 'application/octet-stream'
                });
     
            try {
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://test-status-404-octet/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-status-404-octet/path/to/file.ext\' failed with status 404');
            }
        })
        it('status-404-text', async function() {
            nock('http://test-status-404-text')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(404, 'error message', {
                    'Content-Type': 'text/plain'
                });
    
            try {
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://test-status-404-text/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-status-404-text/path/to/file.ext\' failed with status 404: error message');
            }
        })
        it('host-not-found', async function() {
            try {
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://badhost/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'request to http://badhost/path/to/file.ext failed, reason: getaddrinfo ENOTFOUND badhost badhost:80');
            }
        })
        it('timeout-error', async function() {
            try {
                nock('http://test-timeout')
                    .put('/path/to/file.ext', 'hello world 123')
                    .delayConnection(500)
                    .reply(200, 'hello world');
    
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://test-timeout/path/to/file.ext', { timeout: 200 });
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'network timeout at: http://test-timeout/path/to/file.ext');
            }
        })
        // node-fetch uses a PassThrough stream, but any errors are not caught before 
        // the PassThrough stream leading to uncaught errors
        it.skip('201-stream-error', async function() {
            try {
                nock('http://test-201-stream-error')
                    .put('/path/to/file.ext', 'hello world 123')
                    .reply(201, () => {
                        return createErrorReadable(Error('201 read failure'))
                    });
    
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://test-201-stream-error/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-201-stream-error/path/to/file.ext\' failed: 201 read failure');
            }
        })
        // node-fetch uses a PassThrough stream, but any errors are not caught before 
        // the PassThrough stream leading to uncaught errors
        it.skip('404-stream-error', async function() {
            try {
                nock('http://test-404-stream-error')
                    .put('/path/to/file.ext', 'hello world 123')
                    .reply(404, () => {
                        return createErrorReadable(Error('404 read failure'))
                    }, {
                        'Content-Type': 'text/plain'
                    });
        
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://test-404-stream-error/path/to/file.ext');
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-404-stream-error/path/to/file.ext\' failed with status 404: 404 read failure');
            }
        })
        it.skip('201-stream-read-error', async function() {
            try {
                nock('http://test-201-stream-read-error')
                    .put('/path/to/file.ext', 'hello world 123')
                    .reply(201, 'hello world');
    
                const readStream = createErrorReadable(Error('201 read failure'))
                await uploadStream(readStream, 'http://test-201-stream-read-error/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-201-stream-read-error/path/to/file.ext\' failed: 201 read failure');
            }
        })
    })    
    describe('transfer', function() {
        afterEach(async function() {
            assert.ok(nock.isDone(), 'check if all nocks have been used');
            nock.cleanAll();
        })
        it('transfer-200', async function() {
            nock('http://test-transfer-200')
                .get('/path/to/source.ext')
                .reply(200, 'hello world', {
                    "content-range": "bytes 0-0/11"
                });

            nock('http://test-transfer-200')
                .matchHeader('content-length', 11)
                .put('/path/to/target.ext', 'hello world')
                .reply(201, 'goodbye');

            await transferStream(
                'http://test-transfer-200/path/to/source.ext', 
                'http://test-transfer-200/path/to/target.ext'
            );
        })
    })
})
