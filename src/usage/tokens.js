/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

/**
 * Pure time-math helpers around token expiry. No I/O, easy to exercise
 * with `node -e` or a real test runner without mocking fs/network.
 */

/**
 * @param {number} expiresAtMs unix ms timestamp
 * @param {number} skewMs how long before real expiry counts as "expiring soon"
 * @param {number} [now]
 */
function isExpiringSoon(expiresAtMs, skewMs, now = Date.now()) {
  return expiresAtMs - now <= skewMs;
}

/**
 * @param {number} expiresAtMs
 * @param {number} [now]
 * @returns {number} ms until expiry, can be negative if already expired
 */
function msUntilExpiry(expiresAtMs, now = Date.now()) {
  return expiresAtMs - now;
}

/**
 * @param {number} refreshTokenExpiresAtMs
 * @param {number} [now]
 */
function isRefreshTokenExpired(refreshTokenExpiresAtMs, now = Date.now()) {
  return refreshTokenExpiresAtMs <= now;
}

module.exports = {
  isExpiringSoon,
  msUntilExpiry,
  isRefreshTokenExpired,
};
