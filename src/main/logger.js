'use strict';

const log = require('electron-log/main');

// File logging is the only realistic way to diagnose problems with the
// undocumented usage/refresh endpoints once this is running on a user's
// machine, without a dev console attached. Rotates automatically once a
// file exceeds the size limit below.
log.initialize();
log.transports.file.maxSize = 1 * 1024 * 1024;
log.transports.file.level = 'info';
log.transports.console.level = 'info';

module.exports = log;
