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

// Windows' tray tooltip (NOTIFYICONDATA.szTip) silently truncates past
// ~127 characters - the full formatHeader() plus two usage lines can
// exceed that. Kept short on purpose; formatHeader() is used for the
// popup instead, which has no such limit.
function formatTooltipHeader(fetchedAt) {
  const d = new Date(fetchedAt || Date.now());
  return `ClaudeQuota ${hhmm(d)}`;
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
    return `expires in ${mins}m${timeTag}`;
  }

  const totalHours = Math.floor(diffMs / ONE_HOUR);
  const remainingMins = Math.floor((diffMs % ONE_HOUR) / ONE_MIN);
  const minPart = remainingMins > 0 ? ` ${remainingMins}m` : '';

  if (underOneDay) {
    return `resets in ${totalHours}h${minPart}${timeTag}`;
  }

  const totalDays = Math.floor(diffMs / ONE_DAY);
  const remainingHours = totalHours - totalDays * 24;
  const hourPart = remainingHours > 0 ? ` ${remainingHours}h` : '';
  return `resets in ${totalDays}d${hourPart}`;
}

function formatUsageLine(label, window) {
  return window ? `${label}: ${window.utilization}% - ${formatCountdown(window.resetsAt)}` : `${label}: no data`;
}

module.exports = {
  formatHeader,
  formatTooltipHeader,
  formatCountdown,
  formatUsageLine,
};
