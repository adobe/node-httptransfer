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
const nock = require('nock');
const Path = require('path');
const { BlockDownload } = require('../../lib/block/blockdownload');
const fs = require('fs').promises;

const debug = require('debug');
debug.enable('httptransfer*');

describe('Block Download', function () {
    afterEach(async function () {
        nock.cleanAll();
    });

    it('Block download smoke test (single download)', async function () {
        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-1.jpeg";
        nock(HOST)
            .head(filenameToDownload)
            .reply(() => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 15,
                        'content-disposition': 'attachment; filename="image-file-1.jpg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        nock(HOST)
            .get(filenameToDownload)
            .reply(() => {
                return [
                    200,
                    "AAAAAAAAAAAAAAA",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 15,
                        'content-disposition': 'attachment; filename="image-file-1.jpg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        const mockDownloadFileLocation = "./test/tmp.jpeg";
        await blockDownload.downloadFiles({
            downloadFiles: [{
                fileUrl: fileToDownload,
                filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                fileSize: 15
            }],
            concurrent: true,
            maxConcurrent: 4
        });

        await fs.unlink(Path.resolve(mockDownloadFileLocation), "Could not unlink mock downloaded file");
        assert.equal(events.filestart.length, 1);
        assert.equal(events.filestart[0].fileSize, 15);
        assert.equal(events.fileprogress.length, 1);
        assert.equal(events.fileprogress[0].fileSize, 15);
        assert.equal(events.fileprogress[0].transferred, 15);
        assert.equal(events.fileend.length, 1);
        assert.equal(events.fileprogress[0].fileSize, 15);
        assert.equal(events.error.length, 0);
        assert.ok(nock.isDone(), nock.pendingMocks());
    });

    it('Block download smoke test (multiple file download)', async function () {
        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-.jpeg";
        nock(HOST)
            .head(`${filenameToDownload}1`)
            .reply(() => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 15,
                        'content-disposition': 'attachment; filename="image-file-1.jpg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        nock(HOST)
            .get(`${filenameToDownload}1`)
            .reply(() => {
                return [
                    200,
                    "AAAAAAAAAAAAAAA",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 15,
                        'content-disposition': 'attachment; filename="image-file-1.jpg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

            nock(HOST)
            .head(`${filenameToDownload}2`)
            .reply(() => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 15,
                        'content-disposition': 'attachment; filename="image-file-1.jpg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        nock(HOST)
            .get(`${filenameToDownload}2`)
            .reply(() => {
                return [
                    200,
                    "AAAAAAAAAAAAAAA",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 15,
                        'content-disposition': 'attachment; filename="image-file-1.jpg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        const mockDownloadFileLocation = "./test/tmp.jpeg";
        await blockDownload.downloadFiles({
            downloadFiles: [{
                fileUrl: `${fileToDownload}1`,
                filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                fileSize: 15
            },
            {
                fileUrl: `${fileToDownload}2`,
                filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                fileSize: 15
            }],
            concurrent: true,
            maxConcurrent: 4
        });

        await fs.unlink(Path.resolve(mockDownloadFileLocation), "Could not unlink mock downloaded file");
        assert.equal(events.filestart.length, 2);
        assert.equal(events.filestart[0].fileSize, 15);
        assert.equal(events.fileprogress.length, 2);
        assert.equal(events.fileprogress[0].fileSize, 15);
        assert.equal(events.fileprogress[0].transferred, 15);
        assert.equal(events.fileend.length, 2);
        assert.equal(events.fileprogress[0].fileSize, 15);
        assert.equal(events.error.length, 0);
        assert.ok(nock.isDone(), nock.pendingMocks());
    });

    it('Block small jpeg file', async function () {
        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-1.jpeg";
        nock(HOST)
            .head(filenameToDownload)
            .reply(() => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/jpeg',
                        'content-length': 2024,
                        'content-disposition': 'attachment; filename="image-file-1.jpeg"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        nock(HOST)
            .get(filenameToDownload)
            .replyWithFile(200,
                `${__dirname}/test-files/jpeg-file.jpeg`,
                {
                    'content-type': 'image/jpeg',
                    'content-length': 2024,
                    'content-disposition': 'attachment; filename="image-file-1.jpeg"',
                    'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                    'etag': ''
                }
            );

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        const mockDownloadFileLocation = "./test/tmp.jpeg";
        await blockDownload.downloadFiles({
            downloadFiles: [{
                fileUrl: fileToDownload,
                filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                fileSize: 2024
            }],
            concurrent: true,
            maxConcurrent: 4
        });

        await fs.unlink(Path.resolve(mockDownloadFileLocation), "Could not unlink mock downloaded file");

        const expectedEvents = {
            filestart: [
                {
                    fileName: 'tmp.jpeg',
                    fileSize: 2024,
                    targetFolder: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test',
                    targetFile: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test/tmp.jpeg',
                    sourceFolder: '/path/to',
                    sourceFile: '/path/to/image-file-1.jpeg',
                    mimeType: 'image/jpeg'
                }
            ],
            fileprogress: [
                {
                    fileName: 'tmp.jpeg',
                    fileSize: 2024,
                    targetFolder: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test',
                    targetFile: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test/tmp.jpeg',
                    sourceFolder: '/path/to',
                    sourceFile: '/path/to/image-file-1.jpeg',
                    mimeType: 'image/jpeg',
                    transferred: 2024
                }
            ],
            fileend: [
                {
                    fileName: 'tmp.jpeg',
                    fileSize: 2024,
                    targetFolder: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test',
                    targetFile: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test/tmp.jpeg',
                    sourceFolder: '/path/to',
                    sourceFile: '/path/to/image-file-1.jpeg',
                    mimeType: 'image/jpeg'
                }
            ],
            error: []
        };
        assert.deepStrictEqual(events, expectedEvents);
    });

    it('Block download small png file', async function () {
        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-1.png";
        nock(HOST)
            .head(filenameToDownload)
            .reply(() => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/png',
                        'content-length': 1911,
                        'content-disposition': 'attachment; filename="image-file-1.png"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT'
                    }
                ];
            });

        nock(HOST)
            .get(filenameToDownload)
            .replyWithFile(200,
                `${__dirname}/test-files/png-file.png`,
                {
                    'content-type': 'image/png',
                    'content-length': 1911,
                    'content-disposition': 'attachment; filename="image-file-1.png"',
                    'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT'
                }
            );

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        const mockDownloadFileLocation = "./test/tmp.png";
        await blockDownload.downloadFiles({
            downloadFiles: [{
                fileUrl: fileToDownload,
                filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                fileSize: 1911
            }],
            concurrent: true,
            maxConcurrent: 4
        });

        await fs.unlink(Path.resolve(mockDownloadFileLocation), "Could not unlink mock downloaded file");

        const expectedEvents = {
            filestart: [
                {
                    fileName: 'tmp.png',
                    fileSize: 1911,
                    targetFolder: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test',
                    targetFile: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test/tmp.png',
                    sourceFolder: '/path/to',
                    sourceFile: '/path/to/image-file-1.png',
                    mimeType: 'image/png'
                }
            ],
            fileprogress: [
                {
                    fileName: 'tmp.png',
                    fileSize: 1911,
                    targetFolder: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test',
                    targetFile: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test/tmp.png',
                    sourceFolder: '/path/to',
                    sourceFile: '/path/to/image-file-1.png',
                    mimeType: 'image/png',
                    transferred: 1911
                }
            ],
            fileend: [
                {
                    fileName: 'tmp.png',
                    fileSize: 1911,
                    targetFolder: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test',
                    targetFile: '/Users/mathern/Desktop/git/_adobe/node-httptransfer/test/tmp.png',
                    sourceFolder: '/path/to',
                    sourceFile: '/path/to/image-file-1.png',
                    mimeType: 'image/png'
                }
            ],
            error: []
        };
        assert.deepStrictEqual(events, expectedEvents);
    });

    it('Block download handles errors gracefully when HEAD and GET filesize mismatch', async function () {
        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-1.png";
        nock(HOST)
            .head(filenameToDownload)
            .reply(() => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/png',
                        'content-length': 1911,
                        'content-disposition': 'attachment; filename="image-file-1.png"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        nock(HOST)
            .get(filenameToDownload)
            .replyWithFile(200,
                `${__dirname}/test-files/png-file.png`,
                {
                    'content-type': 'image/png',
                    'content-length': 2000,
                    'content-disposition': 'attachment; filename="image-file-1.png"',
                    'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                    'etag': ''
                }
            );

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        const mockDownloadFileLocation = "./test/tmp.png";

        try {
            await blockDownload.downloadFiles({
                downloadFiles: [{
                    fileUrl: fileToDownload,
                    filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                    fileSize: 1911
                }],
                concurrent: true,
                maxConcurrent: 4
            });
            assert.fail("Should have thrown an error");
        } catch (err) {
            console.log(err.message);
            assert.ok(err.message.includes("not seem to have respected Range header"));
        }
    });

    it('Block download handles errors gracefully when HEAD OK, GET 404', async function () {
        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-1.png";
        nock(HOST)
            .head(filenameToDownload)
            .reply(() => {
                return [
                    200,
                    "OK",
                    {
                        'content-type': 'image/png',
                        'content-length': 1911,
                        'content-disposition': 'attachment; filename="image-file-1.png"',
                        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                        'etag': ''
                    }
                ];
            });

        nock(HOST)
            .get(`${filenameToDownload}`)
            .reply(() => {
                return [
                    404
                ];
            });

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        const mockDownloadFileLocation = "./test/tmp.png";

        try {
            await blockDownload.downloadFiles({
                downloadFiles: [{
                    fileUrl: fileToDownload,
                    filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                    fileSize: 1911
                }],
                concurrent: true,
                maxConcurrent: 4
            });
            assert.fail("Should have thrown an error");
        } catch (err) {
            console.log(err.message);
            assert.ok(nock.isDone()); // HEAD and GET should have been attempted
            assert.ok(err.message.includes("failed"));
            assert.ok(err.message.includes("404"));
        }
    });

    it('Block download handles errors gracefully when HEAD 404 and GET OK', async function () {
        const HOST = "http://test-aem-download.com";
        const filenameToDownload = "/path/to/image-file-1.png";
        nock(HOST)
            .head(filenameToDownload)
            .reply(() => {
                return [
                    404
                ];
            });

        nock(HOST)
            .get(filenameToDownload)
            .replyWithFile(200,
                `${__dirname}/test-files/png-file.png`,
                {
                    'content-type': 'image/png',
                    'content-length': 2000,
                    'content-disposition': 'attachment; filename="image-file-1.png"',
                    'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
                    'etag': ''
                }
            );

        const blockDownload = new BlockDownload();
        const events = {
            filestart: [],
            fileprogress: [],
            fileend: [],
            error: []
        };
        blockDownload.on('filestart', (data) => {
            events.filestart.push(data);
        });
        blockDownload.on('fileprogress', (data) => {
            events.fileprogress.push(data);
        });
        blockDownload.on('fileend', (data) => {
            events.fileend.push(data);
        });
        blockDownload.on('error', (data) => {
            events.error.push(data);
        });

        const fileToDownload = `${HOST}${filenameToDownload}`;
        const mockDownloadFileLocation = "./test/tmp.png";

        try {
            await blockDownload.downloadFiles({
                downloadFiles: [{
                    fileUrl: fileToDownload,
                    filePath: Path.resolve(mockDownloadFileLocation), // where to put the file
                    fileSize: 1911
                }],
                concurrent: true,
                maxConcurrent: 4
            });
            assert.fail("Should have thrown an error");
        } catch (err) {
            console.log(err.message);
            assert.ok(!nock.isDone()); // the GET should not have been attempted
            assert.ok(err.message.includes("failed"));
            assert.ok(err.message.includes("404"));
        }
    });
});
