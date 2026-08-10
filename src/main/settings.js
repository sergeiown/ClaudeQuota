/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DISPLAY_STYLES = ['bars', 'columns'];
const DEFAULT_DISPLAY_STYLE = 'bars';

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function getDisplayStyle() {
  const style = readSettings().displayStyle;
  return DISPLAY_STYLES.includes(style) ? style : DEFAULT_DISPLAY_STYLE;
}

function setDisplayStyle(style) {
  if (!DISPLAY_STYLES.includes(style)) {
    throw new Error(`unknown display style: ${style}`);
  }
  writeSettings({ displayStyle: style });
}

function writeSettings(patch) {
  const settings = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings));
}

function getNotificationsEnabled() {
  const value = readSettings().notificationsEnabled;
  return typeof value === 'boolean' ? value : true;
}

function setNotificationsEnabled(enabled) {
  writeSettings({ notificationsEnabled: enabled });
}

module.exports = {
  DISPLAY_STYLES,
  getDisplayStyle,
  setDisplayStyle,
  getNotificationsEnabled,
  setNotificationsEnabled,
};
