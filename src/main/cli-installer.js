/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { spawn } = require('child_process');
const log = require('./logger');

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
  // .cmd/.bat shims (npm-global installs) can only run through cmd.exe on Windows -
  // spawn() silently fails to launch them directly otherwise.
  const needsCmd = /\.(cmd|bat)$/i.test(exePath);
  const command = needsCmd ? 'cmd.exe' : exePath;
  const args = needsCmd ? ['/c', exePath, 'auth', 'login'] : ['auth', 'login'];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', (err) => log.error('cli-installer: failed to start claude auth login', err));
  child.unref();
}

module.exports = {
  installClaudeCli,
  runClaudeAuthLogin,
};
