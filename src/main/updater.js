/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('./logger');

// Overridable via env var purely for local testing against real GitHub
// Releases without waiting the real delay - never set in production.
const INITIAL_CHECK_DELAY_MS = Number(process.env.CLAUDEQUOTA_UPDATE_CHECK_DELAY_MS) || 45_000;
const RECHECK_INTERVAL_MS = 5 * 60 * 60_000; // 5 hours

// Don't ask again about a version the user already said "Later" to in
// this session - but a newer version than that still gets a fresh prompt.
let dismissedVersion = null;
// Set once the user has consented to install a downloaded update but chose
// "Later" - installed silently on the next normal quit, since consent was
// already given, not on a fresh unrelated decision.
let pendingInstall = false;
// Distinguishes a background check failing (never bother the user) from a
// failure after they explicitly asked to download (they're waiting on it).
let userRequestedDownload = false;

/**
 * Wires up electron-updater with a two-step consent flow: one dialog
 * before downloading, another before installing. autoDownload/
 * autoInstallOnAppQuit are both off so nothing happens without an explicit
 * click. No-ops outside a packaged build - electron-updater needs a real
 * publish feed (or a dev-app-update.yml) to have anything to check against.
 */
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
      // Consent to install was already given - just deferred. Installed
      // silently on the next normal quit via quitOrInstall() below, not
      // re-prompted.
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
    // Otherwise (background check failure - no internet, GitHub
    // unreachable, etc.) stay quiet; the next scheduled check will retry.
  });

  setTimeout(() => autoUpdater.checkForUpdates(), INITIAL_CHECK_DELAY_MS);
  setInterval(() => autoUpdater.checkForUpdates(), RECHECK_INTERVAL_MS);
}

/**
 * Called from the "Quit" menu item instead of app.quit() directly. If the
 * user already consented to installing a downloaded update but deferred
 * it, this installs it now - that's honoring an earlier explicit "yes",
 * not a new silent decision. Otherwise quits normally.
 */
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
