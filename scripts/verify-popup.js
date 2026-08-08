/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Renders the popup's HTML in a hidden Electron window and screenshots it.
// Must run under electron.exe, not plain node. Run with:
//   electron scripts/verify-popup.js
// Reuses one window across cases - a freshly created BrowserWindow per case
// can fail to load a data: URL here.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildHtml, DIMENSIONS } = require('../src/main/popup');

const CASES = [
  { name: 'bars-light', style: 'bars', isDark: false },
  { name: 'bars-dark', style: 'bars', isDark: true },
  { name: 'columns-light', style: 'columns', isDark: false },
  { name: 'columns-dark', style: 'columns', isDark: true },
];

app.whenReady().then(async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudequota-popup-preview-'));
  const win = new BrowserWindow({ show: false, width: 500, height: 300 });

  for (const c of CASES) {
    const dimensions = DIMENSIONS[c.style] || DIMENSIONS.bars;
    win.setBounds({ x: 0, y: 0, width: dimensions.width, height: dimensions.height });
    const html = buildHtml({
      numerator: 42,
      denominator: 87,
      style: c.style,
      isDark: c.isDark,
      headerText: 'ClaudeQuota as of 14:30 on 7 August 2026',
      lineOne: '5h: 42% - resets in 2 hours 15 minutes (16:45)',
      lineTwo: '7d: 87% - expires in 18 hours 40 minutes (09:10)',
    });
    await win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
    await new Promise((r) => setTimeout(r, 200));
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `${c.name}.png`), image.toPNG());
  }

  win.destroy();
  console.log('Popup previews written to:', outDir);
  app.quit();
});
