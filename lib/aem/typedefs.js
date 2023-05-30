
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

'use strict';

/**
 * @typedef {Object} UploadFile
 * @property {String} fileUrl AEM url where to upload the file
 * @property {Number} fileSize Size of the file to upload
 * @property {String} filePath Path on the local disk to upload
 * @property {Blob} [blob] Browser blob to upload (instead of fileUrl)
 * @property {Boolean} [createVersion=false] Create version on duplicates
 * @property {String} [versionLabel] Version label to apply to the created/updated file
 * @property {String} [versionComment] Version comment to apply to the created/updated file
 * @property {Boolean} [replace=false] True if the existing file should be replaced
 */
/**
 * @typedef {Object} AEMUploadOptions
 * @property {UploadFile[]} uploadFiles List of files that will be uploaded to the target URL. 
 * @property {*} headers HTTP headers that will be included in each request sent to AEM
 * @property {Boolean} concurrent If true, multiple files in the supplied list of upload files will transfer simultaneously. If false, only one file will transfer at a time, and the next file will not begin transferring until the current file finishes.
 * @property {Number} maxConcurrent Maximum number of concurrent HTTP requests that are allowed
 * @property {Number} [preferredPartSize] Preferred part size
 * @property {Object} requestOptions Options that will be passed to fetch (either node-fetch-npm or native fetch, depending on the context)
 * @property {import('../retry').RetryOptions} requestOptions.retryOptions Options configuring retry behavior for fetch requests
 */

module.exports = {};