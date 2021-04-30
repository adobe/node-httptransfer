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

module.exports = {
    MIMETYPE: Object.freeze({
        APPLICATION_OCTET_STREAM: "application/octet-stream",
        APPLICATION_X_WWW_FORM_URLENCODED: "application/x-www-form-urlencoded"
    }),
    HTTP: Object.freeze({
        RANGE: Object.freeze({
            BYTES: "bytes"
        }),
        HEADER: Object.freeze({
            ETAG: "etag",
            IF_MATCH: "if-match",
            IF_UNMODIFIED_SINCE: "if-unmodified-since",
            LAST_MODIFIED: "last-modified",
            CONTENT_RANGE: "content-range",
            CONTENT_LENGTH: "content-length",
            CONTENT_TYPE: "content-type",
            CONTENT_DISPOSITION: "content-disposition",
            RANGE: "range"
        }),
        STATUS: Object.freeze({
            OK: 200,
            PARTIAL_CONTENT: 206
        }),
        METHOD: Object.freeze({
            POST: "POST",
            PUT: "PUT",
            GET: "GET",
            HEAD: "HEAD"
        })
    })
};
