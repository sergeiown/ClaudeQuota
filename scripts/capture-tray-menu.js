/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Captures the real tray context menu, light and dark, for the readme.
// Must run under electron.exe, not plain node:
//   electron scripts/capture-tray-menu.js
//
// The menu is a native OS surface - no webContents to capturePage() - so
// this does a real screen-region capture (PowerShell/System.Drawing), then
// crops tightly to the menu card itself (not a fixed pixel guess): this
// dev environment's desktop behind the menu isn't stable between runs
// (whatever app/content happens to be there at the time), so a hardcoded
// crop verified once can easily be wrong the next run. Auto-detecting the
// card's own bounding box from the capture itself doesn't have that problem.

const { app, Tray, nativeImage, nativeTheme, screen } = require('electron');
const { execFileSync } = require('child_process');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const os = require('os');
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

// The menu card is roughly 200x250px (~50,000px) at this machine's DPI -
// a light-toned blob is reliably just the card (nothing else on a real
// desktop is both that light and that large), but a dark-toned blob can
// otherwise merge with an equally-dark app window right behind the tray,
// growing far past the card's own real size - so candidates get scored by
// closeness to the expected area instead of picking the largest outright.
const EXPECTED_CARD_AREA = 50000;

// No seed point needed - scans the whole capture for connected components
// matching the card's own background tone (near-white for the light menu,
// near-black for the dark one). The fill within each component can't cross
// into the (much darker/lighter, by design) text glyphs, but spreads
// through the blank margin running along the card's whole inner perimeter,
// so its bounding box still equals the card's true extent.
function largestCardToneBlob(data, width, height, isDark) {
  const matches = (o) => {
    const r = data[o], g = data[o + 1], b = data[o + 2];
    return isDark ? (r < 70 && g < 70 && b < 70) : (r > 225 && g > 225 && b > 225);
  };

  const visited = new Uint8Array(width * height);
  let best = null;

  for (let start = 0; start < width * height; start++) {
    if (visited[start] || !matches(start * 4)) continue;
    const stack = [start];
    visited[start] = 1;
    let minX = width, maxX = 0, minY = height, maxY = 0, size = 0;

    while (stack.length) {
      const idx = stack.pop();
      const px = idx % width;
      const py = Math.floor(idx / width);
      size++;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      const neighbors = [];
      if (px > 0) neighbors.push(idx - 1);
      if (px < width - 1) neighbors.push(idx + 1);
      if (py > 0) neighbors.push(idx - width);
      if (py < height - 1) neighbors.push(idx + width);
      for (const n of neighbors) {
        if (!visited[n] && matches(n * 4)) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    // A thin, scattered region (a scrollbar track, a sidebar edge) can
    // rack up a similar pixel count to the card purely by spanning a much
    // bigger area sparsely - the card itself is a solid rectangle minus
    // some text notches, so it fills most of its own bounding box.
    const fillRatio = size / (w * h);
    if (fillRatio < 0.7) continue;

    // A slim vertical/horizontal panel edge can be just as solidly filled
    // as the card while being nothing like its shape - the menu is always
    // roughly as wide as it is tall, never a thin strip running the height
    // (or width) of the screen.
    const aspectRatio = Math.max(w, h) / Math.min(w, h);
    if (aspectRatio > 2.5) continue;

    const score = Math.abs(size - EXPECTED_CARD_AREA);
    if (!best || score < best.score) best = { minX, maxX, minY, maxY, size, score };
  }

  return best;
}

async function detectCardBounds(rawPath, isDark) {
  const img = await loadImage(fs.readFileSync(rawPath));
  const { width, height } = img;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;

  const bounds = largestCardToneBlob(data, width, height, isDark);
  if (!bounds) throw new Error('no card-toned region found in the capture');
  return bounds;
}

async function cropTo(rawPath, outPath, bounds) {
  const img = await loadImage(fs.readFileSync(rawPath));
  const cropW = bounds.maxX - bounds.minX + 1;
  const cropH = bounds.maxY - bounds.minY + 1;
  const outCanvas = createCanvas(cropW, cropH);
  outCanvas.getContext('2d').drawImage(img, bounds.minX, bounds.minY, cropW, cropH, 0, 0, cropW, cropH);
  fs.writeFileSync(outPath, outCanvas.toBuffer('image/png'));
  console.log('wrote', outPath, `(${cropW}x${cropH})`);
}

app.whenReady().then(async () => {
  const tray = new Tray(nativeImage.createFromBuffer(renderFractionIcon({ numerator: 66, denominator: 77, size: 16, isDark: false })));
  tray.setToolTip('ClaudeQuota');

  const display = screen.getPrimaryDisplay();
  const scale = display.scaleFactor;
  // Detected once from the light run (a near-white blob is unambiguous on
  // any real desktop) and reused for dark - same menu, same anchor point,
  // so its size and position on screen don't actually change with theme,
  // only its colors do, which is exactly what a color-based detector can't
  // reliably tell apart from an equally-dark app window behind it.
  let sharedBounds = null;

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

    const rawPath = path.join(os.tmpdir(), `tray-menu-raw-${isDark ? 'dark' : 'light'}.png`);
    const outPath = path.join(OUT_DIR, `tray-menu-${isDark ? 'dark' : 'light'}.png`);

    // popUpContextMenu() enters a native modal loop on Windows and doesn't
    // return to JS until the menu is dismissed - so the capture-then-close
    // step has to be armed as a timer *before* calling it, not written as
    // the next line of sequential code after it. Electron still pumps
    // Node's timers during that nested loop, which is what lets this fire.
    // popUpContextMenu also defaults to opening at the current mouse
    // cursor, not the tray icon - an explicit position at least keeps it
    // near the tray rather than wherever the cursor happens to be.
    await new Promise((resolve) => {
      setTimeout(() => {
        capturePowerShellRegion(0, 0, display.bounds.width * scale, display.bounds.height * scale, rawPath);
        menu.closePopup();
        resolve();
      }, 600);
      tray.popUpContextMenu(menu, { x: trayBounds.x, y: trayBounds.y });
    });
    await new Promise((r) => setTimeout(r, 500));

    if (!sharedBounds) sharedBounds = await detectCardBounds(rawPath, isDark);
    await cropTo(rawPath, outPath, sharedBounds);
  }

  tray.destroy();
  app.quit();
});
