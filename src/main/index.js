/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { app, nativeTheme, shell } = require('electron');

const log = require('./logger');
const { createUsagePoller } = require('../usage/poller');
const { createTrayController } = require('./tray');
const { isAutoLaunchEnabled, setAutoLaunchEnabled, enableAutoLaunchOnFirstRun } = require('./autostart');
const { getDisplayStyle, setDisplayStyle } = require('./settings');
const { showAboutDialog } = require('./about');
const { initAutoUpdater, quitOrInstall } = require('./updater');

let poller = null;

process.on('uncaughtException', (err) => log.error('uncaughtException', err));
process.on('unhandledRejection', (err) => log.error('unhandledRejection', err));

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (poller) poller.requestImmediateCheck();
  });

  app.whenReady().then(bootstrap);
}

function bootstrap() {
  log.info('ClaudeQuota starting', app.getVersion());

  enableAutoLaunchOnFirstRun();

  const tray = createTrayController({
    isDark: nativeTheme.shouldUseDarkColors,
    getAutoLaunchEnabled: isAutoLaunchEnabled,
    onToggleAutoLaunch: () => setAutoLaunchEnabled(!isAutoLaunchEnabled()),
    getDisplayStyle,
    onToggleDisplayStyle: () => setDisplayStyle(getDisplayStyle() === 'bars' ? 'columns' : 'bars'),
    onOpenLog: () => shell.openPath(log.transports.file.getFile().path),
    onAbout: showAboutDialog,
    onQuit: quitOrInstall,
    onRequestRefresh: () => poller && poller.requestImmediateCheck(),
  });

  poller = createUsagePoller({
    onSnapshot: (snapshot) => {
      log.info('usage snapshot', {
        fiveHour: snapshot.fiveHour && snapshot.fiveHour.utilization,
        sevenDay: snapshot.sevenDay && snapshot.sevenDay.utilization,
      });
      tray.showSnapshot(snapshot);
    },
    onStatus: (status, detail) => {
      // Never log tokens themselves - only status codes/messages/bodies.
      log.warn('usage poller status', status, detail || '');
      tray.showStatus(status);
    },
  });

  nativeTheme.on('updated', () => {
    tray.refreshTheme(nativeTheme.shouldUseDarkColors);
  });

  poller.start();
  initAutoUpdater();

  app.on('before-quit', () => {
    poller.stop();
    tray.destroy();
  });
}
