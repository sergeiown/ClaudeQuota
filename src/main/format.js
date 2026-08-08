/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function hhmm(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatHeader(fetchedAt) {
  const d = new Date(fetchedAt || Date.now());
  return `ClaudeQuota as of ${hhmm(d)} on ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCountdown(resetsAtIso) {
  if (!resetsAtIso) return 'no reset time';
  const resetsAt = new Date(resetsAtIso);
  const diffMs = resetsAt - Date.now();
  if (diffMs <= 0) return 'resetting now';

  const ONE_MIN = 60_000;
  const ONE_HOUR = 3_600_000;
  const ONE_DAY = 86_400_000;

  const underOneHour = diffMs < ONE_HOUR;
  const underOneDay = diffMs < ONE_DAY;

  const timeTag = underOneDay ? ` (${hhmm(resetsAt)})` : '';

  if (underOneHour) {
    const mins = Math.max(1, Math.floor(diffMs / ONE_MIN));
    return `expires in ${mins} minute${mins !== 1 ? 's' : ''}${timeTag}`;
  }

  const totalHours = Math.floor(diffMs / ONE_HOUR);
  const remainingMins = Math.floor((diffMs % ONE_HOUR) / ONE_MIN);
  const minPart = remainingMins > 0 ? ` ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}` : '';

  if (underOneDay) {
    return `resets in ${totalHours} hour${totalHours !== 1 ? 's' : ''}${minPart}${timeTag}`;
  }

  const totalDays = Math.floor(diffMs / ONE_DAY);
  const remainingHours = totalHours - totalDays * 24;
  const hourPart = remainingHours > 0 ? ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}` : '';
  return `resets in ${totalDays} day${totalDays !== 1 ? 's' : ''}${hourPart}`;
}

function formatUsageLine(label, window) {
  return window ? `${label}: ${window.utilization}% - ${formatCountdown(window.resetsAt)}` : `${label}: no data`;
}

module.exports = {
  formatHeader,
  formatCountdown,
  formatUsageLine,
};
