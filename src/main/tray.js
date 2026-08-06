'use strict';

const { Tray, nativeImage } = require('electron');

const { renderFractionIcon, renderStatusIcon } = require('../icon/render');
const { buildTrayMenu } = require('./menu');

const STATUS_MESSAGES = {
  'missing-credentials': 'Не знайдено claude CLI. Виконайте `claude login`.',
  'refresh-token-expired': 'Сесія claude CLI застаріла. Виконайте `claude login` повторно.',
  'auth-error': 'Помилка авторизації Anthropic API.',
  'rate-limited': 'Тимчасово обмежено сервером, повторна спроба пізніше.',
  offline: "Немає з'єднання з api.anthropic.com.",
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

function formatResetTime(isoString) {
  if (!isoString) return '?';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return '?';
  }
}

/**
 * Owns the single Tray instance for the app's lifetime: icon bitmap,
 * tooltip, and context menu. No BrowserWindow involved anywhere.
 *
 * @param {object} opts
 * @param {() => boolean} opts.getAutoLaunchEnabled
 * @param {() => void} opts.onToggleAutoLaunch
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
  onAbout,
  onQuit,
  onRequestRefresh,
  isDark,
}) {
  let currentIsDark = isDark;
  let lastSnapshot = null;
  let lastStatusKind = null;

  const tray = new Tray(buildNativeImage(renderStatusIcon, { kind: 'loading', isDark: currentIsDark }));
  tray.setToolTip('ClaudeQuota - завантаження...');

  function rebuildMenu() {
    tray.setContextMenu(
      buildTrayMenu({
        autoLaunchEnabled: getAutoLaunchEnabled(),
        onToggleAutoLaunch: () => {
          onToggleAutoLaunch();
          rebuildMenu();
        },
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

    tray.setImage(buildNativeImage(renderFractionIcon, { numerator, denominator, isDark: currentIsDark }));

    const fiveHourText = snapshot.fiveHour
      ? `5г: ${snapshot.fiveHour.utilization}% (оновлення ${formatResetTime(snapshot.fiveHour.resetsAt)})`
      : '5г: немає даних';
    const sevenDayText = snapshot.sevenDay
      ? `7д: ${snapshot.sevenDay.utilization}% (оновлення ${formatResetTime(snapshot.sevenDay.resetsAt)})`
      : '7д: немає даних';

    tray.setToolTip(`ClaudeQuota\n${fiveHourText}\n${sevenDayText}`);
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
