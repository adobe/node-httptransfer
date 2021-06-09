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

const { EventEmitter } = require("events");
const { IllegalArgumentError } = require("../error");

/**
 * Queue that follows the WriteStream paradigm where new items can be added 
 * to the queue until a predefined capacity.
 * 
 * Once capacity opens up to add more items, it emits the "drained" event.
 * 
 */
class Queue extends EventEmitter {
    /**
     * Construct a Queue
     */
    constructor(capacity) {
        super();
        if (!Number.isFinite(capacity) || capacity < 1) {
            throw new IllegalArgumentError("capacity must be 1 or larger", capacity);
        }
        this.capacity = capacity;
        this.queue = [];
        this.done = false;
        this.newItemsInQueueCallback = () => {};
    }

    /**
     * Add an item to the queue
     * 
     * @param {*} item Item to add to the queue
     * @returns {Boolean} True if the capacity has been reached
     */
    add(item) {
        if (this.done) {
            throw Error(`Queue has been completed, rejecting new item: ${item}`);
        }
        this.queue.push(item);
        this.newItemsInQueueCallback();
        return (this.queue.length < this.capacity);
    }

    /**
     * Call when no more items are 
     */
    complete() {
        this.done = true;
        this.newItemsInQueueCallback();
    }

    /**
     * Consuming the queue is through async iteration
     */
    async* [Symbol.asyncIterator]() {
        while ((this.queue.length > 0) || !this.done) {
            // clear out the queue, not that on yield we will
            // yields our time slice where new items can be added to the queue
            while (this.queue.length > 0) {
                const item = this.queue.shift();

                // let the listener know when we have capacity to add a new item
                // do this before yielding so the producer can be unblocked immediately 
                if (this.queue.length < this.capacity) {
                    this.emit("drained");
                }

                yield item;
            }

            // queue has been drained
            const newItemsInQueue = new Promise(resolve => {
                this.newItemsInQueueCallback = resolve;

                // resolve immediately if new items were added to the queue when
                // we gave up our time slice or the queue is complete
                if (this.done) {
                    this.newItemsInQueueCallback();
                } else if (this.queue.length > 0) {
                    this.newItemsInQueueCallback();
                }
            });

            // wait for new items in the queue, or if the 
            await newItemsInQueue;
        }
    }
}

module.exports = {
    Queue
};