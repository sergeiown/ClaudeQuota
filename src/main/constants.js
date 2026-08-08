/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const os = require('os');
const path = require('path');

// Undocumented Anthropic endpoint - may change shape without notice.
const USAGE_API_URL = 'https://api.anthropic.com/api/oauth/usage';

// Not officially documented - verify with scripts/check-refresh.js before relying on it.
const OAUTH_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

const ANTHROPIC_BETA_HEADER = 'oauth-2025-04-20';

// A wrong/missing User-Agent gets a 429 from the server. Update if requests start failing.
const USER_AGENT = 'claude-code/2.1.220';

// Server-enforced floor on the token itself, not just courtesy - never lower this.
const POLL_MIN_INTERVAL_MS = 180_000;

const TOKEN_REFRESH_SKEW_MS = 5 * 60_000;

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

const REPO_URL = 'https://github.com/sergeiown/ClaudeQuota';

module.exports = {
  USAGE_API_URL,
  OAUTH_TOKEN_URL,
  OAUTH_CLIENT_ID,
  ANTHROPIC_BETA_HEADER,
  USER_AGENT,
  POLL_MIN_INTERVAL_MS,
  TOKEN_REFRESH_SKEW_MS,
  CREDENTIALS_PATH,
  REPO_URL,
};
