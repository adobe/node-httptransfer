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

const request = require('request');
const rp = require('request-promise-native');
const contentRange = require('content-range');

/**
 * Read a UTF8 text stream
 * 
 * @param {stream.Readable} stream Readable stream
 * @param {Number} maxLength Maximum number of characters to read
 * @param {Function} callback Callback with the text that was read
 */
function readTextStream(stream, maxLength, callback) {
    let text = ''
    let totalLength = 0
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
        totalLength += chunk.length
        const remaining = maxLength - Math.min(text.length, maxLength)
        if (remaining > 0) {
            text += chunk.substr(0, Math.min(chunk.length, remaining))
        }
    })
    stream.on('end', () => {
        if (totalLength > maxLength) {
            return callback(`${text}...`);
        } else {
            return callback(text);
        }
    })
}

/**
 * Retrieves the HTTP headers for a URL, using a HEAD request or what is appropriate.
 */
async function requestHeaders(url) {
    if (url.includes(".amazonaws.com")) {
        // S3 does not allow HEAD requests on presigned GET urls, so workaround
        // by using 0-byte range request - trick from here: https://stackoverflow.com/questions/15717230
        // console.log("fetching metadata via GET 0-byte range request from", url);
        const response = await rp.get({
            url: url,
            headers: {
                range: "bytes=0-0"
            },
            resolveWithFullResponse: true
        });
        return response.headers;
    } else {
        // console.log("fetching metadata via HEAD request from", url);
        return rp.head(url);
    }
}

/**
 * @typedef {Object} DownloadStreamOptions
 * 
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 */
/**
 * Download content from a URL and write it to a stream
 * 
 * @param {String|URL} url Source URL
 * @param {Object} writeStream Target writable stream
 * 
 * @param {DownloadStreamOptions} options Download options
 * @returns {Promise} resolves when download completes
 */
async function downloadStream(url, writeStream, options) {
    options = Object.assign({}, {
        url
    }, options);

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
                writeStream.on('error', error => {
                    // failure to write to file
                    req.abort();
                    reject(Error(`Download '${url}' failed: ${error.message}`));
                })
                writeStream.on('finish', () => {
                    resolve();
                })
                response.pipe(writeStream);
            }
        })
    })
}

/**
 * @typedef {Object} UploadStreamOptions
 * 
 * @property {String} method HTTP method (defaults to 'PUT')
 * @property {Number} timeout Socket timeout
 * @property {Object} headers An object containing request headers
 */
/**
 * Upload a stream of data to a URL
 * 
 * @param {Object} readStream Source readable stream
 * @param {String} url Target URL
 * @param {UploadStreamOptions} options Upload options
 * @returns {Promise} resolves when upload completes
 */
async function uploadStream(readStream, url, options) {
    options = Object.assign({}, {
        url,
        method: 'PUT'
    }, options);

    return new Promise((resolve, reject) => {
        const req = request(options);
        req.on('error', error => {
            // error establishing a connection
            reject(Error(`Upload to '${url}' failed: ${error.message}`));
        })
        req.on('response', response => {
            if ((response.statusCode < 200) || (response.statusCode >= 300)) {
                const contentType = response.headers['content-type'];
                if (contentType && contentType.startsWith('text/')) {
                    response.on('error', error => {
                        // error streaming error response
                        reject(Error(`Upload to '${url}' failed with status ${response.statusCode}: ${error.message}`));
                    })        
                    readTextStream(response, 10000, message => {
                        reject(Error(`Upload to '${url}' failed with status ${response.statusCode}: ${message}`));
                    })
                } else {
                    // consume response data without processing
                    response.resume();
                    reject(Error(`Upload to '${url}' failed with status ${response.statusCode}`));
                }
            } else {
                response.on('error', error => {
                    // error streaming success response
                    reject(Error(`Upload to '${url}' failed: ${error.message}`));
                })    
                response.on('end', () => {
                    resolve();
                })
                // consume response data without processing
                response.resume();
            }
        })

        readStream.on('error', error => {
            // Unable to read from the stream
            req.abort();
            reject(Error(`Upload to '${url}' failed: ${error.message}`));
        });
        readStream.pipe(req);
    });
}

