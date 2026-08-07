/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { USAGE_API_URL, ANTHROPIC_BETA_HEADER, USER_AGENT } = require('../main/constants');
const { UsageHttpError } = require('./errors');

function normalizeWindow(raw) {
  if (!raw) return null;
  return {
    utilization: raw.utilization,
    resetsAt: raw.resets_at,
  };
}

function normalizeUsageResponse(body) {
  return {
    fiveHour: normalizeWindow(body.five_hour),
    sevenDay: normalizeWindow(body.seven_day),
    sevenDayOpus: normalizeWindow(body.seven_day_opus),
    sevenDaySonnet: normalizeWindow(body.seven_day_sonnet),
    extraUsage: body.extra_usage ?? null,
    fetchedAt: Date.now(),
  };
}

/**
 * GET /api/oauth/usage - undocumented Anthropic endpoint. A missing or
 * unexpected User-Agent gets a 429 from the server, so this header is not
 * optional the way it would normally be.
 *
 * @param {string} accessToken
 * @returns {Promise<UsageSnapshot>}
 */
async function fetchUsage(accessToken) {
  const response = await fetch(USAGE_API_URL, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'anthropic-beta': ANTHROPIC_BETA_HEADER,
      'user-agent': USER_AGENT,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new UsageHttpError(response.status, text);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new UsageHttpError(response.status, text);
  }

  return normalizeUsageResponse(body);
}

module.exports = {
  fetchUsage,
};
