/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Captures the popup for the README, light and dark, using real current
// usage data. Must run under electron.exe, not plain node:
//   electron scripts/capture-readme-screenshots.js
// Captures via capturePage() (real popup window, no OS title bar to crop),
// then composites onto a plain page-like backdrop per theme, matching how
// the image will actually sit on a GitHub readme.

const { app, BrowserWindow } = require('electron');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const { getActiveTokens } = require('../src/usage/credentials');
const { fetchUsage } = require('../src/usage/client');
const { buildHtml, computeDimensions } = require('../src/main/popup');
const { formatHeaderDate, formatCountdown } = require('../src/main/format');

const OUT_DIR = path.join(__dirname, '..', 'docs');
const PAGE_BG = { light: '#ffffff', dark: '#0d1117' };

async function buildArgs(snapshot, isDark) {
  return {
    numerator: snapshot.fiveHour.utilization,
    denominator: snapshot.sevenDay.utilization,
    style: 'bars',
    isDark,
    headerTitle: 'ClaudeQuota',
    headerDetail: formatHeaderDate(snapshot.fetchedAt),
    lineOne: formatCountdown(snapshot.fiveHour.resetsAt),
    lineTwo: formatCountdown(snapshot.sevenDay.resetsAt),
    hasData: true,
    pinned: false,
    minimized: false,
  };
}

async function capture(win, args, bg, outPath) {
  const dimensions = computeDimensions(args);
  win.setBounds({ x: 0, y: 0, width: dimensions.width, height: dimensions.height });
  await win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildHtml(args))}`);
  await new Promise((r) => setTimeout(r, 200));
  const shot = await win.webContents.capturePage();
  const img = await loadImage(shot.toPNG());
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('wrote', outPath);
}

app.whenReady().then(async () => {
  const tokens = await getActiveTokens();
  const snapshot = await fetchUsage(tokens.accessToken);
  if (!snapshot.fiveHour || !snapshot.sevenDay) {
    throw new Error('live usage response missing five_hour/seven_day - cannot build a real screenshot');
  }

  const win = new BrowserWindow({ show: false, frame: false, width: 400, height: 520 });

  const lightArgs = await buildArgs(snapshot, false);
  await capture(win, lightArgs, PAGE_BG.light, path.join(OUT_DIR, 'popup-light.png'));

  const darkArgs = await buildArgs(snapshot, true);
  await capture(win, darkArgs, PAGE_BG.dark, path.join(OUT_DIR, 'popup-dark.png'));

  win.destroy();
  app.quit();
});
