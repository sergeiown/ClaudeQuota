/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildHtml, computeDimensions } = require('../src/main/popup');

const LONG_LINE_ONE = 'resets in 2h 15m (16:45)';
const LONG_LINE_TWO = 'expires in 18h 40m (09:10)';
const SHORT_LINE_ONE = 'resets in 1h (20:50)';
const SHORT_LINE_TWO = 'resets in 1d 4h';

const CASES = [
  { name: 'bars-light', style: 'bars', isDark: false, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true },
  { name: 'bars-dark', style: 'bars', isDark: true, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true },
  { name: 'columns-light', style: 'columns', isDark: false, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true },
  { name: 'columns-dark', style: 'columns', isDark: true, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true },
  { name: 'columns-short', style: 'columns', isDark: false, numerator: 60, denominator: 89, lineOne: SHORT_LINE_ONE, lineTwo: SHORT_LINE_TWO, hasData: true },
  { name: 'bars-tiny', style: 'bars', isDark: false, numerator: 5, denominator: 9, lineOne: 'resets in 4h 50m (23:10)', lineTwo: 'resets in 6d 22h', hasData: true },
  { name: 'columns-tiny', style: 'columns', isDark: false, numerator: 5, denominator: 9, lineOne: 'resets in 4h 50m (23:10)', lineTwo: 'resets in 6d 22h', hasData: true },
  { name: 'bars-full', style: 'bars', isDark: true, numerator: 100, denominator: 100, lineOne: 'resetting now', lineTwo: 'resetting now', hasData: true },
  { name: 'bars-nodata', style: 'bars', isDark: false, numerator: 0, denominator: 0, lineOne: 'Claude CLI not found. Run `claude auth login`.', lineTwo: '', hasData: false },
  { name: 'bars-nodata-install', style: 'bars', isDark: false, numerator: 0, denominator: 0, lineOne: 'Claude CLI not found. Run `claude auth login`.', lineTwo: '', hasData: false, actionLabel: 'Install Claude CLI' },
  { name: 'bars-nodata-installing', style: 'bars', isDark: true, numerator: 0, denominator: 0, lineOne: 'Claude CLI not found. Run `claude auth login`.', lineTwo: '', hasData: false, actionLabel: 'Installing…', actionDisabled: true },
  { name: 'bars-nodata-login', style: 'bars', isDark: false, numerator: 0, denominator: 0, lineOne: 'Claude CLI session expired. Run `claude auth login` again.', lineTwo: '', hasData: false, actionLabel: 'Log in' },
  { name: 'bars-nodata-opening', style: 'bars', isDark: true, numerator: 0, denominator: 0, lineOne: 'Claude CLI session expired. Run `claude auth login` again.', lineTwo: '', hasData: false, actionLabel: 'Opening browser…', actionDisabled: true },
  { name: 'bars-pinned', style: 'bars', isDark: true, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true, pinned: true },
  { name: 'bars-unpinned', style: 'bars', isDark: true, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true, pinned: false },
  { name: 'bars-mini-dark', style: 'bars', isDark: true, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true, pinned: true, minimized: true },
  { name: 'bars-mini-light', style: 'bars', isDark: false, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true, pinned: true, minimized: true },
  { name: 'columns-mini-dark', style: 'columns', isDark: true, numerator: 42, denominator: 87, lineOne: LONG_LINE_ONE, lineTwo: LONG_LINE_TWO, hasData: true, pinned: true, minimized: true },
  { name: 'bars-mini-tiny', style: 'bars', isDark: true, numerator: 5, denominator: 9, lineOne: 'resets in 4h 50m (23:10)', lineTwo: 'resets in 6d 22h', hasData: true, pinned: true, minimized: true },
];

app.whenReady().then(async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudequota-popup-preview-'));

  const win = new BrowserWindow({ show: false, frame: false, width: 500, height: 300 });

  for (const c of CASES) {
    const args = {
      numerator: c.numerator,
      denominator: c.denominator,
      style: c.style,
      isDark: c.isDark,
      headerTitle: 'ClaudeQuota',
      headerDetail: 'as of 14:30 on 7 August 2026',
      lineOne: c.lineOne,
      lineTwo: c.lineTwo,
      hasData: c.hasData,
      pinned: c.pinned || false,
      minimized: c.minimized || false,
      actionLabel: c.actionLabel || null,
      actionDisabled: c.actionDisabled || false,
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
