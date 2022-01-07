# node-httptransfer

[![Version](https://img.shields.io/npm/v/@adobe/httptransfer.svg)](https://npmjs.org/package/@adobe/httptransfer)

## Introduction

The `node-httptransfer` package is designed to easily and correctly transfer file content from HTTP(S) urls to HTTP(S) urls and between HTTP(S) urls.

The lower-level stream API allows you to transfer content from a URL to any writable stream, and similarly transfer any readable stream to a URL.

The higher-level file API abstracts away the streams and allows you to transfer content to/from files on disk.

The `node-httptransfer` package requires the async/await features and is built using the [node-fetch-npm](https://www.npmjs.com/package/node-fetch-npm) package.

To use block transfer capabilities, the upload/download servers must support the range header.

## Installation

```bash
npm i @adobe/httptransfer
```

## Using streams

Download a stream:

```javascript
const { downloadStream } = require('@adobe/httptransfer');
async main() {
    const stream = fs.createWriteStream('test.png');
    await downloadStream('http://my.server.com/test.png', stream);
}
```

Upload a stream using PUT:

```javascript
const { uploadStream } = require('@adobe/httptransfer');
async main() {
    const stream = fs.createReadStream('test.png');
    await uploadStream(stream, 'http://my.server.com/test.png');
}
```

## Using files

Download a file:

```javascript
const { downloadFile } = require('@adobe/httptransfer');
async main() {
    await downloadFile('http://my.server.com/test.png', 'test.png');
}
```

Upload a file using PUT:

```javascript
const { uploadFile } = require('@adobe/httptransfer');
async main() {
    await uploadFile('test.png', 'http://my.server.com/test.png');
}
```

Upload a file to multiple URLs using PUT (used by AEM multi-part upload):

```javascript
const { uploadAEMMultipartFile } = require('@adobe/httptransfer');
async main() {
    await uploadAEMMultipartFile('test.png', {
        urls: [ "http://my.server.com/test.png.1", "http://my.server.com/test.png.2" ],
        maxPartSize: 1000000
    });
}
```
## Using block upload/downland to upload/download files concurrently
```javascript
const { downloadFileConcurrently } = require('@adobe/httptransfer');
async main() {
    await downloadFile('http://my.server.com/test.png', 'test.png');
}
```

Upload a file using PUT:

```javascript
const { uploadFileConcurrently } = require('@adobe/httptransfer');
async main() {
    await uploadFile('test.png', 'http://my.server.com/test.png');
}
```

Upload a file to multiple URLs using PUT (used by AEM multi-part upload):

```javascript
const { uploadMultiPartFileConcurrently } = require('@adobe/httptransfer');
async main() {
    await uploadMultiPartFileConcurrently('test.png', {
        urls: [ "http://my.server.com/test.png.1", "http://my.server.com/test.png.2" ],
        maxPartSize: 1000000
    });
}
```


Upload multiple files to multiple URLs using PUT:

```javascript
const { uploadFilesConcurrently } = require('@adobe/httptransfer');
async main() {
    await uploadFilesConcurrently([{
        filepath: 'file1.png',
        target: {
            urls: [ "http://my.server.com/file1.png.1", "http://my.server.com/file1.png.2" ],
            maxPartSize: 1000000
        }
    }], {
        filepath: 'file2.png',
        target: {
            urls: [ "http://my.server.com/file2.png.1", "http://my.server.com/file2.png.2" ],
            maxPartSize: 1000000
        }
    }]);
}
```

Assuming `test.png` is 1,800,000 bytes this will upload the first 1,000,000 bytes to `http://my.server.com/test.png.1` and the next 800,000 bytes to `http://my.server.com/test.png.2`.

## Testbed

A CLI tool [testbed](./testbed/index.js) is provided to try out the `node-httptransfer` functionality. It supports uploading, downloading, and transferring file content. It also supports Azure Blob stores through Shared Access Signature (SAS) urls created on the fly.

The tool is not intended to be useful on its own, only to test out new features or debug issues.

### Build

```bash
cd testbed/
npm install
```

### Azure credentials

```bash
export AZURE_STORAGE_ACCOUNT=<storage account name from https://portal.azure.com>
export AZURE_STORAGE_KEY=<storage key from https://portal.azure.com>
```

### Examples

Download an image from a website:

```bash
node index.js https://website.com/path/to/image.gif image.gif
```

Download blob.txt from azure:

```bash
node index.js azure://container/path/to/blob.txt blob.txt
```

Upload blob.txt to azure:

```bash
node index.js blob.txt azure://container/path/to/blob.txt
```

Upload blob.txt in 10,000 byte blocks:

```bash
node index.js --max 10000 blob.txt azure://container/path/to/blob.txt
```

Copy blob.txt within a container:

```bash
node index.js azure://container/path/to/blob.txt azure://container/path/to/target.txt
```

## End-to-End Tests

The module provides some integration-style tests for verifying basic transfer functionality
with an Adobe Experience Manager instance. To run the tests:

* Create a `.env` file by following the instructions in [.env_example](./e2e/.env_example).
* Run the tests by executing `npm run e2e` from the root directory of the repository.

## End-to-End block upload/download Tests
If you want to just run the block upload/download tests, you only need [Azure credentials](#Azure-credentials):

```bash
export AZURE_STORAGE_ACCOUNT=<storage account name from https://portal.azure.com>
export AZURE_STORAGE_KEY=<storage key from https://portal.azure.com>
export AZURE_STORAGE_CONTAINER_NAME=<storage container name>
```

The run `npm run e2e-block`

### Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

### Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
