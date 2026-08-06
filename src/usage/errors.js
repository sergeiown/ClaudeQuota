'use strict';

/**
 * Thrown by credentials.js when ~/.claude/.credentials.json cannot be
 * read or does not have the shape the app relies on.
 *
 * code: 'MISSING_FILE' | 'MALFORMED' | 'MISSING_REFRESH_TOKEN' | 'REFRESH_TOKEN_EXPIRED'
 */
class CredentialsError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'CredentialsError';
    this.code = code;
  }
}

/**
 * Thrown by oauth.js when refreshing the access token fails.
 *
 * code: 'INVALID_GRANT' | 'NETWORK' | 'UNKNOWN'
 * status: HTTP status code, when the failure came from an HTTP response
 */
class RefreshError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.name = 'RefreshError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Thrown by client.js when the usage API responds with a non-2xx status.
 */
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
