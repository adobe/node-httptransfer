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

/**
 * Custom Error class containing additional information specific to the download process. This primarily consists of an
 * error code, which can be used by consumers to provide more specific information about the nature of an error.
 */
class BlockTransferError extends Error {

    /**
     * Concatenates to message values together if both are provided.
     *
     * @param {string} overallMessage Will be prepended to specificMessage, delimited with a colon, if supplied.
     * @param {string} specificMessage Will be concatenated with overallMessage, if supplied. 
     *  Otherwise the return value of the method will be specificMessage as-is.
     * @returns {string} A message value.
     */
    static getFullMessage(overallMessage, specificMessage) {
        if (overallMessage) {
            return `${overallMessage}: ${specificMessage}`;
        }
        return specificMessage;
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
        super(message);
        this.code = code;
        this.innerStack = innerStack;
        this.uploadError = true;
    }

    /**
     * Retrieves the error code representing the specific type of error. See ErrorCodes for more
     * information.
     *
     * @returns {string} An error code value.
     */
    getCode() {
        return this.code;
    }

    /**
     * Retrieves the download error's status as an HTTP status code.
     *
     * @returns {number} An HTTP status code.
     */
    getHttpStatusCode() {
        const code = this.getCode();

        if (code === errorCodes.ALREADY_EXISTS) {
            return 409;
        } else if (code === errorCodes.FORBIDDEN) {
            return 403;
        } else if (code === errorCodes.INVALID_OPTIONS) {
            return 400;
        } else if (code === errorCodes.NOT_AUTHORIZED) {
            return 401;
        } else if (code === errorCodes.NOT_FOUND) {
            return 404;
        } else if (code === errorCodes.TOO_LARGE) {
            return 413;
        } else if (code === errorCodes.NOT_SUPPORTED) {
            return 501;
        } else if (code === errorCodes.TOO_MANY_REQUESTS) {
            return 429;
        } else {
            return 500;
        }
    }

    /**
     * Retrieves a message describing the error.
     *
     * @returns {string} The error's message.
     */
    getMessage() {
        return this.message;
    }

    /**
     * Retrieves the inner stack of the error, as provided to the constructor.
     *
     * @returns {string} The error's inner stack.
     */
    getInnerStack() {
        return this.innerStack;
    }

    /**
     * Converts the error instance into a simplified object form.
     *
     * @returns {object} Simple object representation of the error.
     */
    toJSON() {
        const json = {
            message: this.message,
            code: this.code,
        };

        if (this.innerStack) {
            json.innerStack = this.innerStack;
        }

        return json;
    }

    /**
     * Converts the error to a string, which will be a stringified version of the error's toJSON() method.
     *
     * @returns {string} String representation of the error.
     */
    toString() {
        return JSON.stringify(this);
    }
}

module.exports = BlockTransferError;
