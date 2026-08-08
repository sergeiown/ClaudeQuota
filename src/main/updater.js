/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('./logger');

// Never set CLAUDEQUOTA_UPDATE_CHECK_DELAY_MS in production - local testing only.
const INITIAL_CHECK_DELAY_MS = Number(process.env.CLAUDEQUOTA_UPDATE_CHECK_DELAY_MS) || 45_000;
const RECHECK_INTERVAL_MS = 5 * 60 * 60_000;

let dismissedVersion = null;
let pendingInstall = false;
let userRequestedDownload = false;

function initAutoUpdater() {
  if (!app.isPackaged) {
    log.info('updater: skipped (not packaged)');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    log.info('updater: checking for update');
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('updater: no update available, latest is', info.version);
  });

  autoUpdater.on('update-available', async (info) => {
    log.info('updater: update available', info.version);
    if (dismissedVersion === info.version) return;

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update available',
      message: `ClaudeQuota ${info.version} is available`,
      detail: 'Download it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      userRequestedDownload = true;
      autoUpdater.downloadUpdate();
    } else {
      dismissedVersion = info.version;
    }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    log.info('updater: update downloaded', info.version);
    userRequestedDownload = false;

    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'Update ready',
      message: `ClaudeQuota ${info.version} has been downloaded`,
      detail: 'Restart ClaudeQuota now to finish installing it? This only restarts the app, not Windows.',
      buttons: ['Restart ClaudeQuota', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    } else {
      pendingInstall = true;
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('updater: error', err.message);
    if (userRequestedDownload) {
      userRequestedDownload = false;
      dialog.showMessageBox({
        type: 'error',
        title: 'Update failed',
        message: 'Could not download the update',
        detail: err.message,
        buttons: ['Close'],
      });
    }
  });

  setTimeout(() => autoUpdater.checkForUpdates(), INITIAL_CHECK_DELAY_MS);
  setInterval(() => autoUpdater.checkForUpdates(), RECHECK_INTERVAL_MS);
}

function quitOrInstall() {
  if (pendingInstall) {
    autoUpdater.quitAndInstall();
  } else {
    app.quit();
  }
}

module.exports = {
  initAutoUpdater,
  quitOrInstall,
};
