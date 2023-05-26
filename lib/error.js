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

"use strict";

class HttpResponseError extends Error {
    constructor(method, url, status, errorResponse) {
        if (errorResponse) {
            super(`${method} '${url}' failed with status ${status}: ${errorResponse}`);
        } else {
            super(`${method} '${url}' failed with status ${status}`);
        }
        this.status = status;
        this.method = method;
        this.url = url;
        this.errorResponse = errorResponse;
    }
}

class HttpConnectError extends Error {
    constructor(method, url, message) {
        super(`${method} '${url}' connect failed: ${message}`);
        this.method = method;
        this.url = url;
    }
}

class HttpStreamError extends Error {
    constructor(method, url, status, message) {
        super(`${method} '${url}' stream ${status} response failed: ${message}`);
        this.method = method;
        this.url = url;
        this.status = status;
    }
}

class IllegalArgumentError extends Error {
    constructor(message, value) {
        if (value === undefined) {
            super(`${message}: undefined`);
        } else if (Array.isArray(value)) {
            super(`${message}: length=${value.length} (array)`);
        } else {
            super(`${message}: ${value} (${typeof value})`);
        }
    }
}

class UnsupportedFileUploadError extends Error {
    constructor(reason) {
        super(`File cannot be uploaded: ${reason}`);
    }
}

module.exports = {
    HttpResponseError,
    HttpConnectError,
    HttpStreamError,
    IllegalArgumentError,
    UnsupportedFileUploadError
};
