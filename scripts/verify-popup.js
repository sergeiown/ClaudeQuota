/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Renders the popup's HTML in a hidden Electron window and screenshots it.
// Must run under electron.exe, not plain node. Run with:
//   electron scripts/verify-popup.js
// Reuses one window across cases - a freshly created BrowserWindow per case
// can fail to load a data: URL here.
// capturePage() only captures the web page's own rendered pixels, not
// OS-level window chrome (native shadow, DWM corner rounding) - it cannot
// catch bugs in those, no matter how this test window is configured.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildHtml, computeDimensions } = require('../src/main/popup');

const LONG_LINE_ONE = '5h: 42% - resets in 2 hours 15 minutes (16:45)';
const LONG_LINE_TWO = '7d: 87% - expires in 18 hours 40 minutes (09:10)';
const SHORT_LINE_ONE = '5h: 60% - resets in 1 hour (20:50)';
const SHORT_LINE_TWO = '7d: 89% - resets in 1 day 4 hours';

const CASES = [
  { name: 'bars-light', style: 'bars', isDark: false, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO },
  { name: 'bars-dark', style: 'bars', isDark: true, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO },
  { name: 'columns-light', style: 'columns', isDark: false, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO },
  { name: 'columns-dark', style: 'columns', isDark: true, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO },
  { name: 'columns-short', style: 'columns', isDark: false, lineOne: SHORT_LINE_ONE, lineTwo: SHORT_LINE_TWO },
  { name: 'columns-mismatched', style: 'columns', isDark: false, lineOne: LONG_LINE_ONE, lineTwo: SHORT_LINE_TWO },
  { name: 'columns-tiny', style: 'columns', isDark: false, lineOne: '5h: 5%', lineTwo: '7d: 9%' },
];

app.whenReady().then(async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudequota-popup-preview-'));
  // frame: false matches the real popup window - a framed test window's
  // title bar/borders eat into the content area, shrinking it below the
  // size we asked for and making correctly-sized content clip.
  const win = new BrowserWindow({ show: false, frame: false, width: 500, height: 300 });

  for (const c of CASES) {
    const args = {
      numerator: 42,
      denominator: 87,
      style: c.style,
      isDark: c.isDark,
      headerTitle: 'ClaudeQuota',
      headerDetail: 'as of 14:30 on 7 August 2026',
      lineOne: c.lineOne,
      lineTwo: c.lineTwo,
    };
    const dimensions = computeDimensions(args);
    win.setBounds({ x: 0, y: 0, width: dimensions.width, height: dimensions.height });
    const html = buildHtml(args);
    await win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
    await new Promise((r) => setTimeout(r, 200));
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `${c.name}.png`), image.toPNG());
  }

  win.destroy();
  console.log('Popup previews written to:', outDir);
  app.quit();
});
