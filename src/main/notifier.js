/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const path = require('path');
const fs = require('fs');
const { app, Notification, nativeImage } = require('electron');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { renderBarPreview } = require('../icon/render');

const ICON_PATH = path.join(app.getAppPath(), 'build', 'icon-source.png');
const THRESHOLDS = [51, 81, 99];
const VARIANT_BY_KEY = { fiveHour: 'five-hour', sevenDay: 'seven-day' };

let appIconImage = null;
async function getAppIconImage() {
  if (!appIconImage) appIconImage = await loadImage(fs.readFileSync(ICON_PATH));
  return appIconImage;
}

// Combines the static app icon with a live pill for the window that
// crossed the threshold, since the generic Notification API only exposes
// one icon slot.
async function buildNotificationIcon(variant, utilization, isDark) {
  const appIcon = await getAppIconImage();
  const pillBuffer = renderBarPreview({ percent: utilization, variant, isDark });
  const pill = await loadImage(pillBuffer);

  const width = 256;
  const height = 96;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const iconSize = 80;
  ctx.drawImage(appIcon, 4, (height - iconSize) / 2, iconSize, iconSize);

  const pillWidth = width - iconSize - 20;
  const pillHeight = pillWidth * (pill.height / pill.width);
  ctx.drawImage(pill, iconSize + 16, (height - pillHeight) / 2, pillWidth, pillHeight);

  return canvas.toBuffer('image/png');
}

function messageFor(windowLabel, threshold, utilization) {
  if (threshold >= 99) return `${windowLabel} usage is almost maxed out (${utilization}%).`;
  if (threshold >= 81) return `${windowLabel} usage is getting close to the limit (${utilization}%).`;
  return `${windowLabel} usage just passed the halfway point (${utilization}%).`;
}

async function notify(windowLabel, key, threshold, utilization, isDark, onClick) {
  if (!Notification.isSupported()) return;
  const iconBuffer = await buildNotificationIcon(VARIANT_BY_KEY[key], utilization, isDark);
  const notification = new Notification({
    title: 'ClaudeQuota',
    body: messageFor(windowLabel, threshold, utilization),
    icon: nativeImage.createFromBuffer(iconBuffer),
  });
  if (onClick) notification.on('click', onClick);
  notification.show();
}

/**
 * Fires a one-time notification per window (5-hour, 7-day) the first time
 * its utilization crosses 51/81/99%. On the very first snapshot seen for a
 * window this session, thresholds already met are marked notified without
 * actually firing - otherwise every app start at, say, 85% usage would fire
 * both the 51% and 81% notifications immediately. A window's own resetsAt
 * changing means it rolled over to a new cycle, so its notified set clears.
 */
function createThresholdNotifier({ onClick, getIsDark, isEnabled } = {}) {
  const state = {
    fiveHour: { resetsAt: null, notified: new Set() },
    sevenDay: { resetsAt: null, notified: new Set() },
  };

  // The notified set always advances on a real crossing, even while
  // notifications are turned off - re-enabling them later must not fire a
  // stale notification for a threshold already passed while muted.
  function checkWindow(label, key, usageWindow) {
    if (!usageWindow) return;
    const entry = state[key];

    if (entry.resetsAt !== usageWindow.resetsAt) {
      const isFirstSnapshot = entry.resetsAt === null;
      entry.resetsAt = usageWindow.resetsAt;
      entry.notified = isFirstSnapshot
        ? new Set(THRESHOLDS.filter((t) => usageWindow.utilization >= t))
        : new Set();
    }

    for (const threshold of THRESHOLDS) {
      if (usageWindow.utilization >= threshold && !entry.notified.has(threshold)) {
        entry.notified.add(threshold);
        if (!isEnabled || isEnabled()) {
          notify(label, key, threshold, usageWindow.utilization, getIsDark ? getIsDark() : true, onClick);
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
