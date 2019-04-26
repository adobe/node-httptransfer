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

module.exports = {
    "extends": "problems",
    "env": {
        "node": true
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "plugins": [
        "mocha"
    ],
    "rules": {
        "prefer-arrow-callback": "off",
        "prefer-template": "off",
        "object-shorthand": "off",
        "no-console": ["off", {"allow": true}],
        "template-curly-spacing": ["warn", "never"],
        "no-else-return": "off",
        "mocha/no-exclusive-tests": "error",
        "mocha/no-identical-title": "error",
        "mocha/no-mocha-arrows": "error",
        "mocha/no-nested-tests": "error",
        "mocha/no-pending-tests": "error",
        "mocha/no-return-and-callback": "error",
        "mocha/no-sibling-hooks": "error",
        "mocha/no-async-describe": "error"
    }
};
