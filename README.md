# node-httptransfer

## Introduction

The `node-httptransfer` package is designed to easily and correctly transfer file content from HTTP urls to HTTP urls and between HTTP urls.

The lower-level stream API allows you to transfer content from a URL to any writable stream, and similarly transfer any readable stream to a URL.

The higher-level file API abstracts away the streams and allows you to transfer content to/from files on disk.

The `node-httptransfer` package requires the async/await features and is built using the [node-fetch](https://www.npmjs.com/package/node-fetch) package.

## Installation

Install `node-httptransfer` in to your NodeJS project using:

```javascript
npm i node-httptransfer
```

## Using streams

Download a stream:

```javascript
const { downloadStream } = require('@nui/node-httptransfer');
async main() {
    const stream = fs.createWriteStream('test.png');
    await downloadStream('http://my.server.com/test.png', stream);
}
```

Upload a stream using PUT:

```javascript
const { uploadStream } = require('@nui/node-httptransfer');
async main() {
    const stream = fs.createReadStream('test.png');
    await uploadStream(stream, 'http://my.server.com/test.png');
}
```

## Using files

Download a file:

```javascript
const { downloadFile } = require('@nui/node-httptransfer');
async main() {
    await downloadFile('http://my.server.com/test.png', 'test.png');
}
```

Upload a file using PUT:

```javascript
const { uploadFile } = require('@nui/node-httptransfer');
async main() {
    await uploadFile('test.png', 'http://my.server.com/test.png');
}
```

Upload a file to multiple URLs using PUT:

```javascript
const { uploadMultipartFile } = require('@nui/node-httptransfer');
async main() {
    await uploadMultipartFile('test.png', {
        urls: [ "http://my.server.com/test.png.1", "http://my.server.com/test.png.2" ],
        maxPartSize: 1000000
    });
}
```

Assuming `test.png` is 1,800,000 bytes this will upload the first 1,000,000 bytes to `http://my.server.com/test.png.1` and the next 800,000 bytes to `http://my.server.com/test.png.2`.

### Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

### Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
