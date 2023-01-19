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

require("core-js/stable");

const { TransferController, TransferEvents } = require("../controller/transfercontroller");
const { executePipeline, Pipeline } = require("../generator/pipeline");
const { RandomFileAccess } = require("../randomfileaccess");
const EventEmitter = require("events");
const UploadError = require("../block/upload-error");
const { FilterFailedAssets } = require("../functions/filterfailedassets");
const { DirectBinaryUpload } = require("./directbinaryupload");
const { CreateAssetServletUpload } = require("./createassetservletupload");

class AEMUpload extends EventEmitter {
    /**
     * Upload files to AEM
     * 
     * @param {import('typedefs').AEMUploadOptions} options AEM upload options
     */
    async uploadFiles(options) {
        const isDirectBinaryEnabled = await DirectBinaryUpload.isDirectBinaryAccessEnabled(options);
        const binaryUpload = isDirectBinaryEnabled ? new DirectBinaryUpload(options) : new CreateAssetServletUpload(options);

        const controller = new TransferController();
        controller.on(binaryUpload.getFileStartEventName(), transferEvent => {
            this.emit("filestart", transferEvent.transferAsset.eventData);
        });
        controller.on(TransferEvents.JOIN_TRANSFER_PARTS, transferEvent => {
            this.emit("fileprogress", {
                ...transferEvent.transferAsset.eventData,
                transferred: transferEvent.props.transferBytes
            });
        });
        controller.on(binaryUpload.getFileEndEventName(), transferEvent => {
            this.emit("fileend", transferEvent.transferAsset.eventData);
        });
        controller.on(TransferEvents.ERROR, transferEvent => {
            if (transferEvent.props.firstError) {
                this.emit("fileerror", {
                    ...transferEvent.transferAsset.eventData,
                    errors: [ UploadError.fromError(transferEvent.error) ]
                });
            }
        });

        // Build and execute pipeline
        const randomFileAccess = new RandomFileAccess();
        try {
            const pipeline = new Pipeline(...binaryUpload.getPipelineSteps(randomFileAccess));
            pipeline.setFilterFunction(new FilterFailedAssets);
            await executePipeline(pipeline, binaryUpload.generateAEMUploadTransferRecords(), controller);
        } finally {
            await randomFileAccess.close();
        }
    }
}

module.exports = {
    AEMUpload
};
