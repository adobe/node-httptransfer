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
const nock = require('nock');
const { parseResourceHeaders, getResourceHeaders } = require('../lib/headers');

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
        it('content-size-none', function() {
            const result = parse({});
            assert.strictEqual(result.size, 0);
        })
        it('content-size-empty', function() {
            const result = parse({
                'content-length': ''
            });
            assert.strictEqual(result.size, 0);
        })
        it('content-size-invalid', function() {
            const result = parse({
                'content-length': 'abc'
            });
            assert.strictEqual(result.size, 0);
        })
        it('content-size-value', function() {
            const result = parse({
                'content-length': '100'
            });
            assert.strictEqual(result.size, 100);
        })
    })
})
