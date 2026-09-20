/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { spawn } = require('child_process');
const { shell } = require('electron');
const log = require('./logger');

const AUTH_URL_PATTERN = /https:\/\/\S+/;

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
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // claude auth login prints the OAuth URL and normally opens it itself, but that
  // relies on its own child process being able to launch a browser - unreliable when
  // spawned this way from a packaged, windowsHide'd process. Open it ourselves instead,
  // parsed straight from the CLI's own "If the browser didn't open, visit: ..." output.
  let opened = false;
  let buffer = '';
  const scanForUrl = (chunk) => {
    if (opened) return;
    buffer += chunk.toString();
    const match = buffer.match(AUTH_URL_PATTERN);
    if (match) {
      opened = true;
      shell.openExternal(match[0]);
    }
  };
  child.stdout.on('data', scanForUrl);
  child.stderr.on('data', scanForUrl);

  child.on('error', (err) => log.error('cli-installer: failed to start claude auth login', err));
  child.unref();
}

module.exports = {
  installClaudeCli,
  runClaudeAuthLogin,
};
