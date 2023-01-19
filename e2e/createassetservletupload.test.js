/*
 * Copyright 2022 Adobe. All rights reserved.
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
const Path = require("path");
const {
    AEMUpload
} = require("../lib/index");
const {
    getAemEndpointNoDirectBinary,
    getAuthorizationHeaderNoDirectBinary,
    getUniqueTestId
} = require("./e2eutils");

const TIMEOUT = 60000; // 1 minute
const FILE_SIZE = 282584; // in bytes

describe('Create asset servlet e2e test', function() {
    this.timeout(TIMEOUT);
    function writeErrors(errors) {
        return errors.map((error) => error.code);
    }

    async function doCreateAssetServletUpload(fileUrls, partSize = 0) {
        // const createServletUpload = new CreateAssetServletUpload();
        const createServletUpload = new AEMUpload();
        const uploadStarts = [];
        const uploadProgresses = [];
        const uploadErrors = [];
        const uploadEnds = [];
        createServletUpload.on("filestart", (data) => {
            const { fileName, fileSize } = data;
            console.log(`Upload: start ${fileName}, ${fileSize} bytes`);
            uploadStarts.push(data);
        });
        createServletUpload.on("fileprogress", (data) => {
            const { fileName, fileSize, transferred } = data;
            uploadProgresses.push(data);
            console.log(`Upload: progress ${fileName}, ${transferred}/${fileSize} bytes`);
        });
        createServletUpload.on("fileend", (data) => {
            const { fileName, fileSize } = data;
            console.log(`Upload: completed ${fileName}, ${fileSize} bytes`);
            uploadEnds.push(data);
        });
        createServletUpload.on("fileerror", ({ fileName, errors }) => {
            console.log(`Upload: error ${fileName}`, writeErrors(errors));
            uploadErrors.push(errors);
        });
        await createServletUpload.uploadFiles({
            uploadFiles: fileUrls.map((fileUrl) => {
                return {
                    fileUrl,
                    fileSize: FILE_SIZE,
                    filePath: Path.join(__dirname, "images/freeride-siberia.jpg")
                };
            }),
            headers: getAuthorizationHeaderNoDirectBinary(),
            concurrent: true,
            maxConcurrent: 16,
            preferredPartSize: partSize
        });
        return {
            uploadErrors,
            uploadEnds,
            uploadStarts,
            uploadProgresses
        };
    }

    function verifyEventsHas(events, fileName) {
        for (let i = 0; i < events.length; i++) {
            if (events[i].fileName === fileName) {
                return;
            }
        }
        console.log(JSON.stringify(events, null, 2));
        assert.ok(false, `event list does not contain file ${fileName}`);
    }

    it('Create asset servlet upload with single request', async function () {
        const testId = getUniqueTestId();
        const fileName = `${testId}.jpg`;
        const fileUrl = `${getAemEndpointNoDirectBinary()}/content/dam/${fileName}`;
        const {
            uploadErrors,
            uploadEnds,
            uploadStarts,
            uploadProgresses
        } = await doCreateAssetServletUpload([fileUrl]);
        assert.strictEqual(uploadErrors.length, 0);
        assert.strictEqual(uploadEnds.length, 1);
        assert.strictEqual(uploadStarts.length, 1);
        assert.ok(uploadProgresses.length >= 1);

        verifyEventsHas(uploadStarts, fileName);
        verifyEventsHas(uploadProgresses, fileName);
        verifyEventsHas(uploadEnds, fileName);
    });

    it('Create asset servlet upload with chunked requests', async function () {
        const testId = getUniqueTestId();
        const fileName1 = `${testId}-1.jpg`;
        const fileName2 = `${testId}-2.jpg`;
        const fileUrl1 = `${getAemEndpointNoDirectBinary()}/content/dam/${fileName1}`;
        const fileUrl2 = `${getAemEndpointNoDirectBinary()}/content/dam/${fileName2}`;
        const {
            uploadErrors,
            uploadEnds,
            uploadStarts,
            uploadProgresses
        } = await doCreateAssetServletUpload([fileUrl1, fileUrl2], 200000);
        assert.strictEqual(uploadErrors.length, 0);
        assert.strictEqual(uploadEnds.length, 2);
        assert.strictEqual(uploadStarts.length, 2);
        assert.ok(uploadProgresses.length >= 2);

        verifyEventsHas(uploadStarts, fileName1);
        verifyEventsHas(uploadStarts, fileName2);
        verifyEventsHas(uploadProgresses, fileName1);
        verifyEventsHas(uploadProgresses, fileName2);
        verifyEventsHas(uploadEnds, fileName1);
        verifyEventsHas(uploadEnds, fileName2);
    });
});
