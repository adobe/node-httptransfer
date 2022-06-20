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
const path = require("path");

describe("util", function() {
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

    it('get minimum needed part size from multipart (min multipart size must fit in one memory transfer block)', function() {
        const options = {
            uploadFiles: [{
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 10,
                maxPartSize: 25
            }],
            headers: {
                // Asset Compute passes through content-type header
                'content-type': 'image/jpeg',
            },
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 7
        };

        const result = util.getMinimumMultipartPartSizeForTransfer(options, options.preferredPartSize);
        assert.ok(result, 10);
    });

    it('get minimum needed part size from multipart (min multipart size must fit in one memory transfer block, can use preferredPartSize)', function() {
        const options = {
            uploadFiles: [{
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 10,
                maxPartSize: 25
            }],
            headers: {
                // Asset Compute passes through content-type header
                'content-type': 'image/jpeg',
            },
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 11
        };

        const result = util.getMinimumMultipartPartSizeForTransfer(options, options.preferredPartSize);
        assert.ok(result, 11);
    });

    it('get minimum needed part size from multipart (min multipart size must fit in one memory transfer block, exact fit)', function() {
        const options = {
            uploadFiles: [{
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 10,
                maxPartSize: 25
            }],
            headers: {
                // Asset Compute passes through content-type header
                'content-type': 'image/jpeg',
            },
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 11
        };

        const result = util.getMinimumMultipartPartSizeForTransfer(options, options.preferredPartSize);
        assert.ok(result, 10);
    });

    it('get minimum needed part size from multipart (min multipart size must fit in one memory transfer block, multiple files)', function() {
        const options = {
            uploadFiles: [{
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 10,
                maxPartSize: 25
            }, {
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 12,
                maxPartSize: 25
            }],
            headers: {
                // Asset Compute passes through content-type header
                'content-type': 'image/jpeg',
            },
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 7
        };

        const result = util.getMinimumMultipartPartSizeForTransfer(options, options.preferredPartSize);
        assert.ok(result, 12);
    });

    it('get minimum needed part size from multipart (min multipart size must fit in one memory transfer block, can use preferred part size, multiple files)', function() {
        const options = {
            uploadFiles: [{
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 10,
                maxPartSize: 25
            }, {
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 12,
                maxPartSize: 25
            }, {
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 2,
                maxPartSize: 25
            }, {
                fileUrl: [],
                filePath: "a-path",
                multipartHeaders: { partHeader: 'test' },
                minPartSize: 5,
                maxPartSize: 25
            }],
            headers: {
                // Asset Compute passes through content-type header
                'content-type': 'image/jpeg',
            },
            concurrent: true,
            maxConcurrent: 5,
            preferredPartSize: 15
        };

        const result = util.getMinimumMultipartPartSizeForTransfer(options, options.preferredPartSize);
        assert.ok(result, 15);
    });
});
