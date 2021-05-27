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
const { calculatePartSize } = require("../lib/aempartsize");

describe.only("aempartsize", () => {
    describe("calculatePartSize", () => {
        it("num-urls wrong type", () => {
            assert.strict.throws(() => {
                calculatePartSize("1", 1000, 10, 10000);
            }, Error("'numUrls' must be a positive number: 1 (string)"));
        });
        it("num-urls 0", () => {
            assert.strict.throws(() => {
                calculatePartSize(0, 1000, 10, 10000);
            }, Error("'numUrls' must be a positive number: 0 (number)"));
        });
        it("fileSize wrong type", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, "1000", 10, 10000);
            }, Error("'fileSize' must be a positive number: 1000 (string)"));
        });
        it("fileSize 0", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, 0, 10, 10000);
            }, Error("'fileSize' must be a positive number: 0 (number)"));
        });
        it("minPartSize wrong type", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, 1000, "10", 10000);
            }, Error("'minPartSize' must be a positive number: 10 (string)"));
        });
        it("minPartSize 0", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, 1000, 0, 10000);
            }, Error("'minPartSize' must be a positive number: 0 (number)"));
        });
        it("maxPartSize wrong type", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, 1000, 10, "10000");
            }, Error("'maxPartSize' must be larger or equal to 'minPartSize' (minPartSize=10): 10000 (string)"));
        });
        it("maxPartSize too small", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, 1000, 10, 5);
            }, Error("'maxPartSize' must be larger or equal to 'minPartSize' (minPartSize=10): 5 (number)"));
        });
        it("preferredPartSize wrong type", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, 1000, 10, 10000, "5");
            }, Error("'preferredPartSize' must be a positive number: 5 (string)"));
        });
        it("preferredPartSize 0", () => {
            assert.strict.throws(() => {
                calculatePartSize(1, 1000, 10, 10000, -1);
            }, Error("'minPartSize' must be a positive number: -1 (number)"));
        });
    });
});
