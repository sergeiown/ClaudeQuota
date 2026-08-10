/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { app } = require('electron');

// Electron keys the Run entry to the AppUserModelID once one is set - users
// who already had autostart enabled under the older default key name need
// migrating, or getLoginItemSettings() reports false despite the app still
// actually autostarting via the stale key.
const LEGACY_RUN_KEY_NAME = 'electron.app.ClaudeQuota';
const RUN_KEY_PATH = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

function migrateLegacyAutoLaunchKey() {
  if (process.platform !== 'win32') return;
  try {
    execSync(`reg query "${RUN_KEY_PATH}" /v ${LEGACY_RUN_KEY_NAME}`, { stdio: 'ignore' });
  } catch {
    return;
  }
  setAutoLaunchEnabled(true);
  try {
    execSync(`reg delete "${RUN_KEY_PATH}" /v ${LEGACY_RUN_KEY_NAME} /f`, { stdio: 'ignore' });
  } catch {}
}

function isAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunchEnabled(enabled) {
  if (!app.isPackaged) {
    console.warn(
      '[autostart] app is not packaged - the registered path will point at this dev checkout, not a real install.'
    );
  }
  app.setLoginItemSettings({ openAtLogin: enabled });
}

function firstRunMarkerPath() {
  return path.join(app.getPath('userData'), 'first-run-complete');
}

// Only sets the initial default on the very first launch after install; never
// overrides a later manual toggle.
function enableAutoLaunchOnFirstRun() {
  migrateLegacyAutoLaunchKey();

  const markerPath = firstRunMarkerPath();
  if (fs.existsSync(markerPath)) return;

  setAutoLaunchEnabled(true);

  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, new Date().toISOString());
}

module.exports = {
  isAutoLaunchEnabled,
  setAutoLaunchEnabled,
  enableAutoLaunchOnFirstRun,
};
