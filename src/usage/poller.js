/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { getActiveTokens, saveRefreshedTokens } = require('./credentials');
const { refreshAccessToken } = require('./oauth');
const { fetchUsage } = require('./client');
const { isExpiringSoon, isRefreshTokenExpired } = require('./tokens');
const { CredentialsError, RefreshError, UsageHttpError } = require('./errors');
const { POLL_MIN_INTERVAL_MS, TOKEN_REFRESH_SKEW_MS } = require('../main/constants');

// How long to wait before re-checking when there is nothing useful to do
// yet (no credentials file, refresh token expired) - short enough that the
// app notices a fresh `claude login` reasonably quickly, long enough to
// not busy-loop.
const CREDENTIALS_RECHECK_MS = 60_000;

// Backoff schedule for token-refresh network failures, independent of the
// 180s usage-endpoint cooldown (that cooldown only applies once we again
// have a usable access token).
const NETWORK_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

// Number of consecutive failed usage fetches before we tell the caller the
// data should be considered stale/erroring, rather than just quietly
// keeping the last known-good snapshot.
const STALE_AFTER_FAILURES = 2;

const STATUS = {
  MISSING_CREDENTIALS: 'missing-credentials',
  REFRESH_TOKEN_EXPIRED: 'refresh-token-expired',
  AUTH_ERROR: 'auth-error',
  OFFLINE: 'offline',
  RATE_LIMITED: 'rate-limited',
};

/**
 * @param {object} callbacks
 * @param {(snapshot: object) => void} callbacks.onSnapshot called on every successful usage fetch
 * @param {(status: string, detail?: object) => void} callbacks.onStatus called on any non-happy-path state
 */
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
      // Already confirmed invalid by the server this session - don't hammer
      // the token endpoint with a refresh token we know will be rejected.
      // Only a newer file/cache entry (different refresh token) gets us out.
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
        // Unknown refresh failure shape - treat like auth error, but don't
        // permanently blacklist the refresh token since we're not sure.
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
      if (!(err instanceof UsageHttpError)) throw err;

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

  /**
   * If the usage-endpoint cooldown has already elapsed, run a check right
   * now instead of waiting for the next scheduled tick (e.g. when the user
   * opens the tray menu). Never bypasses the 180s floor itself.
   */
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
