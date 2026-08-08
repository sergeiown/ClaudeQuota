/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { BrowserWindow, screen } = require('electron');
const { renderBarPreview, renderColumnPreview } = require('../icon/render');

const RENDER_FN_BY_STYLE = {
  bars: renderBarPreview,
  columns: renderColumnPreview,
};

const TRAY_GAP = 8;

const DIMENSIONS = {
  bars: { width: 380, height: 400 },
  columns: { width: 340, height: 540 },
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildHtml({ numerator, denominator, style, isDark, headerText, lineOne, lineTwo }) {
  const renderFn = RENDER_FN_BY_STYLE[style] || renderBarPreview;
  const imageOne = renderFn({ percent: numerator, variant: 'five-hour', isDark }).toString('base64');
  const imageTwo = renderFn({ percent: denominator, variant: 'seven-day', isDark }).toString('base64');

  const textColor = isDark ? '#f4f4f5' : '#1a1a1a';
  const mutedColor = isDark ? 'rgba(244,244,245,0.68)' : 'rgba(26,26,26,0.65)';
  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const gradient = isDark
    ? 'linear-gradient(160deg, rgba(46,46,50,0.97), rgba(24,24,27,0.96))'
    : 'linear-gradient(160deg, rgba(255,255,255,0.97), rgba(240,241,245,0.95))';
  const shadow = isDark
    ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 30px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)';

  const content =
    style === 'columns'
      ? `
    <div class="col-group">
      <div class="col-block">
        <img class="col-img" src="data:image/png;base64,${imageOne}">
        <div class="label vertical">${escapeHtml(lineOne)}</div>
      </div>
      <div class="col-block">
        <img class="col-img" src="data:image/png;base64,${imageTwo}">
        <div class="label vertical">${escapeHtml(lineTwo)}</div>
      </div>
    </div>`
      : `
    <div class="bar-stack">
      <div class="bar-block">
        <img class="bar-img" src="data:image/png;base64,${imageOne}">
        <div class="label">${escapeHtml(lineOne)}</div>
      </div>
      <div class="bar-block">
        <img class="bar-img" src="data:image/png;base64,${imageTwo}">
        <div class="label">${escapeHtml(lineTwo)}</div>
      </div>
    </div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  body {
    box-sizing: border-box;
    width: 100vw;
    height: 100vh;
    padding: 18px;
    font-family: 'Segoe UI Variable Text', 'Segoe UI', sans-serif;
    font-size: 14px;
    color: ${textColor};
    background: ${gradient};
    border: 1px solid ${borderColor};
    border-radius: 14px;
    box-shadow: ${shadow};
    display: flex;
    flex-direction: column;
    align-items: center;
    -webkit-user-select: none;
  }
  .header {
    font-size: 14px;
    font-weight: 700;
    color: ${textColor};
    margin-bottom: 12px;
    text-align: center;
  }
  .label { color: ${mutedColor}; font-size: 14px; line-height: 1.4; }
  .bar-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .bar-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .bar-img { width: 320px; height: 90px; }
  .bar-block .label { text-align: center; }
  .col-group {
    display: flex;
    flex-direction: row;
    gap: 28px;
    align-items: flex-start;
  }
  .col-block {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
  }
  .col-img { width: 90px; height: 320px; }
  .col-block .label.vertical {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    white-space: nowrap;
  }
</style>
</head>
<body>
  <div class="header">${escapeHtml(headerText)}</div>
  ${content}
</body>
</html>`;
}

function positionNearTray(win, trayBounds, dimensions) {
  const display = screen.getDisplayMatching(trayBounds);
  const { workArea } = display;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - dimensions.width / 2);
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - dimensions.width));

  let y = trayBounds.y - dimensions.height - TRAY_GAP;
  if (y < workArea.y) {
    y = trayBounds.y + trayBounds.height + TRAY_GAP;
  }

  win.setBounds({ x, y, width: dimensions.width, height: dimensions.height });
}

/**
 * Owns the single popup window opened by left-clicking the tray icon - an
 * enlarged, live copy of the tray icon's bars/columns plus the tooltip text.
 * The window's content is a self-contained `data:` HTML document rebuilt
 * from scratch on every render, reusing render.js's own drawing functions so
 * the popup and tray icon can never visually drift apart.
 */
function createPopupController() {
  let win = null;

  function ensureWindow() {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
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
    positionNearTray(w, trayBounds, DIMENSIONS[args.style] || DIMENSIONS.bars);
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
  DIMENSIONS,
};
