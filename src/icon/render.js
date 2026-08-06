'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const { getPalette } = require('./theme');

/**
 * Hand-drawn 3x5 dot-matrix digits, drawn as filled pixel-aligned squares
 * rather than a scalable font.
 *
 * Real-world feedback on two earlier text-based versions (Segoe UI, both a
 * right/left-aligned layout and a centered fit-to-width one) was that the
 * digits were too small and blurry to read at actual tray size - a
 * vector font's anti-aliasing is exactly what makes native monochrome
 * tray icons (network/volume/battery) look crisp instead of mushy at 16px:
 * they're pixel-perfect bitmaps, not tiny anti-aliased text. This draws
 * digits the same way.
 */
const DIGIT_PATTERNS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '001', '001', '001'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

const DIGIT_COLS = 3;
const DIGIT_ROWS = 5;
const DIGIT_GAP_COLS = 1;

function drawDigit(ctx, digit, originX, originY, cell) {
  const pattern = DIGIT_PATTERNS[digit];
  for (let row = 0; row < DIGIT_ROWS; row++) {
    for (let col = 0; col < DIGIT_COLS; col++) {
      if (pattern[row][col] === '1') {
        ctx.fillRect(originX + col * cell, originY + row * cell, cell, cell);
      }
    }
  }
}

function drawNumberRow(ctx, text, centerX, originY, cell) {
  const digits = text.split('').map(Number);
  const rowWidthCells = digits.length * DIGIT_COLS + (digits.length - 1) * DIGIT_GAP_COLS;
  let x = Math.round(centerX - (rowWidthCells * cell) / 2);
  for (const digit of digits) {
    drawDigit(ctx, digit, x, originY, cell);
    x += (DIGIT_COLS + DIGIT_GAP_COLS) * cell;
  }
}

/**
 * Renders a stacked fraction ("10/20") to a PNG buffer using the pixel
 * digit font above - numerator on top, denominator on the bottom,
 * separated by a thin horizontal divider. No Electron dependency here on
 * purpose, so this (and scripts/preview-icon.js) runs under plain `node`.
 *
 * The layout is built entirely from integer pixel-cell math (`cell =
 * size / 16`, so exactly 1px per cell at 16px and 2px at 32px) - every
 * rectangle lands on a whole pixel, so there is no anti-aliasing blur at
 * any supported icon size.
 *
 * No "%" signs - verified via scripts/preview-icon.js on the earlier
 * text-based version that they clip once combined with two-digit numbers;
 * the percentage is spelled out in the tray tooltip instead. Numbers are
 * always zero-padded to 2 digits ("05", not "5") so row width - and
 * therefore centering - stays identical between updates.
 *
 * @param {object} opts
 * @param {number} opts.numerator 0-100
 * @param {number} opts.denominator 0-100
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

  const cell = size / 16;
  // Zero-padded to 2 digits so row width (and therefore centering) stays
  // identical between updates. 100 is the one value 3 digits wide instead
  // of 2 - drawNumberRow's centering math handles that width automatically,
  // it just ends up a little wider than the 2-digit case.
  const numText = String(numerator).padStart(2, '0');
  const denText = String(denominator).padStart(2, '0');

  // Vertical layout in 16 cells total: 1 margin + 5 digit + 1 gap +
  // 1 separator + 1 gap + 5 digit + 1 margin = 16, exactly filling the
  // icon at any size with no leftover/overflow.
  const topRowY = 1 * cell;
  const separatorY = 7 * cell;
  const bottomRowY = 9 * cell;

  ctx.fillStyle = palette.foreground;
  drawNumberRow(ctx, numText, size / 2, topRowY, cell);
  drawNumberRow(ctx, denText, size / 2, bottomRowY, cell);

  ctx.fillStyle = palette.separator;
  ctx.fillRect(2 * cell, separatorY, 12 * cell, cell);

  return canvas.toBuffer('image/png');
}

/**
 * Same 3x5 pixel font, used for single-character status glyphs so they
 * stay visually consistent with the fraction icon instead of switching
 * back to blurry vector text.
 */
const STATUS_PATTERNS = {
  'missing-credentials': ['111', '001', '011', '000', '010'], // "?"
  'auth-error': ['010', '010', '010', '000', '010'], // "!"
  loading: ['000', '000', '000', '000', '101'], // ".."
};

/**
 * Renders a single-symbol status icon for non-happy-path states where
 * there is no meaningful percentage to show yet (or ever).
 *
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

  const originX = Math.round(size / 2 - (DIGIT_COLS * cell) / 2);
  const originY = Math.round(size / 2 - (DIGIT_ROWS * cell) / 2);
  for (let row = 0; row < DIGIT_ROWS; row++) {
    for (let col = 0; col < DIGIT_COLS; col++) {
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
