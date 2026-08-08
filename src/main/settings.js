/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DISPLAY_STYLES = ['bars', 'circles'];
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

/**
 * @returns {'bars'|'circles'}
 */
function getDisplayStyle() {
  const style = readSettings().displayStyle;
  return DISPLAY_STYLES.includes(style) ? style : DEFAULT_DISPLAY_STYLE;
}

/**
 * @param {'bars'|'circles'} style
 */
function setDisplayStyle(style) {
  if (!DISPLAY_STYLES.includes(style)) {
    throw new Error(`unknown display style: ${style}`);
  }
  const settings = { ...readSettings(), displayStyle: style };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings));
}

module.exports = {
  DISPLAY_STYLES,
  getDisplayStyle,
  setDisplayStyle,
};
