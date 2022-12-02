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
const fs = require("fs").promises;
const nock = require("nock");
const Path = require("path");
const { AEMUpload } = require("../../lib/aem/aemupload");
const { directBinaryAccessNotEnabled } = require("../testutils");

const HOST = "http://somereallyfakedomainfortestingcreateassetuploads.com";

describe("Create Asset Servlet Upload", function() {
    this.timeout(10000);
    let testFiles = [];
    let fileStart = {};
    let fileProgress = {};
    let fileEnd = {};
    let fileError = {};

    beforeEach(function () {
        testFiles = [];
        fileStart = {};
        fileProgress = {};
        fileEnd = {};
        fileError = {};
    });

    afterEach(async function () {
        assert.ok(nock.isDone(), 'check if all nocks have been used');
        for (let i = 0; i < testFiles.length; i++) {
            try {
                await fs.unlink(testFiles[i]);
            } catch (e) {
                console.log('Unable to delete test file', testFiles[i], e);
            }
        }
        nock.cleanAll();
    });

    /**
     * Creates a test file with the given name and content. The file will
     * be created in the current directory.
     * @param {string} fileName The name of the file to create.
     * @param {string} fileContent The file's content.
     */
    async function createTestFile(fileName, fileContent) {
        const testFile = Path.join(__dirname, fileName);
        await fs.writeFile(testFile, fileContent, "utf8");
        testFiles.push(testFile);
        return testFile;
    }

    /**
     * @typedef Form
     */

    /**
     * Attempts to parse a raw multipart request line into content disposition
     * information.
     * @param {string} line Raw line to parse.
     * @returns {boolean|Form} The form information if the line was recognized
     *  as the content disposition. Returns false if the line was not content
     *  disposition information.
     */
    function processContentDisposition(line) {
        if (line) {
            const CONTENT_DISPOSITION = "Content-Disposition: form-data; ";
            const lineStr = String(line);
            if (lineStr.startsWith(CONTENT_DISPOSITION)) {
                const formNamesStr = lineStr.substr(CONTENT_DISPOSITION.length);
                const formNames = formNamesStr
                    .split(" ")
                    .map((item) => {
                        if (item.endsWith(";")) {
                            return item.substr(0, item.length - 1);
                        }
                        return item;
                    });
                const formObject = {};
                formNames.forEach((formName) => {
                    const formValues = formName.split("=");
                    formObject[formValues[0]] = formValues[1].substr(1, formValues[1].length - 2);
                });
                return formObject;
            }
        }
        return false;
    }

    /**
     * @typedef Headers
     */

    /**
     * Parses a raw header string into its anem and value.
     * @param {string} line Raw header string.
     * @returns {Headers} Parsed header information.
     */
    function processHeader(line) {
        const headerValues = String(line).split(": ");
        const headerResult = {};
        headerResult[headerValues[0]] = headerValues[1];
        return headerResult;
    }

    /**
     * @typedef FormData
     * @property {Form} form Object whose keys are form property names, and whose values
     *  are the corresponding value.
     * @property {Headers} headers Object whose keys are header names, and whose values
     *  are the corresponding value.
     * @property {string} value The value of the form's content.
     */

    /**
     * Parses a multipart form request body and provides information about the
     * form.
     *
     * For example, assume the following raw form content:
     * ----------------------------414779918878718401199271
     * Content-Disposition: form-data; name="_charset_"
     *
     * utf-8
     * ----------------------------414779918878718401199271
     * Content-Disposition: form-data; name="file@Offset"
     *
     * 17
     * ----------------------------414779918878718401199271
     * Content-Disposition: form-data; name="chunk@Length"
     *
     * 4
     * ----------------------------414779918878718401199271
     * Content-Disposition: form-data; name="file@Length"
     *
     * 21
     * ----------------------------414779918878718401199271
     * Content-Disposition: form-data; name="file"; filename="testasset2.jpg"
     * Content-Type: image/jpeg
     *
     * 6789
     * ----------------------------414779918878718401199271--
     *
     * This content will yield the following object:
     * {
     *   "_charset_": {
     *     "form": {
     *       "name": "_charset_"
     *     },
     *     "headers": {},
     *     "value": "utf-8"
     *   },
     *   "file@Offset": {
     *     "form": {
     *       "name": "file@Offset"
     *     },
     *     "headers": {},
     *     "value": "17"
     *   },
     *   "chunk@Length": {
     *     "form": {
     *       "name": "chunk@Length"
     *     },
     *     "headers": {},
     *     "value": "4"
     *   },
     *   "file@Length": {
     *     "form": {
     *       "name": "file@Length"
     *     },
     *     "headers": {},
     *     "value": "21"
     *   },
     *   "file": {
     *     "form": {
     *       "name": "file",
     *       "filename": "testasset2.jpg"
     *     },
     *     "headers": {
     *       "Content-Type": "image/jpeg"
     *     },
     *     "value": "6789"
     *   }
     * }
     * @param {string} formData Raw form as received in the body of a multipart
     *  form request.
     * @returns {FormData} Parsed information from the form.
     */
    function getFormData(formData) {
        const unifiedNewlines = String(formData.toString().replaceAll(/\r\n/g, "\n"));
        const allLines = unifiedNewlines.split("\n");
        const formInfo = {};
        let currName = "";
        let isHeaders = true;
        allLines.forEach((line) => {
            if (line && line.startsWith("-----")) {
                currName = "";
                isHeaders = true;
            } else {
                const formData = processContentDisposition(line);
                if (formData) {
                    currName = formData.name;
                    formInfo[currName] = {
                        form: formData,
                        headers: {}
                    };
                } else if (!line) {
                    isHeaders = false;
                } else if (isHeaders) {
                    formInfo[currName].headers = {
                        ...formInfo[currName].headers,
                        ...processHeader(line)
                    };
                } else {
                    formInfo[currName].value = line;
                }
            }
        });
        return formInfo;
    }

    /**
     * Verifies that the property of a form is the expected value.
     * @param {*} formData Form whose value will be verified.
     * @param {string} name The name of the property in the form whose value should
     *  be verified.
     * @param {*} value The expected value.
     */
    function verifyFormDataValue(formData, name, value) {
        const { value: actual } = formData[name] || {};
        assert.strictEqual(actual, value, `Unexpected value for ${name} form data`);
    }

    /**
     * @typedef PartInfo
     * @property {string} content Content that is expected to be in the request body
     *  for this create asset call.
     * @property {string} fileName The name of the file as it should appear in the
     *  request body.
     * @property {number} [offset] If given, the request will be considered a chunked
     *  request, and the body will be verified to ensure this value is correct.
     * @property {number} [chunkLength] If given, the request will be considered a chunked
     *  request, and the body will be verified to ensure this value is correct.
     * @property {number} [fileLength] If given, the request will be considered a chunked
     *  request, and the body will be verified to ensure this value is correct.
     */
    /**
     * Registers a mock HTTP call that will respond to a request to the create asset servlet.
     * As part of the process, the method will verify any requests that it receives to ensure
     * that the content is correct.
     * @param {PartInfo} partInfo Information that will be used to validate the request.
     */
    function registerCreateAssetCall(partInfo = {}) {
        nock(HOST)
            .post("/content/dam.createasset.html")
            .reply(function (uri, requestBody) {
                const {
                    offset,
                    chunkLength,
                    fileLength,
                    content,
                    fileName
                } = partInfo;
                const formData = getFormData(requestBody);
                try {
                    // validate form values
                    verifyFormDataValue(formData, "_charset_", "utf-8");
                    verifyFormDataValue(formData, "file", content);
                    assert.strictEqual(formData.file.form.filename, fileName);
                    assert.strictEqual(formData.file.headers["Content-Type"], "image/jpeg");
                    if (offset !== undefined) {
                        verifyFormDataValue(formData, "file@Offset", `${offset}`);
                    } else {
                        verifyFormDataValue(formData, "file@Offset", undefined);
                    }
                    if (chunkLength !== undefined) {
                        verifyFormDataValue(formData, "chunk@Length", `${chunkLength}`);
                    } else {
                        verifyFormDataValue(formData, "chunk@Length", undefined);
                    }
                    if (fileLength !== undefined) {
                        verifyFormDataValue(formData, "file@Length", `${fileLength}`);
                    } else {
                        verifyFormDataValue(formData, "file@Length", undefined);
                    }

                    // validate servlet-specific headers for chunked uploads
                    if (offset || chunkLength || fileLength) {
                        // if it's a chunked request, verify extra request headers
                        assert.strictEqual(this.req.headers["x-chunked-content-type"][0], "image/jpeg");
                        assert.strictEqual(this.req.headers["x-chunked-total-size"][0], `${fileLength}`);
                    } else {
                        assert.strictEqual(this.req.headers["x-chunked-content-type"], undefined);
                        assert.strictEqual(this.req.headers["x-chunked-total-size"], undefined);
                    }
                } catch (e) {
                    console.log(e);
                    // if any of the assertions fail, return an non-retry error code to ensure
                    // the test will fail
                    return [400];
                }
                return [201];
            });
    }

    /**
     * Listens for a given event from the upload and adds its data to a
     * given registry for those types of events.
     * @param {*} upload Upload whose events will be registered.
     * @param {string} eventName Name of the event to register.
     * @param {*} registry Location where the event's data will be stored.
     *  The registry will be treated as a simple object whose keys are
     *  the name of a file, and whose value is an array of all event data
     *  received for that file.
     */
    function registerEvent(upload, eventName, registry) {
        upload.on(eventName, (data) => {
            const { fileName } = data;
            assert.ok(fileName);
            if (!registry[fileName]) {
                registry[fileName] = [];
            }
            registry[fileName].push(data);
        });
    }

    /**
     * Listens for events from the given upload, and will add any events received to the
     * test's global event lists.
     * @param {*} upload Upload whose events will be caught.
     */
    function registerEvents(upload) {
        registerEvent(upload, "filestart", fileStart);
        registerEvent(upload, "fileprogress", fileProgress);
        registerEvent(upload, "fileend", fileEnd);
        registerEvent(upload, "fileerror", fileError);
    }

    /**
     * Asserts that there are no events present in a given registry.
     * @param {*} registry Registry to verify.
     */
    function assertNoEvents(registry) {
        assert.deepStrictEqual(registry, {});
    }

    /**
     * Verifies that the events received for a given file match an expected set.
     * @param {*} registry Event registry to verify.
     * @param {string} fileName Name of the file whose events will be verified.
     * @param {Array} expected List of event data that should exactly match the
     *  actual list of events.
     */
    function assertEvents(registry, fileName, expected) {
        assert.deepStrictEqual(registry[fileName], expected);
    }

    /**
     * Verifies that the error events received for a given file match an expected set.
     * @param {*} registry Event registry to verify.
     * @param {string} fileName Name of the file whose events will be verified.
     * @param {Array} expected List of event data that should exactly match the
     *  actual list of events.
     */
    function assertErrorEvents(registry, fileName, expected) {
        const actual = registry[fileName] || [];
        assert.strictEqual(actual.length, expected.length);

        const modifiedExpected = [];
        for (let i = 0; i < actual.length; i++) {
            const { errors = [] } = actual[i];
            assert.strictEqual(errors.length, 1);
            modifiedExpected.push({
                ...expected[i],
                errors
            });
        }
        assertEvents(registry, fileName, modifiedExpected);
    }

    /**
     * Creates the general event info structure with the given information.
     * @param {string} fileContent Content of the file, which will be used to determine
     *  the file's size.
     * @param {string} filePath Full path of the file, which will be used as the source
     *  file information.
     * @param {string} assetName Name of the asset, which will be used as the file's
     *  name.
     * @param {string} assetPath Full remove path of the asset, which will be used
     *  as the target file's information.
     */
    function createFileEventInfo(fileContent, filePath, assetName, assetPath) {
        return {
            fileName: assetName,
            fileSize: fileContent.length,
            mimeType: "image/jpeg",
            sourceFile: filePath,
            sourceFolder: Path.posix.dirname(filePath),
            targetFile: assetPath,
            targetFolder: Path.posix.dirname(assetPath)
        };
    }

    it("test asset servlet upload success", async function () {
        const upload = new AEMUpload();
        directBinaryAccessNotEnabled(nock, HOST, "/content/dam");
        registerEvents(upload);

        const fileName1 = "file1.jpg";
        const fileName2 = "file2.jpg";
        const assetName1 = "testasset1.jpg";
        const assetName2 = "testasset2.jpg";
        const assetPath1 = `/content/dam/${assetName1}`;
        const assetPath2 = `/content/dam/${assetName2}`;
        const fileContent1 = "hello world 123";
        const fileContent2 = "hello world 123456789";
        const filePath1 = await createTestFile(fileName1, fileContent1);
        const filePath2 = await createTestFile(fileName2, fileContent2);

        const fileInfo1 = createFileEventInfo(fileContent1, filePath1, assetName1, assetPath1);
        const fileInfo2 = createFileEventInfo(fileContent2, filePath2, assetName2, assetPath2);

        registerCreateAssetCall({
            fileName: assetName1,
            content: fileContent1
        });
        registerCreateAssetCall({
            offset: 0,
            chunkLength: 17,
            fileLength: fileContent2.length,
            fileName: assetName2,
            content: fileContent2.substring(0, 17)
        });
        registerCreateAssetCall({
            offset: 17,
            chunkLength: 4,
            fileLength: fileContent2.length,
            fileName: assetName2,
            content: fileContent2.substring(17)
        });
        await upload.uploadFiles({
            uploadFiles: [{
                fileUrl: `${HOST}${assetPath1}`,
                filePath: filePath1,
                fileSize: fileContent1.length
            }, {
                fileUrl: `${HOST}${assetPath2}`,
                filePath: filePath2,
                fileSize: fileContent2.length
            }],
            preferredPartSize: fileContent1.length + 2
        });

        assertNoEvents(fileError);
        assertEvents(fileStart, assetName1, [fileInfo1]);
        assertEvents(fileStart, assetName2, [fileInfo2]);
        assertEvents(fileEnd, assetName1, [fileInfo1]);
        assertEvents(fileEnd, assetName2, [fileInfo2]);
        assertEvents(fileProgress, assetName1, [{
            ...fileInfo1,
            transferred: 15
        }]);
        assertEvents(fileProgress, assetName2, [{
            ...fileInfo2,
            transferred: 17
        }, {
            ...fileInfo2,
            transferred: 21
        }]);
    });

    it("test asset upload servlet failure", async function () {
        const upload = new AEMUpload();
        directBinaryAccessNotEnabled(nock, HOST, "/content/dam");
        registerEvents(upload);
        nock(HOST)
            .post("/content/dam.createasset.html")
            .reply(400);

        const fileName = "failurefile.jpg";
        const fileContent = "testing a failure";
        const filePath = await createTestFile(fileName, fileContent);
        const assetName = "testassetfailure.jpg";
        const assetPath = `/content/dam/${assetName}`;
        const fileInfo = createFileEventInfo(fileContent, filePath, assetName, assetPath);

        await upload.uploadFiles({
            uploadFiles: [{
                fileUrl: `${HOST}${assetPath}`,
                filePath: filePath,
                fileSize: fileContent.length
            }]
        });
        assertNoEvents(fileProgress);
        assertNoEvents(fileEnd);
        assertEvents(fileStart, assetName, [fileInfo]);
        assertErrorEvents(fileError, assetName, [fileInfo]);
    });
});