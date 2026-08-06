'use strict';

const os = require('os');
const path = require('path');

// Anthropic OAuth usage endpoint. Undocumented - see README for the risk
// this implies (may change or start requiring a different shape without notice).
const USAGE_API_URL = 'https://api.anthropic.com/api/oauth/usage';

// Token refresh endpoint mirrors what the official `claude` CLI does on
// `claude update` / re-login. Publicly known from open reverse-engineering
// projects, not officially documented - verify with scripts/check-refresh.js
// before relying on it in a release.
const OAUTH_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

const ANTHROPIC_BETA_HEADER = 'oauth-2025-04-20';

// Best-effort User-Agent - the server rejects requests with a wrong/missing
// User-Agent with 429. Matches the `claude` CLI version installed on this
// machine at the time this was written; update if requests start failing.
const USER_AGENT = 'claude-code/2.1.220';

// Never poll the usage endpoint more often than this - the limit is
// enforced by Anthropic on the token itself, not just courtesy.
const POLL_MIN_INTERVAL_MS = 180_000;

// Refresh the access token this long before it actually expires, so a
// usage request never races an about-to-expire token.
const TOKEN_REFRESH_SKEW_MS = 5 * 60_000;

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

const REPO_URL = '';

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
