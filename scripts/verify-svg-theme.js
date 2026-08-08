/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Screenshots an SVG under both light/dark prefers-color-scheme. Must run
// under electron.exe, not plain node. Run with:
//   electron scripts/verify-svg-theme.js docs/structure.svg

const { app, BrowserWindow, nativeTheme } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

app.whenReady().then(async () => {
  const svgPath = process.argv[process.argv.length - 1];
  const svg = fs.readFileSync(svgPath, 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#ffffff}@media (prefers-color-scheme: dark){body{background:#0d1117}}</style></head><body>${svg}</body></html>`;
  const tmpHtml = path.join(os.tmpdir(), 'svg-preview.html');
  fs.writeFileSync(tmpHtml, html);

  const win = new BrowserWindow({ width: 1180, height: 440, show: false, webPreferences: { offscreen: true } });
  await win.loadFile(tmpHtml);

  nativeTheme.themeSource = 'light';
  await new Promise((r) => setTimeout(r, 300));
  const lightImg = await win.webContents.capturePage();
  fs.writeFileSync(path.join(os.tmpdir(), 'svg-preview-light.png'), lightImg.toPNG());

  nativeTheme.themeSource = 'dark';
  await new Promise((r) => setTimeout(r, 300));
  const darkImg = await win.webContents.capturePage();
  fs.writeFileSync(path.join(os.tmpdir(), 'svg-preview-dark.png'), darkImg.toPNG());

  console.log('wrote svg-preview-light.png and svg-preview-dark.png to', os.tmpdir());
  app.quit();
});
