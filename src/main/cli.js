/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const NATIVE_CLI_PATH = path.join(os.homedir(), '.local', 'bin', 'claude.exe');

function findClaudeExecutable() {
  if (fs.existsSync(NATIVE_CLI_PATH)) return NATIVE_CLI_PATH;
  try {
    const out = execFileSync('where', ['claude'], { encoding: 'utf8', windowsHide: true });
    const first = out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

module.exports = {
  findClaudeExecutable,
  NATIVE_CLI_PATH,
};
