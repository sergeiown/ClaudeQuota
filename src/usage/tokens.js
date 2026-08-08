/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

function isExpiringSoon(expiresAtMs, skewMs, now = Date.now()) {
  return expiresAtMs - now <= skewMs;
}

function msUntilExpiry(expiresAtMs, now = Date.now()) {
  return expiresAtMs - now;
}

function isRefreshTokenExpired(refreshTokenExpiresAtMs, now = Date.now()) {
  return refreshTokenExpiresAtMs <= now;
}

module.exports = {
  isExpiringSoon,
  msUntilExpiry,
  isRefreshTokenExpired,
};
