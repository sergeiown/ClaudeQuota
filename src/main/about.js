'use strict';

const { app, dialog, shell } = require('electron');
const { REPO_URL } = require('./constants');

/**
 * `dialog.showMessageBox` needs no BrowserWindow parent and no renderer -
 * this is the entire "About" UI for the app.
 */
async function showAboutDialog() {
  const buttons = REPO_URL ? ['Close', 'Repository on GitHub'] : ['Close'];

  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'About ClaudeQuota',
    message: `ClaudeQuota v${app.getVersion()}`,
    detail:
      'Shows your Claude 5-hour and weekly limit usage via the Anthropic API (/api/oauth/usage), using credentials saved locally by the Claude Code CLI (~/.claude/.credentials.json). Data is sent nowhere except api.anthropic.com.',
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
