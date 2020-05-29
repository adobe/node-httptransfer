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

describe("util", function() {
    it("createReadStream-error", async function() {
        try {
            await util.createReadStream("badfile");
            assert.fail("failure expected");
        } catch (e) {
            assert.ok(e.message.includes("ENOENT: no such file or directory"), e.message);
        }
    });

    it("creates a read stream", async function() {
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

    it("createWriteStream-error", async function() {
        try {
            await util.createWriteStream("badfolder/badfile");
            assert.fail("failure expected");
        } catch (e) {
            assert.ok(e.message.includes("ENOENT: no such file or directory"), e.message);
        }
    });

    it("creates a write stream", async function() {
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
});
