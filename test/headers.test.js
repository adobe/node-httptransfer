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
const { parseResourceHeaders } = require('../lib/headers');

function parse(headers) {
    return parseResourceHeaders({
        get: name => headers[name]
    })
}

describe('headers', function() {
    describe('parseResourceHeaders', function() {
        it('content-disposition-none', function() {
            const result = parse({});
            assert.strictEqual(result.filename, null);
        })        
        it('content-disposition-empty', function() {
            const result = parse({
                'content-disposition': ''
            });
            assert.strictEqual(result.filename, null);
        })
        it('content-disposition-filename', function() {
            const result = parse({
                'content-disposition': 'attachment; filename="filename.jpg"'
            });
            assert.strictEqual(result.filename, 'filename.jpg');
        })
        it('content-disposition-unicode', function() {
            const result = parse({
                'content-disposition': 'attachment; filename*=UTF-8\'\'Na%C3%AFve%20file.txt'
            });
            assert.strictEqual(result.filename, 'Naïve file.txt');
        })
        it('content-type-none', function() {
            const result = parse({});
            assert.strictEqual(result.mimetype, 'application/octet-stream');
        })   
        it('content-type-empty', function() {
            const result = parse({
                'content-type': ''
            });
            assert.strictEqual(result.mimetype, 'application/octet-stream');
        })      
        it('content-type-jpeg', function() {
            const result = parse({
                'content-type': 'image/jpeg'
            });
            assert.strictEqual(result.mimetype, 'image/jpeg');
        }) 
        it('content-range-none', function() {
            const result = parse({});
            assert.strictEqual(result.size, 0);
        })
        it('content-range-empty', function() {
            const result = parse({
                'content-range': ''
            });
            assert.strictEqual(result.size, 0);
        })
        it('content-range-invalid', function() {
            const result = parse({
                'content-range': 'abc'
            });
            assert.strictEqual(result.size, 0);
        })
        it('content-range-value', function() {
            const result = parse({
                'content-range': 'bytes 0-0/100'
            });
            assert.strictEqual(result.size, 100);
        })
    })
})
