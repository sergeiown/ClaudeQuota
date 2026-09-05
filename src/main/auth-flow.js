/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const path = require('path');

const { findClaudeExecutable } = require('./cli');
const { installClaudeCli, runClaudeAuthLogin } = require('./cli-installer');
const { CREDENTIALS_PATH } = require('./constants');
const log = require('./logger');

const NEEDS_ACTION_KINDS = new Set(['missing-credentials', 'refresh-token-expired', 'auth-error']);

const OPENING_BROWSER_DISPLAY_MS = 4000;

function createAuthFlowController({ onStateChange, onNeedsAttention, onCredentialsChanged } = {}) {
  let state = 'idle';
  let autoLoginFiredForEpisode = false;
  let watcher = null;

  function setState(next) {
    state = next;
    if (onStateChange) onStateChange();
  }

  function watchCredentials() {
    if (watcher) return;
    try {
      watcher = fs.watch(path.dirname(CREDENTIALS_PATH), { persistent: false }, (event, filename) => {
        if (filename && filename !== path.basename(CREDENTIALS_PATH)) return;
        if (onCredentialsChanged) onCredentialsChanged();
      });
    } catch (err) {
      log.warn('auth-flow: could not watch credentials directory', err.message);
    }
  }

  function stopWatching() {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  }

  function triggerLogin() {
    const exePath = findClaudeExecutable();
    if (!exePath) {
      setState('confirm-install');
      if (onNeedsAttention) onNeedsAttention();
      return;
    }
    setState('opening-browser');
    watchCredentials();
    try {
      runClaudeAuthLogin(exePath);
    } catch (err) {
      log.error('auth-flow: failed to start claude auth login', err);
    }
    setTimeout(() => {
      if (state === 'opening-browser') setState('idle');
    }, OPENING_BROWSER_DISPLAY_MS);
  }

  async function triggerInstall() {
    setState('installing');
    try {
      await installClaudeCli();
      triggerLogin();
    } catch (err) {
      log.error('auth-flow: CLI install failed', err);
      setState('confirm-install');
    }
  }

  function getAction(kind) {
    if (state === 'confirm-install') return { label: 'Install Claude CLI', disabled: false, run: triggerInstall };
    if (state === 'installing') return { label: 'Installing…', disabled: true };
    if (state === 'opening-browser') return { label: 'Opening browser…', disabled: true };
    if (NEEDS_ACTION_KINDS.has(kind)) return { label: 'Log in', disabled: false, run: triggerLogin };
    return null;
  }

  function retryAction(kind) {
    const action = getAction(kind);
    if (action && action.run) action.run();
  }

  function handleStatus(kind) {
    if (!NEEDS_ACTION_KINDS.has(kind)) {
      autoLoginFiredForEpisode = false;
      stopWatching();
      return;
    }
    if (autoLoginFiredForEpisode) return;
    autoLoginFiredForEpisode = true;
    triggerLogin();
  }

  function reset() {
    autoLoginFiredForEpisode = false;
    stopWatching();
    if (state !== 'installing') setState('idle');
  }

  function destroy() {
    stopWatching();
  }

  return { handleStatus, getAction, retryAction, reset, destroy };
}

module.exports = { createAuthFlowController };
