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
const { Asset } = require('../../lib/asset/asset');
const { TransferAsset } = require('../../lib/asset/transferasset');
const { TransferPart } = require('../../lib/asset/transferpart');
const DRange = require("drange");
const { TransferController } = require('../../lib/controller/transfercontroller');

describe("TransferController", function() {
    describe("asset transfer times", () => {
        it("part initiates transfer start time", () => {
            const source = new Asset("file:///C:/path/to/source.png");
            const target = new Asset("http://host/path/to/target.png");
            const transferAsset = new TransferAsset(source, target);
            const transferPart = new TransferPart(transferAsset, [new URL("http:/host/part")], new DRange());
            const controller = new TransferController();
            assert.strictEqual(controller.getTransferStartTime(transferAsset), 0);
            controller.transferringPart(transferPart);
            assert.notStrictEqual(controller.getTransferStartTime(transferAsset), 0);
        });
    });
});
