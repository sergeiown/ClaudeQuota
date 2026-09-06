/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const NATIVE_CLI_PATH = path.join(os.homedir(), '.local', 'bin', 'claude.exe');

const EXECUTABLE_EXTENSION_PRIORITY = ['.exe', '.cmd', '.bat'];

function findClaudeExecutable() {
  if (fs.existsSync(NATIVE_CLI_PATH)) return NATIVE_CLI_PATH;
  try {
    const out = execFileSync('where', ['claude'], { encoding: 'utf8', windowsHide: true });
    const candidates = out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    // npm's global install also drops an extensionless POSIX shell script (for Git
    // Bash/WSL) alongside the real .cmd/.exe launcher - Windows can't run that one
    // directly, so only consider paths with a recognized executable extension.
    for (const ext of EXECUTABLE_EXTENSION_PRIORITY) {
      const match = candidates.find((p) => p.toLowerCase().endsWith(ext));
      if (match) return match;
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  findClaudeExecutable,
  NATIVE_CLI_PATH,
};
