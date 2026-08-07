/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const path = require('path');
const { app, dialog, shell, nativeImage } = require('electron');
const { REPO_URL } = require('./constants');

// build/icon-source.png must be listed in electron-builder.yml's `files`
// so it actually ships inside the packaged app, not just the dev checkout.
const ICON_PATH = path.join(app.getAppPath(), 'build', 'icon-source.png');

/**
 * `dialog.showMessageBox` needs no BrowserWindow parent and no renderer -
 * this is the entire "About" UI for the app.
 */
async function showAboutDialog() {
  const buttons = REPO_URL ? ['Close', 'Repository on GitHub'] : ['Close'];

  const result = await dialog.showMessageBox({
    type: 'info',
    icon: nativeImage.createFromPath(ICON_PATH),
    title: 'About ClaudeQuota',
    message: `ClaudeQuota v${app.getVersion()}`,
    detail:
      'Tray monitor for your Claude 5-hour and weekly usage limits. Uses your local Claude Code CLI session - nothing leaves your machine except calls to api.anthropic.com.\n\nLicensed under the MIT License.',
    buttons,
    defaultId: 0,
    cancelId: 0,
  });

  if (REPO_URL && result.response === 1) {
    shell.openExternal(REPO_URL);
  }
}

module.exports = {
  showAboutDialog,
};
