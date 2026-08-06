'use strict';

const { app, dialog, shell } = require('electron');
const { REPO_URL } = require('./constants');

/**
 * `dialog.showMessageBox` needs no BrowserWindow parent and no renderer -
 * this is the entire "About" UI for the app.
 */
async function showAboutDialog() {
  const buttons = REPO_URL ? ['Закрити', 'Репозиторій на GitHub'] : ['Закрити'];

  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Про ClaudeQuota',
    message: `ClaudeQuota v${app.getVersion()}`,
    detail:
      "Показує використання 5-годинного та тижневого лімітів Claude через API Anthropic (/api/oauth/usage), використовуючи облікові дані, збережені локально Claude Code CLI (~/.claude/.credentials.json). Дані не передаються нікуди, окрім api.anthropic.com.",
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
