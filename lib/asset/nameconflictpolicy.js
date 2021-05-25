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

const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {Object} NameConflictPolicyOptions
 * @property {Boolean} [createVersion=false] Create version on duplicates (truthy value)
 * @property {String} [versionLabel] Version label to apply to the created/updated file
 * @property {String} [versionComment] Version comment to apply to the created/updated file
 * @property {Boolean} [replace=false] True if the existing file should be replaced (truthy value)
 */

/**
 * Define how to handle a name conflict
 */
class NameConflictPolicy {
    /**
     * Build a createVersion name conflict policy
     * 
     * @param {String} [versionLabel] Version label to apply to the created/updated file
     * @param {String} [versionComment] Version comment to apply to the created/updated file 
     * @returns {NameConflictPolicy} Create version name conflict policy
     */
    static createVersionPolicy(versionLabel, versionComment) {
        if (versionLabel && (typeof versionLabel !== "string")) {
            throw Error(`versionLabel is expected to be a string: ${versionLabel}`);
        }
        if (versionComment && (typeof versionComment !== "string")) {
            throw Error(`versionComment is expected to be a string: ${versionComment}`);
        }
        return new NameConflictPolicy({
            createVersion: true,
            versionLabel,
            versionComment
        });
    }

    /**
     * Replace asset name conflict policy
     * 
     * @returns {NameConflictPolicy} Replace asset name conflict policy
     */
    static replaceAssetPolicy() {
        return new NameConflictPolicy({
            replace: true
        });
    }

    /**
     * Construct a name conflict policy
     * 
     * @param {NameConflictPolicyOptions} [options] Name conflict policy options
     */
    constructor(options) {
        if (options && options.versionLabel && (typeof options.versionLabel !== "string")) {
            throw Error(`Version label is expected to be a string: ${options.versionLabel}`);
        }
        if (options && options.versionComment && (typeof options.versionComment !== "string")) {
            throw Error(`Version comment is expected to be a string: ${options.versionComment}`);
        }
        this[PRIVATE] = {
            createVersion: !!(options && options.createVersion),
            versionLabel: options && options.versionLabel,
            versionComment: options && options.versionComment,
            replace: !!(options && options.replace)
        };
    }

    /**
     * Create a version
     * 
     * @returns {Boolean} True if a version should be created for the asset
     */
    get createVersion() {
        return this[PRIVATE].createVersion;
    }

    /**
     * Optional label associated with the version
     * 
     * @returns {String} Optional label associated with the version
     */
    get versionLabel() {
        return this[PRIVATE].versionLabel;
    }

    /**
     * Optional comment associated with the version
     * 
     * @returns {String} Optional comment associated with the version
     */
    get versionComment() {
        return this[PRIVATE].versionComment;
    }

    /**
     * If the asset should be replaced
     *
     * @returns {Boolean} True if the asset should be replaced
     */
    get replace() {
        return this[PRIVATE].replace;
    }
}

module.exports = {
    NameConflictPolicy
};