/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { spawn } = require('child_process');

function installClaudeCli() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'winget',
      ['install', '--id', 'Anthropic.ClaudeCode', '-e', '--accept-source-agreements', '--accept-package-agreements'],
      { windowsHide: true, stdio: 'ignore' }
    );
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`winget install exited with code ${code}`));
    });
  });
}

function runClaudeAuthLogin(exePath) {
  const child = spawn(exePath, ['auth', 'login'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

module.exports = {
  installClaudeCli,
  runClaudeAuthLogin,
};
