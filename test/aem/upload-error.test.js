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
const UploadError = require("../../lib/block/upload-error");
const errorCodes = require("../../lib/http-error-codes");

describe('Upload Error', function() {
    function verifyCodes(httpStatus, expectedCode) {
        const uploadError = UploadError.fromError({ status: httpStatus });
        assert.strictEqual(uploadError.getCode(), expectedCode);
        assert.strictEqual(uploadError.getHttpStatusCode(), httpStatus);
    }

    it('from error', function() {
        let uploadError = new UploadError('testing', 404);
        assert.strictEqual(UploadError.fromError(uploadError), uploadError);
        verifyCodes(404, errorCodes.NOT_FOUND);
        verifyCodes(409, errorCodes.ALREADY_EXISTS);
        verifyCodes(403, errorCodes.FORBIDDEN);
        verifyCodes(400, errorCodes.INVALID_OPTIONS);
        verifyCodes(401, errorCodes.NOT_AUTHORIZED);
        verifyCodes(501, errorCodes.NOT_SUPPORTED);
        verifyCodes(413, errorCodes.TOO_LARGE);
        verifyCodes(500, errorCodes.UNKNOWN);
        assert.strictEqual(UploadError.fromError({ response: { status: 500 } }).getCode(), errorCodes.UNKNOWN);

        uploadError = UploadError.fromError({
            message: 'test error',
            code: 'MY CODE'
        }, 'My Overall Message');
        assert.strictEqual(uploadError.getMessage(), 'My Overall Message: test error');
        assert.strictEqual(uploadError.getCode(), 'MY CODE');

        uploadError = UploadError.fromError({
            message: 'test error'
        });
        assert.strictEqual(uploadError.getMessage(), 'test error');
        assert.strictEqual(uploadError.getCode(), errorCodes.UNKNOWN);

        uploadError = UploadError.fromError('some error');
        assert.strictEqual(uploadError.getMessage(), 'some error');
        assert.strictEqual(uploadError.getCode(), errorCodes.UNKNOWN);

        const randomError = { hello: 'world!' };
        uploadError = UploadError.fromError(randomError);
        assert.strictEqual(uploadError.getMessage(), JSON.stringify(randomError));
        assert.strictEqual(uploadError.getCode(), errorCodes.UNKNOWN);
    });

    it('to json', function() {
        let uploadError = new UploadError('testing', errorCodes.ALREADY_EXISTS);
        let errorJson = uploadError.toJSON();
        assert.strictEqual(errorJson.message, 'testing');
        assert.strictEqual(errorJson.code, errorCodes.ALREADY_EXISTS);
        assert(!errorJson.innerStack);

        uploadError = new UploadError('testing again', errorCodes.NOT_AUTHORIZED, 'inner stack');
        errorJson = uploadError.toJSON();
        assert.strictEqual(errorJson.message, 'testing again');
        assert.strictEqual(errorJson.code, errorCodes.NOT_AUTHORIZED);
        assert.strictEqual(errorJson.innerStack, 'inner stack');
        assert.strictEqual(uploadError.toString(), JSON.stringify(errorJson));
        assert.strictEqual(uploadError.getInnerStack(), 'inner stack');
    });
});
