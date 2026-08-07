/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { CREDENTIALS_PATH } = require('../main/constants');
const { CredentialsError } = require('./errors');

// Intentionally does not `require('electron')` so this module (and
// scripts/check-usage.js, which runs it under plain `node`) works outside
// an Electron process. This happens to resolve to the exact same folder
// Electron's `app.getPath('userData')` would use by default on Windows
// (%APPDATA%\<productName>), since that default is just APPDATA + app name.
function getDefaultCacheDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'ClaudeQuota');
}

const TOKEN_CACHE_PATH = path.join(getDefaultCacheDir(), 'token-cache.json');

function validateOauthShape(claudeAiOauth) {
  if (!claudeAiOauth || typeof claudeAiOauth !== 'object') {
    throw new CredentialsError('MALFORMED', 'credentials.json is missing claudeAiOauth');
  }
  const { accessToken, refreshToken, expiresAt } = claudeAiOauth;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new CredentialsError('MALFORMED', 'claudeAiOauth.accessToken is missing or invalid');
  }
  if (typeof expiresAt !== 'number') {
    throw new CredentialsError('MALFORMED', 'claudeAiOauth.expiresAt is missing or invalid');
  }
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new CredentialsError('MISSING_REFRESH_TOKEN', 'claudeAiOauth.refreshToken is missing');
  }
}

function normalize(claudeAiOauth) {
  return {
    accessToken: claudeAiOauth.accessToken,
    refreshToken: claudeAiOauth.refreshToken,
    expiresAt: claudeAiOauth.expiresAt,
    // Some accounts/CLI versions may not set this; treat as "far in the future"
    // rather than crashing, the field is only used to short-circuit refresh attempts.
    refreshTokenExpiresAt:
      typeof claudeAiOauth.refreshTokenExpiresAt === 'number'
        ? claudeAiOauth.refreshTokenExpiresAt
        : Infinity,
  };
}

async function readParsedCredentialsFile() {
  let raw;
  try {
    raw = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new CredentialsError('MISSING_FILE', `${CREDENTIALS_PATH} does not exist`);
    }
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new CredentialsError('MALFORMED', 'credentials.json is not valid JSON');
  }
}

/**
 * Reads ~/.claude/.credentials.json fresh from disk (never cached) and
 * returns the normalized OAuth token set. Never writes to this file - it
 * belongs to the `claude` CLI, not this app.
 *
 * Retries once after a short delay on a JSON parse failure, since the CLI
 * can be caught mid-write when it rotates the file itself.
 */
async function readCredentials() {
  let parsed;
  try {
    parsed = await readParsedCredentialsFile();
  } catch (err) {
    if (err instanceof CredentialsError && err.code === 'MALFORMED') {
      await new Promise((resolve) => setTimeout(resolve, 500));
      parsed = await readParsedCredentialsFile();
    } else {
      throw err;
    }
  }

  validateOauthShape(parsed.claudeAiOauth);
  return normalize(parsed.claudeAiOauth);
}

async function readTokenCache() {
  try {
    const raw = await fs.readFile(TOKEN_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Atomically persists a refreshed token set to a private cache, separate
 * from the CLI-owned credentials file (write tmp file, then rename).
 */
async function saveRefreshedTokens(tokens) {
  const dir = path.dirname(TOKEN_CACHE_PATH);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${TOKEN_CACHE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(tokens), 'utf8');
  await fs.rename(tmpPath, TOKEN_CACHE_PATH);
}

/**
 * Returns the freshest known token set by comparing the CLI's credentials
 * file against our private cache and keeping whichever has the later
 * expiresAt. Covers the case where the user re-logged in via the CLI (or
 * the CLI refreshed on its own) while this app was holding an older token.
 */
async function getActiveTokens() {
  const fromFile = await readCredentials();
  const fromCache = await readTokenCache();

  if (!fromCache || fromCache.expiresAt <= fromFile.expiresAt) {
    return fromFile;
  }
  return fromCache;
}

module.exports = {
  readCredentials,
  saveRefreshedTokens,
  getActiveTokens,
};
