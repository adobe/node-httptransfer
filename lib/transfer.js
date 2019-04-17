/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2019 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/

'use strict';

const fs = require('fs-extra');
const path = require('path');
const { downloadStream, uploadStream } = require('./stream');
const { createReadStream, createWriteStream } = require('./util');
const request = require('request');
const contentRange = require('content-range');

/**
 * Retrieves the HTTP headers for a URL, using a HEAD request or what is appropriate.
 */
async function requestHeaders(url) {
    if (url.includes(".amazonaws.com")) {
        // S3 does not allow HEAD requests on presigned GET urls, so workaround
        // by using 0-byte range request - trick from here: https://stackoverflow.com/questions/15717230
        console.log("fetching metadata via GET 0-byte range request from", url);
        const response = await request.get({
            url: url,
            headers: {
                range: "bytes=0-0"
            },
            resolveWithFullResponse: true
        });
        return response.headers;

    } else {
        console.log("fetching metadata via HEAD request from", url);
        return request.head(url);
    }
}

/**
 * @typedef {Object} UploadFileOptions
 * 
 * @property {String} method HTTP method (defaults to 'PUT')
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 */
/**
 * Transfer a file from one url to another
 * 
 * @param {String} sourceUrl Source URL
 * @param {String} targetUrl Target URL
 * @param {TransferOptions} options Transfer options
 * @returns {Promise} resolves when transfer completes
 */
async function transfer(sourceUrl, targetUrl, options) {
    const headers = await requestHeaders(sourceUrl);
    const contentType = headers['content-type'];

    // pass in the content-length header to disable chunked encoding
    let size;
    if (headers['content-range']) {
        size = contentRange.parse(headers['content-range']).length;
    } else if (headers['content-length'] {
        size = headers['content-length'];
    }
    options = Object.assign({}, options, {
        headers: {
            'content-length': size
        }
    });

    return new Promise((resolve, reject) => {
        const req = request.get(options);
        req.on('error', error => {
            // error establishing a connection
            reject(Error(`Download '${url}' failed: ${error.message}`));
        })
        req.on('response', response => {
            if (response.statusCode !== 200) {
                const contentType = response.headers['content-type'];
                if (contentType && contentType.startsWith('text/')) {
                    response.on('error', error => {
                        // error streaming error response
                        reject(Error(`Download '${url}' failed with status ${response.statusCode}: ${error.message}`));
                    })        
                    readTextStream(response, 10000, message => {
                        reject(Error(`Download '${url}' failed with status ${response.statusCode}: ${message}`));
                    })
                } else {
                    // consume response data without processing
                    response.resume();
                    reject(Error(`Download '${url}' failed with status ${response.statusCode}`));
                }
            } else {
                response.on('error', error => {
                    // error streaming success response
                    reject(Error(`Download '${url}' failed: ${error.message}`));
                })    
                uploadStream(response, targetUrl)
            }
        })
    })

    // upload file
    const readStream = await createReadStream(filepath);
    return uploadStream(readStream, url, options);
}

module.exports = {
    transfer,
}
