/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Thin wrapper over Electron's built-in login item settings. On Windows
 * this writes/removes an HKCU\...\Run registry entry - no external
 * `auto-launch` package needed for this simple on/off toggle.
 */

function isAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunchEnabled(enabled) {
  if (!app.isPackaged) {
    // In dev, this registers whatever electron.exe launched this checkout -
    // it will stop working if the folder moves. Still fine for testing the
    // toggle itself.
    console.warn(
      '[autostart] app is not packaged - the registered path will point at this dev checkout, not a real install.'
    );
  }
  app.setLoginItemSettings({ openAtLogin: enabled });
}

function firstRunMarkerPath() {
  return path.join(app.getPath('userData'), 'first-run-complete');
}

/**
 * Turns autostart on exactly once, the very first time the app is ever
 * launched (typically right after a fresh install, since electron-builder's
 * NSIS installer launches the app on completion). Does nothing on every
 * later launch, and never overrides a user who has since turned it back
 * off via the tray menu - that's a real toggle from then on, this only
 * picks its initial default.
 */
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
