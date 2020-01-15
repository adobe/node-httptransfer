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
const stream = require('stream');
const { testSetResponseBodyOverride, testHasResponseBodyOverrides } = require('../lib/fetch');
const { downloadStream, uploadStream, transferStream } = require('../lib/stream');
const { 
    StringReadable, 
    StringWritable, 
    createErrorReadable, 
    createErrorWritable 
} = require('./streams');

describe('stream', function() {
    describe('download', function() {
        afterEach(function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
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
        it('status-200-truncate', async function() {
            try {
                nock('http://test-status-200-truncate')
                    .get('/path/to/file.ext')
                    .reply(200, "Hello World", {
                        'content-length': 100
                    });
    
                const writeStream = new StringWritable();
                await downloadStream('http://test-status-200-truncate/path/to/file.ext', writeStream);
                assert.fail('failure expected');
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-status-200-truncate/path/to/file.ext\' stream 200 response failed: Response truncated at 11 bytes, received 100 bytes');
            }
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
                assert.ok(e.message.startsWith('GET \'http://badhost/path/to/file.ext\' connect failed: request to http://badhost/path/to/file.ext failed, reason: getaddrinfo ENOTFOUND badhost'));
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
                assert.strictEqual(e.message, 'GET \'http://test-timeout/path/to/file.ext\' connect failed: network timeout at: http://test-timeout/path/to/file.ext');
            }
        })
        it('reply-error', async function() {
            try {
                nock('http://test-reply-error')
                    .get('/path/to/file.ext')
                    .replyWithError({
                        code: 'ECONNRESET',
                        message: 'Connection Reset'
                    });
    
                const writeStream = new StringWritable();
                await downloadStream('http://test-reply-error/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-reply-error/path/to/file.ext\' connect failed: request to http://test-reply-error/path/to/file.ext failed, reason: Connection Reset');
            }
        })
        it('200-stream-error', async function() {
            try {
                const replyBody = new stream.PassThrough();
                nock('http://test-200-stream-error')
                    .get('/path/to/file.ext')
                    .reply(200, replyBody);

                // replyBody.end(() => {
                //     replyBody.emit('error', Error('read failure'));
                // })

                testSetResponseBodyOverride("GET", createErrorReadable(Error('read failure')));
                const writeStream = new StringWritable();
                await downloadStream(`http://test-200-stream-error/path/to/file.ext`, writeStream);
                assert.fail('failure expected');
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-200-stream-error/path/to/file.ext\' stream 200 response failed: read failure');
            }
        })
        it('404-stream-error', async function() {
            try {
                const replyBody = new stream.PassThrough();
                nock('http://test-404-stream-error')
                    .get('/path/to/file.ext')
                    .reply(404, replyBody, {
                        'Content-Type': 'text/plain'
                    });

                // replyBody.end(() => {
                //     replyBody.emit('error', Error('read failure'));
                // })
        
                testSetResponseBodyOverride("GET", createErrorReadable(Error('read failure')));
                const writeStream = new StringWritable();
                await downloadStream('http://test-404-stream-error/path/to/file.ext', writeStream);
                assert.fail('failure expected');
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-404-stream-error/path/to/file.ext\' stream 404 response failed: Error: read failure');
            }
        })
        it('200-stream-write-error', async function() {
            try {
                nock('http://test-200-stream-write-error')
                    .get('/path/to/file.ext')
                    .reply(200, 'hello world');
    
                const writeStream = createErrorWritable(Error('write failure'))
                await downloadStream('http://test-200-stream-write-error/path/to/file.ext', writeStream);
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'GET \'http://test-200-stream-write-error/path/to/file.ext\' stream 200 response failed: write failure');
            }
        })
    })
    describe('upload', function() {
        afterEach(function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
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
                assert.ok(e.message.startsWith('PUT \'http://badhost/path/to/file.ext\' connect failed: request to http://badhost/path/to/file.ext failed, reason: getaddrinfo ENOTFOUND badhost'));
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
                assert.strictEqual(e.message, 'PUT \'http://test-timeout/path/to/file.ext\' connect failed: network timeout at: http://test-timeout/path/to/file.ext');
            }
        })
        it('201-stream-error', async function() {
            const replyBody = new stream.PassThrough();
            nock('http://test-201-stream-error')
                .put('/path/to/file.ext', 'hello world 123')
                .reply(201, replyBody);

            // replyBody.end(() => {
            //     replyBody.emit('error', Error('read failure'));
            // })

            // successful response is ignored, which means no error is thrown by uploadStream
            // but the overridden response body is still retrieved
            testSetResponseBodyOverride("PUT", createErrorReadable(Error('read failure')));
            const readStream = new StringReadable('hello world 123');
            await uploadStream(readStream, 'http://test-201-stream-error/path/to/file.ext');
        })
        it('404-stream-error', async function() {
            try {
                const replyBody = new stream.PassThrough();
                nock('http://test-404-stream-error')
                    .put('/path/to/file.ext', 'hello world 123')
                    .reply(404, replyBody, {
                        'Content-Type': 'text/plain'
                    });

                // replyBody.end(() => {
                //     replyBody.emit('error', Error('read failure'));
                // })

                testSetResponseBodyOverride("PUT", createErrorReadable(Error('read failure')));
                const readStream = new StringReadable('hello world 123');
                await uploadStream(readStream, 'http://test-404-stream-error/path/to/file.ext');
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-404-stream-error/path/to/file.ext\' stream 404 response failed: Error: read failure');
            }
        })
        // node-fetch doesn't handle stream errors well, they are not caught
        // eslint-disable-next-line mocha/no-exclusive-tests
        it.skip('201-stream-read-error', async function() {
            try {
                nock('http://test-201-stream-read-error')
                    .put('/path/to/file.ext', 'hello world 123')
                    .reply(201, 'hello world');
    
                const readStream = createErrorReadable(Error('201 read failure'));
                await uploadStream(readStream, 'http://test-201-stream-read-error/path/to/file.ext');
                assert.fail('failure expected')
            } catch (e) {
                assert.strictEqual(e.message, 'PUT \'http://test-201-stream-read-error/path/to/file.ext\' failed: 201 read failure');
            }
        })
    })    
    describe('transfer', function() {
        afterEach(async function() {
            assert.ok(!testHasResponseBodyOverrides(), 'ensure no response body overrides are in place');
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
        it('transfer-503-retry-get', async function() {
            nock('http://test-transfer-503')
                .get('/path/to/source.ext')
                .reply(503);
            nock('http://test-transfer-503')
                .get('/path/to/source.ext')
                .reply(200, 'hello world', {
                    "content-range": "bytes 0-0/11"
                });

            nock('http://test-transfer-503')
                .matchHeader('content-length', 11)
                .put('/path/to/target.ext', 'hello world')
                .reply(201, 'goodbye');

            await transferStream(
                'http://test-transfer-503/path/to/source.ext', 
                'http://test-transfer-503/path/to/target.ext'
            );
        })    
        it('transfer-503-retry-put', async function() {
            nock('http://test-transfer-503')
                .get('/path/to/source.ext')
                .reply(200, 'hello world', {
                    "content-range": "bytes 0-0/11"
                });
            nock('http://test-transfer-503')
                .get('/path/to/source.ext')
                .reply(200, 'hello world', {
                    "content-range": "bytes 0-0/11"
                });

            nock('http://test-transfer-503')
                .matchHeader('content-length', 11)
                .put('/path/to/target.ext', 'hello world')
                .reply(503);
            nock('http://test-transfer-503')
                .matchHeader('content-length', 11)
                .put('/path/to/target.ext', 'hello world')
                .reply(201, 'goodbye');

            await transferStream(
                'http://test-transfer-503/path/to/source.ext', 
                'http://test-transfer-503/path/to/target.ext'
            );
        })
        it('transfer-404-retry-get-put', async function() {
            nock('http://test-transfer-404')
                .get('/path/to/source.ext')
                .reply(404);
            nock('http://test-transfer-404')
                .get('/path/to/source.ext')
                .reply(200, 'hello world', {
                    "content-range": "bytes 0-0/11"
                });
            nock('http://test-transfer-404')
                .get('/path/to/source.ext')
                .reply(200, 'hello world', {
                    "content-range": "bytes 0-0/11"
                });

            nock('http://test-transfer-404')
                .matchHeader('content-length', 11)
                .put('/path/to/target.ext', 'hello world')
                .reply(404);
            nock('http://test-transfer-404')
                .matchHeader('content-length', 11)
                .put('/path/to/target.ext', 'hello world')
                .reply(201, 'goodbye');

            await transferStream(
                'http://test-transfer-404/path/to/source.ext', 
                'http://test-transfer-404/path/to/target.ext', {
                    retryAllErrors: true
                }
            );
        })              
    })
})
