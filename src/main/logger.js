/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const log = require('electron-log/main');

log.initialize();
log.transports.file.maxSize = 1 * 1024 * 1024;
log.transports.file.level = 'info';
log.transports.console.level = 'info';

module.exports = log;
