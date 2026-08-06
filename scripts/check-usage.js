'use strict';

// Live smoke test against the real, undocumented Anthropic usage endpoint,
// using whatever `claude` CLI credentials are on this machine. Run with:
//
//   node scripts/check-usage.js
//
// Does not refresh the token - if it's expired, re-run `claude` (or
// scripts/check-refresh.js) first. Never logs the access/refresh tokens
// themselves, only the usage response.

const { getActiveTokens } = require('../src/usage/credentials');
const { fetchUsage } = require('../src/usage/client');

(async () => {
  const tokens = await getActiveTokens();
  console.log('token expires in', Math.round((tokens.expiresAt - Date.now()) / 60000), 'min');

  const snapshot = await fetchUsage(tokens.accessToken);
  console.log(JSON.stringify(snapshot, null, 2));
})().catch((err) => {
  console.error('FAILED:', err.name, err.code || err.status, err.message);
  if (err.bodyText) console.error('body:', err.bodyText);
  process.exit(1);
});
