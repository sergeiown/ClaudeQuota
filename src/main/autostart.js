/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

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
