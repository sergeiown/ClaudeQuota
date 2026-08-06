'use strict';

const { app, nativeTheme, shell } = require('electron');

const log = require('./logger');
const { createUsagePoller } = require('../usage/poller');
const { createTrayController } = require('./tray');
const { isAutoLaunchEnabled, setAutoLaunchEnabled, enableAutoLaunchOnFirstRun } = require('./autostart');
const { showAboutDialog } = require('./about');
const { initAutoUpdater, quitOrInstall } = require('./updater');

// Tray-only app: no BrowserWindow is ever created, so Electron's default
// "quit when all windows are closed" never triggers (there's no window to
// close in the first place). The only place app.quit()/quitAndInstall() is
// called is the "Quit" menu item (via updater.quitOrInstall), wired up below.

let poller = null;

process.on('uncaughtException', (err) => log.error('uncaughtException', err));
process.on('unhandledRejection', (err) => log.error('unhandledRejection', err));

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  // Another instance (e.g. one started via autostart, another via a
  // manual double-click) already owns the tray icon - don't create a
  // second one.
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
      // Never log tokens themselves - only status codes/messages/bodies,
      // which is all `detail` ever contains (see poller.js).
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
