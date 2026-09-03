/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { Notification, nativeImage } = require('electron');
const { renderNotificationIcon } = require('../icon/render');
const { formatCountdown } = require('./format');

const THRESHOLDS = [51, 81, 99, 100];
const VARIANT_BY_KEY = { fiveHour: 'five-hour', sevenDay: 'seven-day' };

function messageFor(windowLabel, threshold, utilization, resetsAt) {
  if (threshold >= 100) return `${windowLabel} limit fully used - ${formatCountdown(resetsAt)}.`;
  if (threshold >= 99) return `${windowLabel} usage is almost maxed out (${utilization}%).`;
  if (threshold >= 81) return `${windowLabel} usage is getting close to the limit (${utilization}%).`;
  return `${windowLabel} usage just passed the halfway point (${utilization}%).`;
}

function notify(windowLabel, key, threshold, usageWindow, isDark, onClick) {
  if (!Notification.isSupported()) return;
  const iconBuffer = renderNotificationIcon({ percent: usageWindow.utilization, variant: VARIANT_BY_KEY[key], isDark });
  const notification = new Notification({
    title: 'ClaudeQuota',
    body: messageFor(windowLabel, threshold, usageWindow.utilization, usageWindow.resetsAt),
    icon: nativeImage.createFromBuffer(iconBuffer),
  });
  if (onClick) notification.on('click', onClick);
  notification.show();
}

function createThresholdNotifier({ onClick, getIsDark, isEnabled } = {}) {
  const state = {
    fiveHour: { resetsAt: null, notified: new Set() },
    sevenDay: { resetsAt: null, notified: new Set() },
  };

  function checkWindow(label, key, usageWindow) {
    if (!usageWindow) return;
    const entry = state[key];
    const isFirstSnapshot = entry.resetsAt === null;
    const previousResetsAt = entry.resetsAt;
    entry.resetsAt = usageWindow.resetsAt;

    if (isFirstSnapshot) {
      entry.notified = new Set(THRESHOLDS.filter((t) => usageWindow.utilization >= t));
    } else if (previousResetsAt !== usageWindow.resetsAt && new Date(previousResetsAt).getTime() <= Date.now()) {

      entry.notified = new Set();
    }

    for (const threshold of THRESHOLDS) {
      if (usageWindow.utilization >= threshold && !entry.notified.has(threshold)) {
        entry.notified.add(threshold);
        if (!isEnabled || isEnabled()) {
          notify(label, key, threshold, usageWindow, getIsDark ? getIsDark() : true, onClick);
        }
      }
    }
  }

  function check(snapshot) {
    checkWindow('5-hour', 'fiveHour', snapshot.fiveHour);
    checkWindow('7-day', 'sevenDay', snapshot.sevenDay);
  }

  return { check };
}

module.exports = {
  createThresholdNotifier,
};
