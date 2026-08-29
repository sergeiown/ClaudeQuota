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
const MENU_CROP = { x: 1563, y: 898, width: 230, height: 250 };

const { app, Tray, nativeImage, nativeTheme } = require('electron');
const { execFileSync } = require('child_process');
const path = require('path');
const { renderFractionIcon } = require('../src/icon/render');
const { buildTrayMenu } = require('../src/main/menu');

const OUT_DIR = path.join(__dirname, '..', 'docs');

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

    console.log('wrote', outPath);
  }

  tray.destroy();
  app.quit();
});
