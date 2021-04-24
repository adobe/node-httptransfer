/*
 * Copyright 2020 Adobe. All rights reserved.
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

class Queue {
    constructor() {
        this.items = [];
        this.newItems = Promise.resolve();
        this.newItemsCall = () => true;
    }

    add(item) {
        this.items.push(item);
        if (this.items.length === 1) {
            this.newItemsCall();
        }
    }

    close() {
        this.closed = true;
        this.newItemsCall();
    }

    async *generator() {
        while (!this.closed) {
            // establish newItems and newItemsCall
            await new Promise(resolve1 => {
                this.newItems = new Promise(resolve2 => {
                    this.newItemsCall = resolve2;
                    resolve1();
                });
            });

            // yield any item in the queue
            while (this.items.length > 0) {
                yield this.items.shift();
            }
    
            // wait for the newItems
            console.log("WAIT");
            await this.newItems;    
        }

        // yield any item in the queue
        while (this.items.length > 0) {
            yield this.items.shift();
        }
    }
}

async function main() {
    const queue = new Queue();
    setImmediate(async () => {
        console.log("START");
        for await (const item of queue.generator()) {
            console.log(item);
        }
        console.log("DONE");
    });

    let i = 0;
    const xx = setInterval(() => {
        queue.add(++i);
    }, 3);

    setTimeout(() => {
        clearInterval(xx);
        queue.close();
        console.log(">>>", i);
    }, 10000);
}

main().then(() => console.log("XXX"));

module.exports = {
    Queue
};