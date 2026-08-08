/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const { getPalette } = require('./theme');

// Shared grid used by the small status glyphs below (3 wide, 5 tall).
const GLYPH_COLS = 3;
const GLYPH_ROWS = 5;

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

// Same traffic-light meaning for both bars/rings: comfortable, getting
// close, at/near the limit. 0-50 good, 51-80 warn, 81-100 danger.
function fillColorFor(percent, palette) {
  if (percent >= 81) return palette.fillDanger;
  if (percent >= 51) return palette.fillWarn;
  return palette.fillGood;
}

/**
 * Draws one horizontal fill bar: a track rectangle tinted to identify
 * *which* bar this is (own color per bar, constant regardless of level),
 * then a solid rectangle over the filled proportion colored by *how full*
 * it is (green/amber/red, shared meaning across both bars). Both drawn
 * with integer pixel-cell math, so edges land on whole pixels with no
 * anti-aliasing blur at any supported icon size.
 *
 * A thin divider is drawn at the fill/track boundary using the palette's
 * neutral foreground color - a color-independent guarantee that the
 * boundary stays visible even if a given track/fill pairing happens to
 * land close in lightness (verified this actually happens: the light
 * track and the amber fill came out within ~1 of 255 apart in computed
 * luminance, i.e. next to invisible, before this was added).
 */
function drawBar(ctx, x, y, width, height, percent, trackColor, palette) {
  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, width, height);

  const filledWidth = Math.round((width * clampPercent(percent)) / 100);
  if (filledWidth > 0) {
    ctx.fillStyle = fillColorFor(clampPercent(percent), palette);
    ctx.fillRect(x, y, filledWidth, height);
  }

  if (filledWidth > 0 && filledWidth < width) {
    const dividerWidth = Math.max(1, Math.round(height / 6));
    ctx.fillStyle = palette.divider;
    ctx.fillRect(x + filledWidth, y, dividerWidth, height);
  }
}

/**
 * Renders two stacked horizontal fill bars to a PNG buffer - top bar for
 * the 5-hour window, bottom bar for the 7-day window, each filled
 * left-to-right proportionally to its utilization percentage. No Electron
 * dependency here on purpose, so this (and scripts/preview-icon.js) runs
 * under plain `node`.
 *
 * This replaced two earlier digit-based versions (a Segoe UI render, then
 * a hand-drawn pixel-digit font) after real-world feedback that even
 * pixel-perfect 2-digit numbers were still too small to read comfortably
 * at actual tray size once both a numerator and denominator had to share
 * one 16x16 icon. A fill bar doesn't need to be "read" the same way
 * digits do - people judge a partially-filled bar (battery, wifi signal)
 * accurately at a glance even at tiny sizes. The exact percentages are
 * spelled out in the tray tooltip on hover, same as before.
 *
 * Color carries two independent signals (per follow-up feedback that a
 * single neutral color made the two bars hard to tell apart and gave no
 * sense of urgency): the *track* (unfilled part) is tinted per bar - blue
 * for 5-hour, purple for 7-day - constant regardless of level, so the two
 * rows stay visually distinct even at 0%. The *fill* (filled part) is
 * colored by how close to the limit it is - green/amber/red - the same
 * meaning on both bars.
 *
 * @param {object} opts
 * @param {number} opts.numerator 0-100 (5-hour utilization)
 * @param {number} opts.denominator 0-100 (7-day utilization)
 * @param {number} opts.size 16 or 32 (px, square)
 * @param {boolean} opts.isDark
 * @returns {Buffer} PNG
 */
function renderFractionIcon({ numerator, denominator, size, isDark }) {
  const palette = getPalette(isDark);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  // Vertical layout in 16 cells total: 1 margin + 6 bar + 2 gap + 6 bar +
  // 1 margin = 16, exactly filling the icon at any size with no
  // leftover/overflow. Horizontal: 1 margin each side.
  const cell = size / 16;
  const marginX = 1 * cell;
  const barWidth = size - marginX * 2;
  const barHeight = 6 * cell;
  const topBarY = 1 * cell;
  const bottomBarY = 9 * cell;

  drawBar(ctx, marginX, topBarY, barWidth, barHeight, numerator, palette.trackFiveHour, palette);
  drawBar(ctx, marginX, bottomBarY, barWidth, barHeight, denominator, palette.trackSevenDay, palette);

  return canvas.toBuffer('image/png');
}

/**
 * Small pixel glyphs for non-happy-path states where there is no
 * meaningful percentage to show yet (or ever). Same hand-drawn approach
 * as the fraction bars - crisp filled squares, no anti-aliased text.
 */
const STATUS_PATTERNS = {
  'missing-credentials': ['111', '001', '011', '000', '010'], // "?"
  'auth-error': ['010', '010', '010', '000', '010'], // "!"
  loading: ['000', '000', '000', '000', '101'], // ".."
};

/**
 * @param {object} opts
 * @param {'missing-credentials'|'auth-error'|'loading'} opts.kind
 * @param {number} opts.size
 * @param {boolean} opts.isDark
 * @returns {Buffer} PNG
 */
function renderStatusIcon({ kind, size, isDark }) {
  const palette = getPalette(isDark);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  const cell = size / 8;
  const pattern = STATUS_PATTERNS[kind] || STATUS_PATTERNS['missing-credentials'];
  ctx.fillStyle = kind === 'auth-error' ? palette.errorForeground : palette.foreground;

  const originX = Math.round(size / 2 - (GLYPH_COLS * cell) / 2);
  const originY = Math.round(size / 2 - (GLYPH_ROWS * cell) / 2);
  for (let row = 0; row < GLYPH_ROWS; row++) {
    for (let col = 0; col < GLYPH_COLS; col++) {
      if (pattern[row][col] === '1') {
        ctx.fillRect(originX + col * cell, originY + row * cell, cell, cell);
      }
    }
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderFractionIcon,
  renderStatusIcon,
};
