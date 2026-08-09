/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { BrowserWindow, screen } = require('electron');
const {
  renderBarPreview,
  renderColumnPreview,
  PREVIEW_BAR_WIDTH,
  PREVIEW_BAR_HEIGHT,
  PREVIEW_COLUMN_WIDTH,
  PREVIEW_COLUMN_HEIGHT,
} = require('../icon/render');

const RENDER_FN_BY_STYLE = {
  bars: renderBarPreview,
  columns: renderColumnPreview,
};

const TRAY_GAP = 8;

const BARS_WIDTH = 400;
const BARS_HEIGHT = 430;
const COLUMNS_WIDTH = 380;
const LABEL_LANE_WIDTH = 22;

// Two lines (title + date detail) plus the gap under them.
const HEADER_RESERVED_HEIGHT = 56;
const BODY_PADDING = 36;

// Rough average glyph width at 14px - just for sizing the window before
// Chromium lays out the real text, not meant to be pixel-exact.
const AVG_CHAR_WIDTH = 7.6;

function estimateTextWidth(text) {
  return (text || '').length * AVG_CHAR_WIDTH;
}

// The rotated vertical label can need more room than PREVIEW_COLUMN_HEIGHT -
// it's centered in a lane of that fixed height so a longer label overflows
// evenly past both edges instead of pushing the image down. Both columns
// share the longer label's overflow so they stay level with each other.
function columnsOverflow(lineOne, lineTwo) {
  const longest = Math.max(estimateTextWidth(lineOne), estimateTextWidth(lineTwo));
  return Math.max(0, Math.ceil(longest) + 16 - PREVIEW_COLUMN_HEIGHT);
}

function computeDimensions({ style, lineOne, lineTwo }) {
  if (style === 'columns') {
    const overflow = columnsOverflow(lineOne, lineTwo);
    const height = HEADER_RESERVED_HEIGHT + overflow + PREVIEW_COLUMN_HEIGHT + BODY_PADDING;
    return { width: COLUMNS_WIDTH, height, overflow };
  }
  return { width: BARS_WIDTH, height: BARS_HEIGHT, overflow: null };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildHtml({ numerator, denominator, style, isDark, headerTitle, headerDetail, lineOne, lineTwo }) {
  const renderFn = RENDER_FN_BY_STYLE[style] || renderBarPreview;
  const imageOne = renderFn({ percent: numerator, variant: 'five-hour', isDark }).toString('base64');
  const imageTwo = renderFn({ percent: denominator, variant: 'seven-day', isDark }).toString('base64');
  const { overflow } = computeDimensions({ style, lineOne, lineTwo });
  const marginTop = overflow ? overflow / 2 : 0;

  // Softer than pure black/white.
  const titleColor = isDark ? 'rgba(244, 244, 245, 0.92)' : 'rgba(26, 26, 26, 0.85)';
  const detailColor = isDark ? 'rgba(244, 244, 245, 0.72)' : 'rgba(26, 26, 26, 0.68)';
  const mutedColor = isDark ? 'rgba(244,244,245,0.68)' : 'rgba(26,26,26,0.65)';
  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const gradient = isDark
    ? 'linear-gradient(160deg, rgba(46,46,50,0.97), rgba(24,24,27,0.96))'
    : 'linear-gradient(160deg, rgba(255,255,255,0.97), rgba(240,241,245,0.95))';
  const shadow = isDark
    ? '0 12px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 12px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)';

  const content =
    style === 'columns'
      ? `
    <div class="col-group" style="margin-top:${marginTop}px">
      <div class="col-block">
        <img class="col-img" src="data:image/png;base64,${imageOne}">
        <div class="label-lane"><div class="label vertical">${escapeHtml(lineOne)}</div></div>
      </div>
      <div class="col-block">
        <img class="col-img" src="data:image/png;base64,${imageTwo}">
        <div class="label-lane"><div class="label vertical">${escapeHtml(lineTwo)}</div></div>
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
    color: ${detailColor};
    background: ${gradient};
    border: 1px solid ${borderColor};
    box-shadow: ${shadow};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    -webkit-user-select: none;
  }
  .header { margin-bottom: 14px; text-align: center; }
  .header-title { font-size: 17px; font-weight: 700; color: ${titleColor}; line-height: 1.3; }
  .header-detail { font-size: 12.5px; color: ${detailColor}; line-height: 1.3; margin-top: 2px; }
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
  .bar-img { width: ${PREVIEW_BAR_WIDTH}px; height: ${PREVIEW_BAR_HEIGHT}px; }
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
  .col-img { width: ${PREVIEW_COLUMN_WIDTH}px; height: ${PREVIEW_COLUMN_HEIGHT}px; }
  .label-lane {
    position: relative;
    width: ${LABEL_LANE_WIDTH}px;
    height: ${PREVIEW_COLUMN_HEIGHT}px;
    overflow: visible;
  }
  .label-lane .label.vertical {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-90deg);
    white-space: nowrap;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-title">${escapeHtml(headerTitle)}</div>
    ${headerDetail ? `<div class="header-detail">${escapeHtml(headerDetail)}</div>` : ''}
  </div>
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

// Owns the single popup window opened by left-clicking the tray icon. Its
// content is a self-contained `data:` HTML document rebuilt from scratch on
// every render, reusing render.js's own drawing functions.
//
// Square corners, not a CSS border-radius: a frameless window's actual pixel
// bounds are always a plain rectangle, so a rounded card drawn inside one
// reads as a sticker on a square window - a shadow alone avoids that.
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
      hasShadow: false, // the card paints its own CSS shadow instead
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.on('blur', () => win.hide());
    return win;
  }

  // ready-to-show only fires once per window, hence the fallback timeout.
  function waitForPaint(w) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 80);
      w.once('ready-to-show', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async function render(args, trayBounds) {
    const w = ensureWindow();
    if (trayBounds) positionNearTray(w, trayBounds, computeDimensions(args));
    await w.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildHtml(args))}`);
  }

  async function toggle(args, trayBounds) {
    const w = ensureWindow();
    if (w.isVisible()) {
      w.hide();
      return;
    }
    await render(args, trayBounds);
    await waitForPaint(w);
    w.show();
    w.focus();
  }

  async function updateIfVisible(args, trayBounds) {
    if (win && !win.isDestroyed() && win.isVisible()) await render(args, trayBounds);
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
  computeDimensions,
};
