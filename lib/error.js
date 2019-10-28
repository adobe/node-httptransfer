/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

"use strict";

class HttpTransferError extends Error {
    constructor(method, url, status, errorResponse) {
        if (errorResponse) {
            super(`${method} '${url}' failed with status ${status}: ${errorResponse}`);
        } else {
            super(`${method} '${url}' failed with status ${status}`);
        }
        this.method = method;
        this.url = url;
        this.status = status;
        this.errorResponse = errorResponse;
    }
}

class HttpConnectError extends Error {
    constructor(method, url, message) {
        super(`${method} '${url}' failed: ${message}`);
    }
}

module.exports = {
    HttpTransferError,
    HttpConnectError
}
