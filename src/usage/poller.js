/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { getActiveTokens, saveRefreshedTokens } = require('./credentials');
const { refreshAccessToken } = require('./oauth');
const { fetchUsage } = require('./client');
const { isExpiringSoon, isRefreshTokenExpired } = require('./tokens');
const { CredentialsError, RefreshError, UsageHttpError } = require('./errors');
const { POLL_MIN_INTERVAL_MS, TOKEN_REFRESH_SKEW_MS } = require('../main/constants');

const CREDENTIALS_RECHECK_MS = 60_000;

const NETWORK_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

const STALE_AFTER_FAILURES = 2;

const STATUS = {
  MISSING_CREDENTIALS: 'missing-credentials',
  REFRESH_TOKEN_EXPIRED: 'refresh-token-expired',
  AUTH_ERROR: 'auth-error',
  OFFLINE: 'offline',
  RATE_LIMITED: 'rate-limited',
};

function createUsagePoller({ onSnapshot, onStatus }) {
  let timer = null;
  let stopped = true;

  let lastSuccessfulUsageFetchAt = 0;
  let consecutiveUsageFailures = 0;
  let consecutiveNetworkFailures = 0;
  let knownBadRefreshToken = null;
  let loggedFirstRateLimit = false;

  function schedule(delayMs) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(tick, Math.max(0, delayMs));
  }

  async function tick() {
    if (stopped) return;

    let tokens;
    try {
      tokens = await getActiveTokens();
    } catch (err) {
      if (err instanceof CredentialsError) {
        onStatus(
          err.code === 'MISSING_FILE' || err.code === 'MISSING_REFRESH_TOKEN'
            ? STATUS.MISSING_CREDENTIALS
            : STATUS.MISSING_CREDENTIALS,
          { code: err.code, message: err.message }
        );
        schedule(CREDENTIALS_RECHECK_MS);
        return;
      }
      throw err;
    }

    if (isRefreshTokenExpired(tokens.refreshTokenExpiresAt)) {
      onStatus(STATUS.REFRESH_TOKEN_EXPIRED);
      schedule(CREDENTIALS_RECHECK_MS);
      return;
    }

    if (tokens.refreshToken === knownBadRefreshToken) {
      onStatus(STATUS.AUTH_ERROR);
      schedule(CREDENTIALS_RECHECK_MS);
      return;
    }

    if (isExpiringSoon(tokens.expiresAt, TOKEN_REFRESH_SKEW_MS)) {
      try {
        const refreshed = await refreshAccessToken(tokens.refreshToken);
        tokens = {
          ...tokens,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
        };
        await saveRefreshedTokens(tokens);
        consecutiveNetworkFailures = 0;
      } catch (err) {
        if (err instanceof RefreshError && err.code === 'INVALID_GRANT') {
          knownBadRefreshToken = tokens.refreshToken;
          onStatus(STATUS.AUTH_ERROR, { message: err.message });
          schedule(CREDENTIALS_RECHECK_MS);
          return;
        }
        if (err instanceof RefreshError && err.code === 'NETWORK') {
          const delay =
            NETWORK_BACKOFF_MS[Math.min(consecutiveNetworkFailures, NETWORK_BACKOFF_MS.length - 1)];
          consecutiveNetworkFailures += 1;
          onStatus(STATUS.OFFLINE, { message: err.message });
          schedule(delay);
          return;
        }
        onStatus(STATUS.AUTH_ERROR, { message: err.message });
        schedule(CREDENTIALS_RECHECK_MS);
        return;
      }
    }

    const dueForUsagePoll =
      lastSuccessfulUsageFetchAt === 0 ||
      Date.now() - lastSuccessfulUsageFetchAt >= POLL_MIN_INTERVAL_MS;

    if (dueForUsagePoll) {
      await pollUsageOnce(tokens);
    }

    scheduleNextTick(tokens);
  }

  async function pollUsageOnce(tokens, isRetryAfterForcedRefresh = false) {
    try {
      const snapshot = await fetchUsage(tokens.accessToken);
      lastSuccessfulUsageFetchAt = Date.now();
      consecutiveUsageFailures = 0;
      consecutiveNetworkFailures = 0;
      onSnapshot(snapshot);
    } catch (err) {
      if (!(err instanceof UsageHttpError)) {
        consecutiveUsageFailures += 1;
        if (consecutiveUsageFailures >= STALE_AFTER_FAILURES) {
          onStatus(STATUS.OFFLINE, { message: err.message, lastSuccessfulUsageFetchAt });
        }
        return;
      }

      if (err.status === 401 && !isRetryAfterForcedRefresh) {
        try {
          const refreshed = await refreshAccessToken(tokens.refreshToken);
          const newTokens = {
            ...tokens,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAt,
          };
          await saveRefreshedTokens(newTokens);
          await pollUsageOnce(newTokens, true);
          return;
        } catch {
          onStatus(STATUS.AUTH_ERROR, { message: '401 from usage API, forced refresh failed' });
          return;
        }
      }

      if (err.status === 429) {
        if (!loggedFirstRateLimit) {
          loggedFirstRateLimit = true;
          onStatus(STATUS.RATE_LIMITED, { bodyText: err.bodyText });
        } else {
          onStatus(STATUS.RATE_LIMITED);
        }
        return;
      }

      consecutiveUsageFailures += 1;
      if (consecutiveUsageFailures >= STALE_AFTER_FAILURES) {
        onStatus(STATUS.OFFLINE, {
          message: err.message,
          lastSuccessfulUsageFetchAt,
        });
      }
    }
  }

  function scheduleNextTick(tokens) {
    const nextUsagePollAt =
      lastSuccessfulUsageFetchAt === 0 ? Date.now() : lastSuccessfulUsageFetchAt + POLL_MIN_INTERVAL_MS;
    const nextTokenRefreshAt = tokens.expiresAt - TOKEN_REFRESH_SKEW_MS;
    schedule(Math.min(nextUsagePollAt, nextTokenRefreshAt) - Date.now());
  }

  // Never bypasses the 180s floor - only skips ahead if it has already elapsed.
  function requestImmediateCheck() {
    if (stopped) return;
    tick();
  }

  function start() {
    stopped = false;
    tick();
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
  }

  return { start, stop, requestImmediateCheck };
}

module.exports = {
  createUsagePoller,
  STATUS,
};
