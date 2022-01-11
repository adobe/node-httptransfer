/*
 * Copyright 2021 Adobe. All rights reserved.
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

'use strict';

const assert = require("assert");
const DownloadError = require("../../lib/block/download-error");
const errorCodes = require("../../lib/http-error-codes");

describe('Download Error', function() {
    function verifyCodes(httpStatus, expectedCode) {
        const downloadError = DownloadError.fromError({ status: httpStatus });
        assert.strictEqual(downloadError.getCode(), expectedCode);
        assert.strictEqual(downloadError.getHttpStatusCode(), httpStatus);
    }

    it('from error', function() {
        let downloadError = new DownloadError('testing', 404);
        assert.strictEqual(DownloadError.fromError(downloadError), downloadError);
        verifyCodes(404, errorCodes.NOT_FOUND);
        verifyCodes(409, errorCodes.ALREADY_EXISTS);
        verifyCodes(403, errorCodes.FORBIDDEN);
        verifyCodes(400, errorCodes.INVALID_OPTIONS);
        verifyCodes(401, errorCodes.NOT_AUTHORIZED);
        verifyCodes(501, errorCodes.NOT_SUPPORTED);
        verifyCodes(413, errorCodes.TOO_LARGE);
        verifyCodes(500, errorCodes.UNKNOWN);
        verifyCodes(429, errorCodes.TOO_MANY_REQUESTS);
        assert.strictEqual(DownloadError.fromError({ response: { status: 500 } }).getCode(), errorCodes.UNKNOWN);

        downloadError = DownloadError.fromError({
            message: 'test error',
            code: 'MY CODE'
        }, 'My Overall Message');
        assert.strictEqual(downloadError.getMessage(), 'My Overall Message: test error');
        assert.strictEqual(downloadError.getCode(), 'MY CODE');

        downloadError = DownloadError.fromError({
            message: 'test error'
        });
        assert.strictEqual(downloadError.getMessage(), 'test error');
        assert.strictEqual(downloadError.getCode(), errorCodes.UNKNOWN);

        downloadError = DownloadError.fromError('some error');
        assert.strictEqual(downloadError.getMessage(), 'some error');
        assert.strictEqual(downloadError.getCode(), errorCodes.UNKNOWN);

        const randomError = { hello: 'world!' };
        downloadError = DownloadError.fromError(randomError);
        assert.strictEqual(downloadError.getMessage(), JSON.stringify(randomError));
        assert.strictEqual(downloadError.getCode(), errorCodes.UNKNOWN);
    });

    it('to json', function() {
        let downloadError = new DownloadError('testing', errorCodes.ALREADY_EXISTS);
        let errorJson = downloadError.toJSON();
        assert.strictEqual(errorJson.message, 'testing');
        assert.strictEqual(errorJson.code, errorCodes.ALREADY_EXISTS);
        assert(!errorJson.innerStack);

        downloadError = new DownloadError('testing again', errorCodes.NOT_AUTHORIZED, 'inner stack');
        errorJson = downloadError.toJSON();
        assert.strictEqual(errorJson.message, 'testing again');
        assert.strictEqual(errorJson.code, errorCodes.NOT_AUTHORIZED);
        assert.strictEqual(errorJson.innerStack, 'inner stack');
        assert.strictEqual(downloadError.toString(), JSON.stringify(errorJson));
        assert.strictEqual(downloadError.getInnerStack(), 'inner stack');
    });
});
