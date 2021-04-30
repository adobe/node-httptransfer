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

"use strict";

const { AsyncGeneratorFunction } = require("../generator/function");
const { isFileProtocol } = require("../util");

/**
 * Close file handles of completed assets
 */
class CloseFiles extends AsyncGeneratorFunction {
    /**
     * Construct the CloseFiles function.
     * 
     * @param {RandomFileAccess} randomFileAccess Random file access instance
     */
    constructor(randomFileAccess) {
        super();
        this.randomFileAccess = randomFileAccess;
    }

    /**
     * Close file handles of completed transfer assets
     * 
     * @generator
     * @param {TransferAsset} transferAssets Completed transfer assets
     * @yields {TransferAsset} 
     */
    async* execute(transferAssets) {
        for await (const transferAsset of transferAssets) {
            if (isFileProtocol(transferAsset.source.url)) {
                await this.randomFileAccess.close(transferAsset.source.url);
            }
            if (isFileProtocol(transferAsset.target.url)) {
                await this.randomFileAccess.close(transferAsset.target.url);
            }
            yield transferAsset;
        }
    }
}

module.exports = {
    CloseFiles
};