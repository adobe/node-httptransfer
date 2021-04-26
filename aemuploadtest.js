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

'use strict';

const { AEMUpload } = require("./index");

async function main() {
    const aemUpload = new AEMUpload();
    aemUpload.on("filestart", ({ fileName, fileSize }) => console.log(`Start ${fileName}, ${fileSize} bytes`));
    aemUpload.on("fileprogress", ({ fileName, fileSize, transferred }) => console.log(`Progress ${fileName}, ${transferred}/${fileSize} bytes`));
    aemUpload.on("fileend", ({ fileName, fileSize }) => console.log(`Completed ${fileName}, ${fileSize} bytes`));
    await aemUpload.uploadFiles({
        url: "http://localhost:4502/content/dam/bulkupload4",
        uploadFiles: [{
            fileName: "simon-fitall-tvleqH3p1os-unsplash.jpg",
            fileSize: 11806152,
            filePath: "/Users/bmanen/Pictures/unsplash/simon-fitall-tvleqH3p1os-unsplash.jpg"
        }, {
            fileName: "sid-ramirez-xF2HkuitGDY-unsplash.jpg",
            fileSize: 3253102,
            filePath: "/Users/bmanen/Pictures/unsplash/sid-ramirez-xF2HkuitGDY-unsplash.jpg"
        }, {
            fileName: "shawnn-tan-9ZidPkO9qv0-unsplash.jpg",
            fileSize: 1892021,
            filePath: "/Users/bmanen/Pictures/unsplash/shawnn-tan-9ZidPkO9qv0-unsplash.jpg"
        }, {
            fileName: "alexunder-hess-fXaruvd6Oio-unsplash.jpg",
            fileSize: 683019,
            filePath: "/Users/bmanen/Pictures/unsplash/alexunder-hess-fXaruvd6Oio-unsplash.jpg"
        }], 
        headers: {
            "authorization": `Basic ${Buffer.from("admin:admin").toString("base64")}`
        },
        concurrent: true,
        maxConcurrent: 16
    });
}

main()
    .then(() => console.log("complete"))
    .catch(err => console.error(err));
