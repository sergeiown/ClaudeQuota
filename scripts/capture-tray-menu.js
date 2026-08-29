/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Captures the real tray context menu, light and dark, for the readme.
// Must run under electron.exe, not plain node:
//   electron scripts/capture-tray-menu.js
//
// The menu is a native OS surface - no webContents to capturePage() - so
// this does a real screen-region capture (PowerShell/System.Drawing).
//
// popUpContextMenu() defaults to opening at the current mouse cursor
// position, not the tray icon - useless for a reproducible crop, since
// this dev environment's interactive desktop is shared with a visibly
// busy IDE/chat session and the cursor moves around independently of this
// script. Passing an explicit position anchored to the tray icon's own
// bounds instead makes it land in the same place every run. MENU_CROP was
// then hand-verified against a full-screen reference capture at that fixed
// position - re-derive it the same way if the menu ever moves.
const MENU_CROP = { x: 1585, y: 888, width: 208, height: 262 };

const { app, Tray, nativeImage, nativeTheme } = require('electron');
const { execFileSync } = require('child_process');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const { renderFractionIcon } = require('../src/icon/render');
const { buildTrayMenu } = require('../src/main/menu');

const OUT_DIR = path.join(__dirname, '..', 'docs');
const BG_MATCH_THRESHOLD = 24;

function capturePowerShellRegion(x, y, width, height, outPath) {
  const script = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap ${width}, ${height}
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(${x}, ${y}, 0, 0, (New-Object System.Drawing.Size(${width}, ${height})))
$bmp.Save('${outPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

// The crop still has whatever was behind the menu (this machine's desktop)
// filling its corners, since the real menu card has rounded corners. Flood-
// fills from every border pixel and erases anything close in color to what
// it started from, leaving the card (and its soft drop shadow, which fades
// gradually rather than in one flat color and so mostly survives the color
// threshold) on a transparent background instead of a solid rectangle.
async function cutBackgroundTransparent(pngPath) {
  const img = await loadImage(fs.readFileSync(pngPath));
  const { width, height } = img;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // The crop margin guarantees the very corner is background, not the card.
  const [seedR, seedG, seedB] = [data[0], data[1], data[2]];

  const visited = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, x + (height - 1) * width);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + (width - 1));
  }

  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const o = idx * 4;
    const dist = Math.abs(data[o] - seedR) + Math.abs(data[o + 1] - seedG) + Math.abs(data[o + 2] - seedB);
    if (dist > BG_MATCH_THRESHOLD) continue;

    data[o + 3] = 0;
    const px = idx % width;
    const py = Math.floor(idx / width);
    if (px > 0) stack.push(idx - 1);
    if (px < width - 1) stack.push(idx + 1);
    if (py > 0) stack.push(idx - width);
    if (py < height - 1) stack.push(idx + width);
  }

  ctx.putImageData(imageData, 0, 0);
  fs.writeFileSync(pngPath, canvas.toBuffer('image/png'));
}

app.whenReady().then(async () => {
  const tray = new Tray(nativeImage.createFromBuffer(renderFractionIcon({ numerator: 66, denominator: 77, size: 16, isDark: false })));
  tray.setToolTip('ClaudeQuota');

  for (const isDark of [false, true]) {
    nativeTheme.themeSource = isDark ? 'dark' : 'light';
    await new Promise((r) => setTimeout(r, 300));
    tray.setImage(nativeImage.createFromBuffer(renderFractionIcon({ numerator: 66, denominator: 77, size: 16, isDark })));

    const menu = buildTrayMenu({
      autoLaunchEnabled: true,
      onToggleAutoLaunch: () => {},
      notificationsEnabled: true,
      onToggleNotifications: () => {},
      displayStyle: 'bars',
      onToggleDisplayStyle: () => {},
      onOpenLog: () => {},
      onAbout: () => {},
      onQuit: () => {},
    });
    tray.setContextMenu(menu);
    const trayBounds = tray.getBounds();

    const outPath = path.join(OUT_DIR, `tray-menu-${isDark ? 'dark' : 'light'}.png`);

    // popUpContextMenu() enters a native modal loop on Windows and doesn't
    // return to JS until the menu is dismissed - so the capture-then-close
    // step has to be armed as a timer *before* calling it, not written as
    // the next line of sequential code after it. Electron still pumps
    // Node's timers during that nested loop, which is what lets this fire.
    await new Promise((resolve) => {
      setTimeout(() => {
        capturePowerShellRegion(MENU_CROP.x, MENU_CROP.y, MENU_CROP.width, MENU_CROP.height, outPath);
        menu.closePopup();
        resolve();
      }, 600);
      tray.popUpContextMenu(menu, { x: trayBounds.x, y: trayBounds.y });
    });
    await new Promise((r) => setTimeout(r, 500));

    await cutBackgroundTransparent(outPath);
    console.log('wrote', outPath);
  }

  tray.destroy();
  app.quit();
});
