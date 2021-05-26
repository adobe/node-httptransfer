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

"use strict";

const assert = require("assert");
const { NameConflictPolicy } = require("../../lib/asset/nameconflictpolicy");

describe("NameConflictPolicy", function() {
    it("constructor no-arg", () => {
        const conflictPolicy = new NameConflictPolicy();
        assert.strictEqual(conflictPolicy.createVersion, false);
        assert.strictEqual(conflictPolicy.versionLabel, undefined);
        assert.strictEqual(conflictPolicy.versionComment, undefined);
        assert.strictEqual(conflictPolicy.replace, false);
    });
    it("constructor options", () => {
        const conflictPolicy = new NameConflictPolicy({
            createVersion: true,
            versionLabel: "versionLabel",
            versionComment: "versionComment",
            replace: true
        });
        assert.strictEqual(conflictPolicy.createVersion, true);
        assert.strictEqual(conflictPolicy.versionLabel, "versionLabel");
        assert.strictEqual(conflictPolicy.versionComment, "versionComment");
        assert.strictEqual(conflictPolicy.replace, true);
    });
    it("constructor invalid createVersion", () => {
        const conflictPolicy = new NameConflictPolicy({            
            createVersion: 123
        });
        assert.strictEqual(conflictPolicy.createVersion, true);
    });
    it("constructor invalid versionLabel", () => {
        assert.strict.throws(() => {
            new NameConflictPolicy({            
                versionLabel: 123
            });
        }, Error("versionLabel is expected to be a string: 123 (number)"));
    });
    it("constructor invalid versionComment", () => {
        assert.strict.throws(() => {
            new NameConflictPolicy({            
                versionComment: 123
            });
        }, Error("versionComment is expected to be a string: 123 (number)"));
    });
    it("constructor invalid replace", () => {
        const conflictPolicy = new NameConflictPolicy({            
            replace: 123
        });
        assert.strictEqual(conflictPolicy.replace, true);
    });
    it("createVersionPolicy no-arg", () => {
        const conflictPolicy = NameConflictPolicy.createVersionPolicy();
        assert.strictEqual(conflictPolicy.createVersion, true);
        assert.strictEqual(conflictPolicy.versionLabel, undefined);
        assert.strictEqual(conflictPolicy.versionComment, undefined);
        assert.strictEqual(conflictPolicy.replace, false);
    });
    it("createVersionPolicy args", () => {
        const conflictPolicy = NameConflictPolicy.createVersionPolicy("versionLabel", "versionComment");
        assert.strictEqual(conflictPolicy.createVersion, true);
        assert.strictEqual(conflictPolicy.versionLabel, "versionLabel");
        assert.strictEqual(conflictPolicy.versionComment, "versionComment");
        assert.strictEqual(conflictPolicy.replace, false);
    });
    it("createVersionPolicy invalid versionLabel", () => {
        assert.strict.throws(() => {
            NameConflictPolicy.createVersionPolicy(123);
        }, Error("versionLabel is expected to be a string: 123 (number)"));
    });
    it("createVersionPolicy invalid versionComment", () => {
        assert.strict.throws(() => {
            NameConflictPolicy.createVersionPolicy(undefined, 123);
        }, Error("versionComment is expected to be a string: 123 (number)"));
    });
    it("replaceAssetPolicy no-arg", () => {
        const conflictPolicy = NameConflictPolicy.replaceAssetPolicy();
        assert.strictEqual(conflictPolicy.createVersion, false);
        assert.strictEqual(conflictPolicy.versionLabel, undefined);
        assert.strictEqual(conflictPolicy.versionComment, undefined);
        assert.strictEqual(conflictPolicy.replace, true);
    });
});
