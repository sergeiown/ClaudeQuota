'use strict';

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

module.exports = {
  isAutoLaunchEnabled,
  setAutoLaunchEnabled,
};
