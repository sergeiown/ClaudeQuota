'use strict';

const { OAUTH_TOKEN_URL, OAUTH_CLIENT_ID } = require('../main/constants');
const { RefreshError } = require('./errors');

function normalizeRefreshResponse(body) {
  const accessToken = body.access_token || body.accessToken;
  const refreshToken = body.refresh_token || body.refreshToken;
  const expiresInSec = body.expires_in ?? body.expiresIn;

  if (!accessToken || !refreshToken || typeof expiresInSec !== 'number') {
    throw new RefreshError(
      'UNKNOWN',
      'refresh response is missing access_token/refresh_token/expires_in'
    );
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresInSec * 1000,
    // The token endpoint doesn't tell us the refresh token's own expiry;
    // callers should keep whatever refreshTokenExpiresAt they already had.
  };
}

/**
 * Exchanges a refresh token for a new access token, mirroring what the
 * `claude` CLI does on `claude update` / re-login. The token endpoint and
 * client_id are not officially documented - see scripts/check-refresh.js
 * to verify this against a real account before relying on it in a release.
 *
 * @param {string} refreshToken
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: number}>}
 */
async function refreshAccessToken(refreshToken) {
  let response;
  try {
    response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: OAUTH_CLIENT_ID,
      }),
    });
  } catch (err) {
    throw new RefreshError('NETWORK', err.message);
  }

  const text = await response.text();

  if (!response.ok) {
    let parsedError;
    try {
      parsedError = JSON.parse(text);
    } catch {
      parsedError = null;
    }
    if (parsedError && parsedError.error === 'invalid_grant') {
      throw new RefreshError('INVALID_GRANT', text, response.status);
    }
    throw new RefreshError('UNKNOWN', text, response.status);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new RefreshError('UNKNOWN', 'refresh response is not valid JSON', response.status);
  }

  return normalizeRefreshResponse(body);
}

module.exports = {
  refreshAccessToken,
};
