/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { BrowserWindow, screen } = require('electron');
const { renderFractionIcon, renderColumnsIcon } = require('../icon/render');

const RENDER_FN_BY_STYLE = {
  bars: renderFractionIcon,
  columns: renderColumnsIcon,
};

// The bars/columns image is rendered at exactly this size and displayed
// 1:1 in the popup - no CSS scaling, so no risk of blurring the crisp
// pixel-snapped edges render.js already guarantees for the tray icon.
// 224 = 16 * 14, keeping every internal cell math in render.js (which is
// all `size / 16` based) landing on whole pixels here too.
const IMAGE_SIZE = 224;

const WINDOW_WIDTH = 320;
// Tall enough for the header + image + two label lines even if one wraps
// to two lines (usage lines can run to ~50 characters, e.g. "7d: 87% -
// expires in 18 hours 40 minutes (09:10)" - verified via
// scripts/verify-popup.js that this genuinely happens, not a hypothetical).
const WINDOW_HEIGHT = 400;
const TRAY_GAP = 8;

// Solid legend-dot colors identifying which line is which - deliberately
// not the same near-transparent rgba used for the icon's own track tint
// (see theme.js), since a dot that faint wouldn't read as a color swatch
// at all against the popup's own background.
const DOT_FIVE_HOUR = '#4C86D6';
const DOT_SEVEN_DAY = '#A56AD6';

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildHtml({ numerator, denominator, style, isDark, headerText, lineOne, lineTwo }) {
  const renderFn = RENDER_FN_BY_STYLE[style] || renderFractionIcon;
  const imageBuffer = renderFn({ numerator, denominator, size: IMAGE_SIZE, isDark });
  const imageBase64 = imageBuffer.toString('base64');

  // Labels always stack vertically regardless of bar/column orientation -
  // a side-by-side layout for the columns style was tried and verified
  // (via scripts/verify-popup.js) to overflow the window and clip text,
  // since usage lines can run to ~40 characters. Stacked always fits and
  // still reads top-to-bottom in the same 5h-then-7d order as everywhere
  // else (tooltip, bars).
  const textColor = isDark ? '#f0f0f0' : '#1a1a1a';
  const mutedColor = isDark ? 'rgba(240,240,240,0.65)' : 'rgba(26,26,26,0.65)';
  const backgroundColor = isDark ? 'rgba(30,30,30,0.98)' : 'rgba(255,255,255,0.98)';
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    box-sizing: border-box;
    width: 100vw;
    height: 100vh;
    padding: 16px;
    font-family: 'Segoe UI', sans-serif;
    color: ${textColor};
    background: ${backgroundColor};
    border: 1px solid ${borderColor};
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    -webkit-user-select: none;
    overflow: hidden;
  }
  .header {
    font-size: 12px;
    color: ${mutedColor};
    margin-bottom: 10px;
    text-align: center;
  }
  .bars {
    width: ${IMAGE_SIZE}px;
    height: ${IMAGE_SIZE}px;
    image-rendering: pixelated;
    margin-bottom: 14px;
  }
  .labels {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    line-height: 1.35;
    text-align: left;
    max-width: 100%;
  }
  .dot {
    width: 10px;
    height: 10px;
    margin-top: 3px;
    border-radius: 2px;
    flex-shrink: 0;
  }
</style>
</head>
<body>
  <div class="header">${escapeHtml(headerText)}</div>
  <img class="bars" src="data:image/png;base64,${imageBase64}">
  <div class="labels">
    <div class="label"><span class="dot" style="background:${DOT_FIVE_HOUR}"></span>${escapeHtml(lineOne)}</div>
    ${lineTwo ? `<div class="label"><span class="dot" style="background:${DOT_SEVEN_DAY}"></span>${escapeHtml(lineTwo)}</div>` : ''}
  </div>
</body>
</html>`;
}

function positionNearTray(win, trayBounds) {
  const display = screen.getDisplayMatching(trayBounds);
  const { workArea } = display;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2);
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - WINDOW_WIDTH));

  // Above the icon by default (the common bottom-taskbar case); below it
  // if there isn't enough room above on this display (e.g. a top taskbar).
  let y = trayBounds.y - WINDOW_HEIGHT - TRAY_GAP;
  if (y < workArea.y) {
    y = trayBounds.y + trayBounds.height + TRAY_GAP;
  }

  win.setBounds({ x, y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
}

/**
 * Owns the single popup window - an enlarged, live copy of the tray icon's
 * bars/columns plus the same text the tooltip shows, opened by left-
 * clicking the tray icon. Built as a frameless, always-on-top window that
 * hides itself on blur, same interaction pattern as a native flyout.
 *
 * The window's content is a single self-contained `data:` HTML document
 * rebuilt from scratch on every render - there's no persistent renderer
 * state to keep in sync, so this is simpler than IPC/preload for content
 * this small, and the embedded image reuses the exact same render.js
 * functions the tray icon itself uses, so the two can never visually
 * drift apart.
 */
function createPopupController() {
  let win = null;

  function ensureWindow() {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.on('blur', () => win.hide());
    return win;
  }

  function render(args) {
    const w = ensureWindow();
    w.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildHtml(args))}`);
  }

  function toggle(args, trayBounds) {
    const w = ensureWindow();
    if (w.isVisible()) {
      w.hide();
      return;
    }
    render(args);
    positionNearTray(w, trayBounds);
    w.show();
    w.focus();
  }

  function updateIfVisible(args) {
    if (win && !win.isDestroyed() && win.isVisible()) render(args);
  }

  function hide() {
    if (win && !win.isDestroyed()) win.hide();
  }

  function destroy() {
    if (win && !win.isDestroyed()) win.destroy();
  }

  return { toggle, updateIfVisible, hide, destroy };
}

module.exports = {
  createPopupController,
  buildHtml,
};
