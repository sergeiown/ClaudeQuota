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

const HEADER_RESERVED_HEIGHT = 46;
const BODY_PADDING = 36;

// Rough average glyph width for the popup's font at 14px - good enough to
// size the window before the real text gets laid out by Chromium, not
// meant to be pixel-exact. Errs a little large on purpose.
const AVG_CHAR_WIDTH = 7.6;

function estimateTextWidth(text) {
  return (text || '').length * AVG_CHAR_WIDTH;
}

/**
 * The vertical label in the "columns" style is a rotated block of text, so
 * its rendered length can need more room than the column image is tall.
 * The label's lane is always exactly PREVIEW_COLUMN_HEIGHT - matching the
 * image - so their tops and bottoms line up exactly regardless of text
 * length; a longer label instead overflows upward past that shared top
 * edge, into `overflowAbove` extra space reserved above the whole row.
 * Both columns get the same overflowAbove (the longer of the two labels),
 * so the two labels also stay level with each other.
 */
function columnsOverflowAbove(lineOne, lineTwo) {
  const longest = Math.max(estimateTextWidth(lineOne), estimateTextWidth(lineTwo));
  return Math.max(0, Math.ceil(longest) + 16 - PREVIEW_COLUMN_HEIGHT);
}

function computeDimensions({ style, lineOne, lineTwo }) {
  if (style === 'columns') {
    const overflowAbove = columnsOverflowAbove(lineOne, lineTwo);
    const height = HEADER_RESERVED_HEIGHT + overflowAbove + PREVIEW_COLUMN_HEIGHT + BODY_PADDING;
    return { width: COLUMNS_WIDTH, height, overflowAbove };
  }
  return { width: BARS_WIDTH, height: BARS_HEIGHT, overflowAbove: null };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildHtml({ numerator, denominator, style, isDark, headerText, lineOne, lineTwo }) {
  const renderFn = RENDER_FN_BY_STYLE[style] || renderBarPreview;
  const imageOne = renderFn({ percent: numerator, variant: 'five-hour', isDark }).toString('base64');
  const imageTwo = renderFn({ percent: denominator, variant: 'seven-day', isDark }).toString('base64');
  const { overflowAbove } = computeDimensions({ style, lineOne, lineTwo });

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
    <div class="col-group" style="margin-top:${overflowAbove}px">
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
    left: 0;
    bottom: 0;
    transform-origin: bottom left;
    transform: rotate(-90deg);
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
 * the popup and tray icon can never visually drift apart. Window size is
 * recomputed on every render too, since the "columns" style's vertical
 * labels need more or less room depending on the actual text.
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
      // The OS draws its own window shadow as a plain rectangle, which would
      // otherwise show through the transparent corners as a square outline
      // around our rounded CSS card - the card already paints its own
      // shadow that actually follows its rounded shape.
      hasShadow: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.on('blur', () => win.hide());
    return win;
  }

  function render(args, trayBounds) {
    const w = ensureWindow();
    w.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildHtml(args))}`);
    if (trayBounds) positionNearTray(w, trayBounds, computeDimensions(args));
  }

  function toggle(args, trayBounds) {
    const w = ensureWindow();
    if (w.isVisible()) {
      w.hide();
      return;
    }
    render(args, trayBounds);
    w.show();
    w.focus();
  }

  function updateIfVisible(args, trayBounds) {
    if (win && !win.isDestroyed() && win.isVisible()) render(args, trayBounds);
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
