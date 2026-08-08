/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Live smoke test against the real Anthropic usage endpoint. Run with:
//   node scripts/check-usage.js
// Does not refresh an expired token - re-run `claude` first if needed.
// Never log the access/refresh tokens themselves, only status/usage data.

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
