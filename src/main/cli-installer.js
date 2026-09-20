/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { spawn } = require('child_process');
const { shell } = require('electron');
const log = require('./logger');

const AUTH_URL_PATTERN = /https:\/\/\S+/;
const CODE_PROMPT_GRACE_MS = 2000;

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

function runClaudeAuthLogin(exePath, { onNeedsCode } = {}) {
  // .cmd/.bat shims (npm-global installs) can only run through cmd.exe on Windows -
  // spawn() silently fails to launch them directly otherwise.
  const needsCmd = /\.(cmd|bat)$/i.test(exePath);
  const command = needsCmd ? 'cmd.exe' : exePath;
  const args = needsCmd ? ['/c', exePath, 'auth', 'login'] : ['auth', 'login'];
  const child = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    // BROWSER=none stops the CLI from also opening its own tab (it respects this
    // convention, same as many Node CLIs) - we open the URL ourselves below instead,
    // since the CLI's own attempt is unreliable when spawned this way.
    env: { ...process.env, BROWSER: 'none' },
  });

  let buffer = '';
  let urlOpened = false;
  let finished = false;
  let promptTimerScheduled = false;

  const handleOutput = (chunk) => {
    buffer += chunk.toString();
    if (!urlOpened) {
      const match = buffer.match(AUTH_URL_PATTERN);
      if (match) {
        urlOpened = true;
        shell.openExternal(match[0]);
      }
    }
    if (/login successful/i.test(buffer)) {
      finished = true;
    }
    // The OAuth callback usually completes on its own via a local listener - the CLI
    // still always prints this prompt regardless, so only treat it as "needs a code
    // pasted back in" if login hasn't finished shortly after it appears.
    if (!promptTimerScheduled && !finished && /paste code here/i.test(buffer)) {
      promptTimerScheduled = true;
      setTimeout(() => {
        if (!finished && onNeedsCode) onNeedsCode();
      }, CODE_PROMPT_GRACE_MS);
    }
  };
  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);
  child.on('error', (err) => log.error('cli-installer: failed to start claude auth login', err));
  child.on('exit', () => {
    finished = true;
  });

  return {
    submitCode(code) {
      child.stdin.write(`${code.trim()}\n`);
    },
  };
}

module.exports = {
  installClaudeCli,
  runClaudeAuthLogin,
};
