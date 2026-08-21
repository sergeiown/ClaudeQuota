/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const fs = require('fs');
const path = require('path');
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

// Loaded once and inlined as a data: URI in every popup render - the popup
// is a data: URL document, so it can't load a font from a regular file
// path the way a normal page would.
const OVERLAY_FONT_BASE64 = fs.readFileSync(
  path.join(__dirname, '..', '..', 'assets', 'fonts', 'Fredoka-SemiBold.woff2')
).toString('base64');

const TRAY_GAP = 8;

const BARS_WIDTH = 400;
const BARS_HEIGHT = 520;
const COLUMNS_WIDTH = 380;
const COLUMNS_HEIGHT = 540;
const COLUMN_BLOCK_WIDTH = 160;

// Fixed per style - the detail text under each bar comes from a small,
// known set of app-authored strings, not arbitrary user input, so its
// height doesn't need to be measured/estimated like the old rotated
// column label did.
function computeDimensions({ style }) {
  if (style === 'columns') {
    return { width: COLUMNS_WIDTH, height: COLUMNS_HEIGHT };
  }
  return { width: BARS_WIDTH, height: BARS_HEIGHT };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const FIVE_HOUR_LABEL = '5-hour window';
const SEVEN_DAY_LABEL = '7-day window';
const FIVE_HOUR_NOTE = 'A rolling window that starts with your first message in a session.';
const SEVEN_DAY_NOTE = 'A shared cap across claude.ai, the IDE and Claude Code, resetting weekly.';
const FOOTER_NOTE = 'Actual usage varies with conversation length, the model used and enabled features.';

function buildBlock({ imgClass, image, percentText, overlayClass, resetLine, note }) {
  return `
      <div class="block">
        <div class="img-wrap">
          <img class="${imgClass}" src="data:image/png;base64,${image}">
          <div class="percent-overlay ${overlayClass}">${escapeHtml(percentText)}</div>
        </div>
        <div class="detail">
          <div class="detail-reset">${escapeHtml(resetLine)}</div>
          ${note ? `<div class="detail-note">${escapeHtml(note)}</div>` : ''}
        </div>
      </div>`;
}

function buildHtml({ numerator, denominator, style, isDark, headerTitle, headerDetail, lineOne, lineTwo, hasData }) {
  const renderFn = RENDER_FN_BY_STYLE[style] || renderBarPreview;
  const imageOne = renderFn({ percent: numerator, variant: 'five-hour', isDark }).toString('base64');
  const imageTwo = renderFn({ percent: denominator, variant: 'seven-day', isDark }).toString('base64');
  const isColumns = style === 'columns';

  const titleColor = isDark ? 'rgba(244, 244, 245, 0.92)' : 'rgba(26, 26, 26, 0.85)';
  const detailColor = isDark ? 'rgba(244, 244, 245, 0.72)' : 'rgba(26, 26, 26, 0.68)';
  const mutedColor = isDark ? 'rgba(244,244,245,0.68)' : 'rgba(26,26,26,0.65)';
  const noteColor = isDark ? 'rgba(244,244,245,0.5)' : 'rgba(26,26,26,0.5)';
  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const gradient = isDark
    ? 'linear-gradient(160deg, rgba(46,46,50,0.97), rgba(24,24,27,0.96))'
    : 'linear-gradient(160deg, rgba(255,255,255,0.97), rgba(240,241,245,0.95))';
  const shadow = isDark
    ? '0 12px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 12px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)';

  const blockOne = buildBlock({
    imgClass: isColumns ? 'col-img' : 'bar-img',
    image: imageOne,
    // No percent shown while there's no real data - a bold "0%" would read
    // as a measured value rather than as "unknown".
    percentText: hasData ? `5h ${numerator}%` : '5h',
    overlayClass: isColumns ? 'columns-overlay' : 'bars-overlay',
    resetLine: hasData ? `${FIVE_HOUR_LABEL} ${lineOne}` : lineOne,
    note: hasData ? FIVE_HOUR_NOTE : null,
  });
  const blockTwo = buildBlock({
    imgClass: isColumns ? 'col-img' : 'bar-img',
    image: imageTwo,
    percentText: hasData ? `7d ${denominator}%` : '7d',
    overlayClass: isColumns ? 'columns-overlay' : 'bars-overlay',
    resetLine: hasData ? `${SEVEN_DAY_LABEL} ${lineTwo}` : lineTwo,
    note: hasData ? SEVEN_DAY_NOTE : null,
  });

  const content = isColumns
    ? `<div class="col-group">${blockOne}${blockTwo}</div>`
    : `<div class="bar-stack">${blockOne}${blockTwo}</div>`;

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
  @font-face {
    font-family: 'Fredoka';
    font-weight: 600;
    src: url(data:font/woff2;base64,${OVERLAY_FONT_BASE64}) format('woff2');
  }
  .header { margin-bottom: 14px; text-align: center; }
  .header-title { font-size: 17px; font-weight: 700; color: ${titleColor}; line-height: 1.3; }
  .header-detail { font-size: 12.5px; color: ${detailColor}; line-height: 1.3; margin-top: 2px; }
  .bar-stack { display: flex; flex-direction: column; gap: 20px; }
  .col-group { display: flex; flex-direction: row; gap: 24px; align-items: flex-start; }
  .block { display: flex; flex-direction: column; align-items: center; }
  .col-group .block { width: ${COLUMN_BLOCK_WIDTH}px; }
  .img-wrap { position: relative; display: inline-flex; }
  .bar-img { width: ${PREVIEW_BAR_WIDTH}px; height: ${PREVIEW_BAR_HEIGHT}px; }
  .col-img { width: ${PREVIEW_COLUMN_WIDTH}px; height: ${PREVIEW_COLUMN_HEIGHT}px; }
  .percent-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    -webkit-user-select: none;
    font-family: 'Fredoka', 'Segoe UI Variable Display', 'Segoe UI', sans-serif;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    /* Low fill opacity so the bar's own color shows through the letters -
       a thin dark halo all around (not just underneath) keeps the shapes
       readable as an engraved outline over both the fill and the pale
       track half, and a slim top highlight adds the raised, glassy look. */
    color: rgba(255, 255, 255, 0.32);
    text-shadow:
      -1.5px 0 2px rgba(0, 0, 0, 0.65),
      1.5px 0 2px rgba(0, 0, 0, 0.65),
      0 -1.5px 2px rgba(0, 0, 0, 0.65),
      0 1.5px 2px rgba(0, 0, 0, 0.65),
      0 1px 0 rgba(255, 255, 255, 0.35),
      0 2px 5px rgba(0, 0, 0, 0.3);
  }
  .percent-overlay.bars-overlay { font-size: 30px; letter-spacing: 0.4px; }
  .percent-overlay.columns-overlay { flex-direction: column; font-size: 17px; line-height: 1.15; gap: 1px; }
  .detail { margin-top: 8px; text-align: center; }
  .detail-reset { font-size: 16px; font-weight: 600; color: ${mutedColor}; }
  .detail-note { margin-top: 3px; font-size: 11.5px; color: ${noteColor}; line-height: 1.35; }
  .footer-note { margin-top: 16px; max-width: 340px; text-align: center; font-size: 11px; color: ${noteColor}; line-height: 1.35; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-title">${escapeHtml(headerTitle)}</div>
    ${headerDetail ? `<div class="header-detail">${escapeHtml(headerDetail)}</div>` : ''}
  </div>
  ${content}
  ${hasData ? `<div class="footer-note">${escapeHtml(FOOTER_NOTE)}</div>` : ''}
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

// Square corners, not a CSS border-radius: a frameless window's actual pixel
// bounds are always a plain rectangle, so a rounded card drawn inside one
// reads as a sticker on a square window - a shadow alone avoids that.
function createPopupController() {
  let win = null;
  let isOpen = false;

  // Closing uses opacity + click-through, not hide() or an off-screen
  // position - both throttle requestAnimationFrame (hide() directly, an
  // off-screen position via Windows' occlusion detection once combined
  // with setAlwaysOnTop() on reopen), breaking waitForPaint() below.
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
      opacity: 0,
      hasShadow: false, // the card paints its own CSS shadow instead
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.on('blur', () => closePopup());
    return win;
  }

  function waitForPaint(w) {
    return w.webContents.executeJavaScript(
      'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
    );
  }

  async function render(args, trayBounds) {
    const w = ensureWindow();
    if (trayBounds) positionNearTray(w, trayBounds, computeDimensions(args));
    await w.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildHtml(args))}`);
    await waitForPaint(w);
  }

  function closePopup() {
    if (!win || win.isDestroyed()) return;
    isOpen = false;
    win.setOpacity(0);
    win.setIgnoreMouseEvents(true);
  }

  async function openPopup(args, trayBounds) {
    await render(args, trayBounds);
    const w = ensureWindow();
    // Re-asserted on every open - other apps' own always-on-top windows
    // could otherwise still end up above a topmost flag that was only
    // ever set once, back when the window was first created.
    w.setAlwaysOnTop(true);
    w.setIgnoreMouseEvents(false);
    if (!w.isVisible()) w.show();
    w.setOpacity(1);
    w.focus();
    isOpen = true;
  }

  async function toggle(args, trayBounds) {
    if (isOpen) {
      closePopup();
      return;
    }
    await openPopup(args, trayBounds);
  }

  async function updateIfVisible(args, trayBounds) {
    if (isOpen) await render(args, trayBounds);
  }

  function hide() {
    closePopup();
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
