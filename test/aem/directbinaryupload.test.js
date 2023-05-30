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

const assert = require('assert');
const { DirectBinaryUpload } = require('../../lib/aem/directbinaryupload');

describe('AEM Binary Upload', function() {
    it('test get transfer options', function () {
        const upload = new DirectBinaryUpload({
            requestOptions: {
                myOption: 123,
            }
        });
        const transferOptions = upload.getTransferOptions();
        assert.ok(transferOptions);
        assert.ok(transferOptions.requestOptions);
        assert.equal(transferOptions.requestOptions.myOption, 123);
    });

    it('test get transfer options retryOptions', function () {
        const upload = new DirectBinaryUpload({
            requestOptions: {
                retryOptions: {
                    retryAllErrors: true,
                    invalidOption: true,
                }
            }
        });
        const transferOptions = upload.getTransferOptions();
        assert.ok(transferOptions);
        // confirm retryOption properties are added to main options object 
        assert.equal(transferOptions.retryAllErrors, true);
        // confirm invalid retry options are not passed on
        assert.strictEqual(transferOptions.invalidOption, undefined);
    });
});
