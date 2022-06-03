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

"use strict";

const assert = require("assert");
const util = require("../lib/util");
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require("events");
const { TransferMemoryBuffer } = require('../lib/transfer-memory-allocator');

describe("util", function() {
    it('createReadStream-error', async function() {
        try {
            await util.createReadStream("badfile");
            assert.fail("failure expected");
        } catch (e) {
            assert.ok(e.message.includes("ENOENT: no such file or directory"), e.message);
        }
    });

    it('creates a read stream', async function() {
        await fs.writeFile(path.resolve('./test-transfer-file-read-1.dat'), 'hello world 123', 'utf8');
        const readStream = await util.createReadStream(path.resolve('./test-transfer-file-read-1.dat'));

        assert.ok(readStream.flags === 'r');

        readStream.destroy();
        assert.ok(readStream.destroyed);

        try {
            await fs.unlink(path.resolve('./test-transfer-file-read-1.dat'));
        } catch(e){
            // ignore clean-up error
            console.log(e);
        }
    });

    it('createWriteStream-error', async function() {
        try {
            await util.createWriteStream("badfolder/badfile");
            assert.fail("failure expected");
        } catch (e) {
            assert.ok(e.message.includes("ENOENT: no such file or directory"), e.message);
        }
    });

    it('creates a write stream', async function() {
        //await fs.writeFile(path.resolve('./test-transfer-file.dat'), 'hello world 123', 'utf8');
        const writeStream = await util.createWriteStream(path.resolve('./test-transfer-file-write-1.dat'));

        assert.ok(writeStream.flags === 'w');

        writeStream.destroy();
        assert.ok(writeStream.destroyed);

        try {
            await fs.unlink(path.resolve('./test-transfer-file-write-1.dat'));
        } catch(e){
            // ignore clean-up error
            console.log(e);
        }
    });

    it('file-protocol-string', function() {
        assert.ok(util.isFileProtocol('file:///path/to/file'));
    });

    it('file-protocol-url', function() {
        assert.ok(util.isFileProtocol(new URL('file:///path/to/file')));
    });

    it('file-protocol-undefined', function() {
        assert.ok(!util.isFileProtocol());
    });

    it('file-protocol-string-http', function() {
        assert.ok(!util.isFileProtocol('http://www.host.com'));
    });

    it('file-protocol-url-http', function() {
        assert.ok(!util.isFileProtocol(new URL('http://www.host.com')));
    });

    function configureStream(toExecute) {
        const stream = new EventEmitter();
        const origOn = stream.on;
        stream.on = (name, data) => {
            origOn.call(stream, name, data);
            if (name === 'data') {
                toExecute(stream);
            }
        };
        return stream;
    }

    it('stream-to-buffer', async function() {
        const stream = configureStream((stream) => {
            stream.emit('data', Buffer.from('Hello W'));
            stream.emit('data', Buffer.from('orld!'));
            stream.emit('end');
        });

        const buffer = await util.streamToBuffer("get", "url", 200, stream, 12);
        assert.deepStrictEqual(buffer.toString(), 'Hello World!');
    });

    it('stream-to-error-buffer', function() {
        const stream = configureStream((stream) => {
            stream.emit('error', 'there was an error!');
        });
        assert.rejects(util.streamToBuffer("get", "url", 200, stream, 12));
    });
    
    it('stream-to-unexpectedlength-buffer', function() {
        const stream = configureStream((stream) => {
            stream.emit('data', 'test');
            stream.emit('end');
        });
        assert.rejects(util.streamToBuffer("get", "url", 200, stream, 12));
    });

    it('stream-to-pooled-buffer', async function() {
        const stream = configureStream((stream) => {
            stream.emit('data', Buffer.from('Hello W'));
            stream.emit('data', Buffer.from('orld!'));
            stream.emit('end');
        });

        const memoryAllocator = new TransferMemoryBuffer(20);
        const memoryBufferBlock = await util.streamToPooledBuffer("get", "url", 200, stream, 12, memoryAllocator);
        assert.deepStrictEqual(memoryBufferBlock.buffer.toString(), 'Hello World!');
    });

    it('stream-to-error-pooled-buffer', function() {
        const stream = configureStream((stream) => {
            stream.emit('error', 'there was an error!');
        });
        const memoryAllocator = new TransferMemoryBuffer(15);
        assert.rejects(util.streamToPooledBuffer("get", "url", 200, stream, 12, memoryAllocator));
    });
    
    it('stream-to-unexpectedlength-pooled-buffer', function() {
        const stream = configureStream((stream) => {
            stream.emit('data', 'test');
            stream.emit('end');
        });
        const memoryAllocator = new TransferMemoryBuffer(14);
        assert.rejects(util.streamToPooledBuffer("get", "url", 200, stream, 12, memoryAllocator));
    });

    it('stream-to-buffer (stream to pooled buffer fallback when no memory allocator)', async function() {
        const stream = configureStream((stream) => {
            stream.emit('data', Buffer.from('Hello W'));
            stream.emit('data', Buffer.from('orld!'));
            stream.emit('end');
        });

        const buffer = await util.streamToPooledBuffer("get", "url", 200, stream, 12);
        assert.deepEqual(buffer.toString(), 'Hello World!');
    });

    it('stream-to-error-buffer (stream to pooled buffer fallback when no memory allocator)', function() {
        const stream = configureStream((stream) => {
            stream.emit('error', 'there was an error!');
        });
        assert.rejects(util.streamToPooledBuffer("get", "url", 200, stream, 12));
    });
    
    it('stream-to-unexpectedlength-buffer (stream to pooled buffer fallback when no memory allocator)', function() {
        const stream = configureStream((stream) => {
            stream.emit('data', 'test');
            stream.emit('end');
        });
        assert.rejects(util.streamToPooledBuffer("get", "url", 200, stream, 12));
    });

    it('url to path', function() {
        assert.deepStrictEqual(util.urlToPath('http://host/test%20space/path'), {
            path: '/test space/path',
            name: 'path',
            parentPath: '/test space',
        });
        assert.deepStrictEqual(util.urlToPath('file:///test%20space/path'), {
            path: `${path.sep}test space${path.sep}path`,
            name: 'path',
            parentPath: `${path.sep}test space`,
        });
        assert.deepStrictEqual(util.urlToPath('file:///C:/test%20space/path'), {
            path: `C:${path.sep}test space${path.sep}path`,
            name: 'path',
            parentPath: `C:${path.sep}test space`,
        });
    });

    it('url path dirname', function() {
        assert.strictEqual(util.urlPathDirname(`${path.sep}my${path.sep}test${path.sep}path`), '/my/test');
        assert.strictEqual(util.urlPathDirname(`${path.sep}my${path.sep}test${path.sep}file.jpg`), '/my/test');
        assert.strictEqual(util.urlPathDirname('/my/test/path'), '/my/test');
        assert.strictEqual(util.urlPathDirname('/my/test/file.jpg'), '/my/test');
    });
});