/**
 * Transfer a stream of content from one url to another
 * 
 * @param {String} sourceUrl Source URL
 * @param {String} targetUrl Target URL
 * @returns {Promise} resolves when transfer completes
 */
async function transferStream(sourceUrl, targetUrl) {
    // pass in the content-length header to disable chunked encoding
    const headers = await requestHeaders(sourceUrl);
    let size;
    if (headers['content-range']) {
        size = contentRange.parse(headers['content-range']).length;
    } else if (headers['content-length']) {
        size = headers['content-length'];
    }

    return new Promise((resolve, reject) => {
        const sourceReq = request.get(sourceUrl);
        sourceReq.on('error', error => {
            // error establishing a connection
            reject(Error(`Transfer '${sourceUrl}' to '${targetUrl}' failed: ${error.message}`));
        })
        sourceReq.on('response', sourceResponse => {
            if (sourceResponse.statusCode !== 200) {
                const contentType = sourceResponse.headers['content-type'];
                if (contentType && contentType.startsWith('text/')) {
                    sourceResponse.on('error', error => {
                        // error streaming error response
                        reject(Error(`Transfer '${sourceUrl}' to '${targetUrl}' failed with status ${sourceResponse.statusCode}: ${error.message}`));
                    })        
                    readTextStream(sourceResponse, 10000, message => {
                        reject(Error(`Transfer '${sourceUrl}' to '${targetUrl}' failed with status ${sourceResponse.statusCode}: ${message}`));
                    })
                } else {
                    // consume response data without processing
                    sourceResponse.resume();
                    reject(Error(`Transfer '${sourceUrl}' to '${targetUrl}' failed with status ${sourceResponse.statusCode}`));
                }
            } else {
                const targetReq = request.put({
                    url: targetUrl,
                    headers: {
                        'content-length': size
                    }
                });
                targetReq.on('error', error => {
                    // error establishing a connection
                    reject(Error(`Transfer '${sourceUrl}' to '${targetUrl}' failed: ${error.message}`));
                })
                targetReq.on('response', targetResponse => {
                    if ((targetResponse.statusCode < 200) || (targetResponse.statusCode >= 300)) {
                        const contentType = targetResponse.headers['content-type'];
                        if (contentType && contentType.startsWith('text/')) {
                            targetResponse.on('error', error => {
                                // error streaming error response
                                reject(Error(`Transfer from '${sourceUrl}' to '${targetUrl}' failed with status ${response.statusCode}: ${error.message}`));
                            })        
                            readTextStream(targetResponse, 10000, message => {
                                reject(Error(`Transfer from '${sourceUrl}' to '${targetUrl}' failed with status ${response.statusCode}: ${message}`));
                            })
                        } else {
                            // consume response data without processing
                            targetResponse.resume();
                            reject(Error(`Transfer from '${sourceUrl}' to '${targetUrl}' failed with status ${response.statusCode}`));
                        }
                    } else {
                        targetResponse.on('error', error => {
                            // error streaming success response
                            reject(Error(`Transfer from '${sourceUrl}' to '${targetUrl}' failed: ${error.message}`));
                        })    
                        targetResponse.on('end', () => {
                            resolve();
                        })
                        // consume response data without processing
                        targetResponse.resume();
                    }
                })

                sourceResponse.on('error', error => {
                    // Unable to read from the stream
                    targetReq.abort();
                    reject(Error(`Transfer from '${sourceUrl}' to '${targetUrl}' failed: ${error.message}`));
                });
                sourceResponse.pipe(targetReq);
            }
        })
    })

}

module.exports = {
    downloadStream,
    uploadStream,
    transferStream
}
