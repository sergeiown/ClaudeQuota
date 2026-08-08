/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Renders the popup's HTML in a hidden Electron window and screenshots it -
// a real render check of the embedded bars/columns image plus labels,
// not just reading the markup. Must run under the actual electron.exe
// binary, not plain node. Run with:
//
//   electron scripts/verify-popup.js

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildHtml } = require('../src/main/popup');

const CASES = [
  { name: 'bars-light', style: 'bars', isDark: false },
  { name: 'bars-dark', style: 'bars', isDark: true },
  { name: 'columns-light', style: 'columns', isDark: false },
  { name: 'columns-dark', style: 'columns', isDark: true },
];

app.whenReady().then(async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudequota-popup-preview-'));
  const win = new BrowserWindow({ width: 320, height: 400, show: false, webPreferences: { offscreen: true } });

  for (const c of CASES) {
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

  console.log('Popup previews written to:', outDir);
  app.quit();
});
