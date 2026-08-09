/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { Tray, nativeImage } = require('electron');

const { renderFractionIcon, renderColumnsIcon, renderStatusIcon } = require('../icon/render');
const { buildTrayMenu } = require('./menu');
const { formatHeader, formatTooltipHeader, formatUsageLine } = require('./format');
const { createPopupController } = require('./popup');

const RENDER_FN_BY_STYLE = {
  bars: renderFractionIcon,
  columns: renderColumnsIcon,
};

const STATUS_MESSAGES = {
  'missing-credentials': "Claude CLI not found. Run `claude login`.",
  'refresh-token-expired': "Claude CLI session expired. Run `claude login` again.",
  'auth-error': 'Anthropic API authentication error.',
  'rate-limited': 'Temporarily rate-limited by the server, will retry later.',
  offline: 'No connection to api.anthropic.com.',
};

// Non-happy-path statuses that get a real status icon; anything else (offline,
// rate-limited) keeps showing the last known fraction and only changes the tooltip.
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

/**
 * @param {object} opts
 * @param {() => boolean} opts.getAutoLaunchEnabled
 * @param {() => void} opts.onToggleAutoLaunch
 * @param {() => 'bars'|'columns'} opts.getDisplayStyle
 * @param {() => void} opts.onToggleDisplayStyle
 * @param {() => void} opts.onOpenLog
 * @param {() => void} opts.onAbout
 * @param {() => void} opts.onQuit
 * @param {() => void} [opts.onRequestRefresh]
 * @param {boolean} opts.isDark
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

  const popup = createPopupController();

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

  function buildPopupArgs() {
    if (lastSnapshot) {
      const numerator = lastSnapshot.fiveHour ? lastSnapshot.fiveHour.utilization : 0;
      const denominator = lastSnapshot.sevenDay ? lastSnapshot.sevenDay.utilization : 0;
      return {
        numerator,
        denominator,
        style: getDisplayStyle(),
        isDark: currentIsDark,
        headerText: formatHeader(lastSnapshot.fetchedAt),
        lineOne: formatUsageLine('5h', lastSnapshot.fiveHour),
        lineTwo: formatUsageLine('7d', lastSnapshot.sevenDay),
      };
    }
    return {
      numerator: 0,
      denominator: 0,
      style: getDisplayStyle(),
      isDark: currentIsDark,
      headerText: 'ClaudeQuota',
      lineOne: STATUS_MESSAGES[lastStatusKind] || 'Loading...',
      lineTwo: '',
    };
  }

  tray.on('right-click', () => {
    if (onRequestRefresh) onRequestRefresh();
  });

  tray.on('click', () => {
    if (onRequestRefresh) onRequestRefresh();
    popup.toggle(buildPopupArgs(), tray.getBounds());
  });

  function showSnapshot(snapshot) {
    lastSnapshot = snapshot;
    lastStatusKind = null;

    const numerator = snapshot.fiveHour ? snapshot.fiveHour.utilization : 0;
    const denominator = snapshot.sevenDay ? snapshot.sevenDay.utilization : 0;
    const renderFn = RENDER_FN_BY_STYLE[getDisplayStyle()] || renderFractionIcon;

    tray.setImage(buildNativeImage(renderFn, { numerator, denominator, isDark: currentIsDark }));

    const header = formatTooltipHeader(snapshot.fetchedAt);
    const fiveHourText = formatUsageLine('5h', snapshot.fiveHour);
    const sevenDayText = formatUsageLine('7d', snapshot.sevenDay);

    tray.setToolTip(`${header}\n${fiveHourText}\n${sevenDayText}`);
    popup.updateIfVisible(buildPopupArgs(), tray.getBounds());
  }

  function showStatus(kind) {
    lastStatusKind = kind;

    if ((kind === 'offline' || kind === 'rate-limited') && lastSnapshot) {
      tray.setToolTip(`ClaudeQuota\n${STATUS_MESSAGES[kind]}`);
      return;
    }

    const iconKind = STATUS_ICON_KIND[kind] || 'loading';
    tray.setImage(buildNativeImage(renderStatusIcon, { kind: iconKind, isDark: currentIsDark }));
    tray.setToolTip(`ClaudeQuota\n${STATUS_MESSAGES[kind] || kind}`);
    popup.updateIfVisible(buildPopupArgs(), tray.getBounds());
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
    popup.destroy();
    tray.destroy();
  }

  return { showSnapshot, showStatus, refreshTheme, destroy };
}

module.exports = {
  createTrayController,
};
