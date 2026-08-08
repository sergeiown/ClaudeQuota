/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { Tray, nativeImage } = require('electron');

const { renderFractionIcon, renderRingIcon, renderStatusIcon } = require('../icon/render');

const RENDER_FN_BY_STYLE = {
  bars: renderFractionIcon,
  circles: renderRingIcon,
};
const { buildTrayMenu } = require('./menu');

const STATUS_MESSAGES = {
  'missing-credentials': "Claude CLI not found. Run `claude login`.",
  'refresh-token-expired': "Claude CLI session expired. Run `claude login` again.",
  'auth-error': 'Anthropic API authentication error.',
  'rate-limited': 'Temporarily rate-limited by the server, will retry later.',
  offline: 'No connection to api.anthropic.com.',
};

// Non-happy-path statuses that still get a real status *icon* (question
// mark / exclamation mark). Anything else (offline, rate-limited) keeps
// showing the last known fraction and only changes the tooltip - see
// poller.js for why transient failures shouldn't blink the icon.
const STATUS_ICON_KIND = {
  'missing-credentials': 'missing-credentials',
  'refresh-token-expired': 'missing-credentials',
  'auth-error': 'auth-error',
};

function buildNativeImage(renderFn, args) {
  const png16 = renderFn({ ...args, size: 16 });
  const png32 = renderFn({ ...args, size: 32 });
  const image = nativeImage.createFromBuffer(png16);
  image.addRepresentation({ width: 32, height: 32, buffer: png32, scaleFactor: 2.0 });
  return image;
}

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

/** Returns e.g. "resets in 2 hours 15 minutes (14:30)" or "expires in 4 minutes (14:30)". */
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

/**
 * Owns the single Tray instance for the app's lifetime: icon bitmap,
 * tooltip, and context menu. No BrowserWindow involved anywhere.
 *
 * @param {object} opts
 * @param {() => boolean} opts.getAutoLaunchEnabled
 * @param {() => void} opts.onToggleAutoLaunch
 * @param {() => 'bars'|'circles'} opts.getDisplayStyle
 * @param {() => void} opts.onToggleDisplayStyle
 * @param {() => void} opts.onOpenLog
 * @param {() => void} opts.onAbout
 * @param {() => void} opts.onQuit
 * @param {() => void} [opts.onRequestRefresh] called when the user opens
 *   the context menu, to allow an on-demand refresh (still gated by the
 *   180s cooldown inside poller.js, never bypasses it)
 * @param {boolean} opts.isDark initial theme
 */
function createTrayController({
  getAutoLaunchEnabled,
  onToggleAutoLaunch,
  getDisplayStyle,
  onToggleDisplayStyle,
  onOpenLog,
  onAbout,
  onQuit,
  onRequestRefresh,
  isDark,
}) {
  let currentIsDark = isDark;
  let lastSnapshot = null;
  let lastStatusKind = null;

  const tray = new Tray(buildNativeImage(renderStatusIcon, { kind: 'loading', isDark: currentIsDark }));
  tray.setToolTip('ClaudeQuota - loading...');

  function rebuildMenu() {
    tray.setContextMenu(
      buildTrayMenu({
        autoLaunchEnabled: getAutoLaunchEnabled(),
        onToggleAutoLaunch: () => {
          onToggleAutoLaunch();
          rebuildMenu();
        },
        displayStyle: getDisplayStyle(),
        onToggleDisplayStyle: () => {
          onToggleDisplayStyle();
          rebuildMenu();
          // Re-render immediately with the new style rather than waiting
          // for the next snapshot/status update - the point of a menu
          // toggle is to see the effect right away.
          if (lastSnapshot) {
            showSnapshot(lastSnapshot);
          } else if (lastStatusKind) {
            showStatus(lastStatusKind);
          }
        },
        onOpenLog,
        onAbout,
        onQuit,
      })
    );
  }
  rebuildMenu();

  if (onRequestRefresh) {
    tray.on('right-click', onRequestRefresh);
    tray.on('click', onRequestRefresh);
  }

  function showSnapshot(snapshot) {
    lastSnapshot = snapshot;
    lastStatusKind = null;

    const numerator = snapshot.fiveHour ? snapshot.fiveHour.utilization : 0;
    const denominator = snapshot.sevenDay ? snapshot.sevenDay.utilization : 0;
    const renderFn = RENDER_FN_BY_STYLE[getDisplayStyle()] || renderFractionIcon;

    tray.setImage(buildNativeImage(renderFn, { numerator, denominator, isDark: currentIsDark }));

    const header = formatHeader(snapshot.fetchedAt);

    const fiveHourText = snapshot.fiveHour
      ? `5h: ${snapshot.fiveHour.utilization}% - ${formatCountdown(snapshot.fiveHour.resetsAt)}`
      : '5h: no data';
    const sevenDayText = snapshot.sevenDay
      ? `7d: ${snapshot.sevenDay.utilization}% - ${formatCountdown(snapshot.sevenDay.resetsAt)}`
      : '7d: no data';

    tray.setToolTip(`${header}\n${fiveHourText}\n${sevenDayText}`);
  }

  function showStatus(kind) {
    lastStatusKind = kind;

    if ((kind === 'offline' || kind === 'rate-limited') && lastSnapshot) {
      // Keep the last known numbers on screen - only the tooltip changes.
      // Avoids blinking the icon on every transient network hiccup.
      tray.setToolTip(`ClaudeQuota\n${STATUS_MESSAGES[kind]}`);
      return;
    }

    const iconKind = STATUS_ICON_KIND[kind] || 'loading';
    tray.setImage(buildNativeImage(renderStatusIcon, { kind: iconKind, isDark: currentIsDark }));
    tray.setToolTip(`ClaudeQuota\n${STATUS_MESSAGES[kind] || kind}`);
  }

  function refreshTheme(newIsDark) {
    if (newIsDark === currentIsDark) return;
    currentIsDark = newIsDark;
    if (lastSnapshot) {
      showSnapshot(lastSnapshot);
    } else if (lastStatusKind) {
      showStatus(lastStatusKind);
    } else {
      tray.setImage(buildNativeImage(renderStatusIcon, { kind: 'loading', isDark: currentIsDark }));
    }
  }

  function destroy() {
    tray.destroy();
  }

  return { showSnapshot, showStatus, refreshTheme, destroy };
}

module.exports = {
  createTrayController,
};
