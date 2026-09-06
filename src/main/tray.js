/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { Tray, nativeImage, screen } = require('electron');

const { renderFractionIcon, renderColumnsIcon, renderStatusIcon } = require('../icon/render');
const { buildTrayMenu } = require('./menu');
const { formatHeaderDate, formatTooltipHeader, formatUsageLine, formatCountdown } = require('./format');
const { createPopupController } = require('./popup');
const { createThresholdNotifier } = require('./notifier');

const RENDER_FN_BY_STYLE = {
  bars: renderFractionIcon,
  columns: renderColumnsIcon,
};

const STATUS_MESSAGES = {
  'missing-credentials': 'Not signed in yet.',
  'refresh-token-expired': 'Your sign-in has expired.',
  'auth-error': 'Anthropic API authentication error.',
  'rate-limited': 'Temporarily rate-limited by the server, will retry later.',
  offline: 'No connection to api.anthropic.com.',
};

const STATUS_ICON_KIND = {
  'missing-credentials': 'missing-credentials',
  'refresh-token-expired': 'missing-credentials',
  'auth-error': 'auth-error',
};

function getTraySize() {
  return Math.round(16 * screen.getPrimaryDisplay().scaleFactor);
}

function buildNativeImage(renderFn, args) {
  const size = getTraySize();
  const png = renderFn({ ...args, size });
  const image = nativeImage.createFromBuffer(png);

  const png32 = renderFn({ ...args, size: 32 });
  image.addRepresentation({ width: 32, height: 32, buffer: png32, scaleFactor: 32 / size });
  return image;
}

const STALE_DATA_ALLOWED_KINDS = new Set(['offline', 'rate-limited']);

function createTrayController({
  getAutoLaunchEnabled,
  onToggleAutoLaunch,
  getNotificationsEnabled,
  onToggleNotifications,
  getDisplayStyle,
  onToggleDisplayStyle,
  onOpenLog,
  onAbout,
  onQuit,
  onRequestRefresh,
  getAction,
  onRetryAction,
  isDark,
}) {
  let currentIsDark = isDark;
  let lastSnapshot = null;
  let lastStatusKind = null;

  const tray = new Tray(buildNativeImage(renderStatusIcon, { kind: 'loading', isDark: currentIsDark }));
  tray.setToolTip('ClaudeQuota - loading...');

  const popup = createPopupController({
    onAction: () => { if (onRetryAction) onRetryAction(lastStatusKind); },
  });
  const notifier = createThresholdNotifier({
    onClick: () => popup.toggle(buildPopupArgs(), tray.getBounds()),
    getIsDark: () => currentIsDark,
    isEnabled: getNotificationsEnabled,
  });

  function rebuildMenu() {
    tray.setContextMenu(
      buildTrayMenu({
        autoLaunchEnabled: getAutoLaunchEnabled(),
        onToggleAutoLaunch: () => {
          onToggleAutoLaunch();
          rebuildMenu();
        },
        notificationsEnabled: getNotificationsEnabled(),
        onToggleNotifications: () => {
          onToggleNotifications();
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

  function resetPhrase(usageWindow) {
    return usageWindow ? formatCountdown(usageWindow.resetsAt) : 'no data';
  }

  function buildPopupArgs() {
    if (lastSnapshot) {
      const numerator = lastSnapshot.fiveHour ? lastSnapshot.fiveHour.utilization : 0;
      const denominator = lastSnapshot.sevenDay ? lastSnapshot.sevenDay.utilization : 0;
      return {
        numerator,
        denominator,
        style: getDisplayStyle(),
        isDark: currentIsDark,
        headerTitle: 'ClaudeQuota',
        headerDetail: formatHeaderDate(lastSnapshot.fetchedAt),
        lineOne: resetPhrase(lastSnapshot.fiveHour),
        lineTwo: resetPhrase(lastSnapshot.sevenDay),
        hasData: true,
      };
    }
    const action = getAction ? getAction(lastStatusKind) : null;
    return {
      numerator: 0,
      denominator: 0,
      style: getDisplayStyle(),
      isDark: currentIsDark,
      headerTitle: 'ClaudeQuota',
      headerDetail: '',
      lineOne: STATUS_MESSAGES[lastStatusKind] || 'Loading...',
      lineTwo: '',
      hasData: false,
      actionLabel: action ? action.label : null,
      actionDisabled: action ? !!action.disabled : false,
    };
  }

  tray.on('right-click', () => {
    if (onRequestRefresh) onRequestRefresh();
  });

  tray.on('click', () => {

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
    notifier.check(snapshot);
  }

  function showStatus(kind) {
    lastStatusKind = kind;

    if (STALE_DATA_ALLOWED_KINDS.has(kind) && lastSnapshot) {
      tray.setToolTip(`ClaudeQuota\n${STATUS_MESSAGES[kind]}`);
      return;
    }
    lastSnapshot = null;

    const iconKind = STATUS_ICON_KIND[kind] || 'loading';
    tray.setImage(buildNativeImage(renderStatusIcon, { kind: iconKind, isDark: currentIsDark }));
    tray.setToolTip(`ClaudeQuota\n${STATUS_MESSAGES[kind] || kind}`);
    popup.updateIfVisible(buildPopupArgs(), tray.getBounds());
  }

  function needsAttention() {
    popup.open(buildPopupArgs(), tray.getBounds());
  }

  function refreshPopupOnly() {
    popup.updateIfVisible(buildPopupArgs(), tray.getBounds());
  }

  function redrawIcon() {
    if (lastSnapshot) {
      showSnapshot(lastSnapshot);
    } else if (lastStatusKind) {
      showStatus(lastStatusKind);
    } else {
      tray.setImage(buildNativeImage(renderStatusIcon, { kind: 'loading', isDark: currentIsDark }));
    }
  }

  function refreshTheme(newIsDark) {
    if (newIsDark === currentIsDark) return;
    currentIsDark = newIsDark;
    redrawIcon();
  }

  let lastTraySize = getTraySize();
  screen.on('display-metrics-changed', () => {
    const size = getTraySize();
    if (size === lastTraySize) return;
    lastTraySize = size;
    redrawIcon();
  });

  function destroy() {
    popup.destroy();
    tray.destroy();
  }

  return { showSnapshot, showStatus, refreshTheme, needsAttention, refreshPopupOnly, destroy };
}

module.exports = {
  createTrayController,
};
