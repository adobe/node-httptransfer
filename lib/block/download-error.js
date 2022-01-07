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

'use strict';

const errorCodes = require('../http-error-codes');
const BlockTransferError = require('./blocktransfer-error');

/**
 * Custom Error class containing additional information specific to the download process. This primarily consists of an
 * error code, which can be used by consumers to provide more specific information about the nature of an error.
 */
class DownloadError extends BlockTransferError {
    /**
     * Constructs a new DownloadError instance out of a given error message. The method will attempt to create the
     * most specific type of error it can based on what it receives.
     *
     * @param {*} error Object from which to create the UploadError instance. Can be several things, including an
     *  DownloadError instance, an error as thrown by axios, a string, or another Error instance.
     * @param {string} errorMessage Will appear in the error's "message" value.
     * @returns {UploadError} An upload error instance.
     */
    static fromError(error, errorMessage = '') {
        const {
            message,
            code,
            downloadError,
            stack,
        } = error;

        if (downloadError) {
            return error;
        }

        const status = (error.response && error.response.status) || error.status;
        if (status) {
            let code = errorCodes.UNKNOWN;
            if (status === 409) {
                code = errorCodes.ALREADY_EXISTS;
            } else if (status === 403) {
                code = errorCodes.FORBIDDEN;
            } else if (status === 400) {
                code = errorCodes.INVALID_OPTIONS;
            } else if (status === 401) {
                code = errorCodes.NOT_AUTHORIZED;
            } else if (status === 404) {
                code = errorCodes.NOT_FOUND;
            } else if (status === 413) {
                code = errorCodes.TOO_LARGE;
            } else if (status === 429) {
                code = errorCodes.TOO_MANY_REQUESTS;
            } else if (status === 501) {
                code = errorCodes.NOT_SUPPORTED;
            }
            return new DownloadError(`Request failed with status code ${status}`, code, stack);
        }

        if (message && code) {
            return new DownloadError(BlockTransferError.getFullMessage(errorMessage, message), code, stack);
        }

        if (message) {
            return new DownloadError(BlockTransferError.getFullMessage(errorMessage, message), errorCodes.UNKNOWN, stack);
        }

        if (typeof error === 'string') {
            return new DownloadError(BlockTransferError.getFullMessage(errorMessage, error), errorCodes.UNKNOWN);
        }

        try {
            return new DownloadError(BlockTransferError.getFullMessage(errorMessage, JSON.stringify(error)), errorCodes.UNKNOWN, stack);
        // eslint-disable-next-line no-unused-vars
        } catch (e) {
            return new DownloadError(BlockTransferError.getFullMessage(errorMessage, error), errorCodes.UNKNOWN, stack);
        }
    }

    /**
     * Constructs a new instance containing the provided information.
     *
     * @param {string} message The message that will appear with the Error instance.
     * @param {string} code The code indicating the specific type of error.
     * @param {string} [innerStack] Additional stack information if the UploadError instance originated
     *  from another Error.
     */
    constructor(message, code, innerStack = '') {
        super(message, code, innerStack);
        this.downloadError = true;
    }
}

module.exports = DownloadError;
