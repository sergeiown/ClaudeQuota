/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// code: 'MISSING_FILE' | 'MALFORMED' | 'MISSING_REFRESH_TOKEN' | 'REFRESH_TOKEN_EXPIRED'
class CredentialsError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'CredentialsError';
    this.code = code;
  }
}

// code: 'INVALID_GRANT' | 'NETWORK' | 'UNKNOWN'
class RefreshError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.name = 'RefreshError';
    this.code = code;
    this.status = status;
  }
}

class UsageHttpError extends Error {
  constructor(status, bodyText) {
    super(`usage API responded with ${status}`);
    this.name = 'UsageHttpError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

module.exports = {
  CredentialsError,
  RefreshError,
  UsageHttpError,
};
