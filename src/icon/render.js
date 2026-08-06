'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const { getPalette } = require('./theme');

/**
 * Renders a diagonal-slash fraction ("10/20") to a PNG buffer - numerator
 * raised to the upper right, denominator lowered to the lower left of the
 * slash, matching classic typographic fraction layout. No Electron
 * dependency here on purpose, so this (and scripts/preview-icon.js) runs
 * under plain `node`.
 *
 * No "%" signs here - verified via scripts/preview-icon.js that they clip
 * at both 16px and 32px once combined with two-digit numbers and the
 * slash. The percentage is spelled out in the tray tooltip instead.
 *
 * Numbers are always zero-padded to 2 digits ("05", not "5"). Verified via
 * scripts/preview-icon.js that un-padded single digits collapse into an
 * illegible blob with the slash at 16px - there just isn't enough text
 * width to keep clear of it. Padding keeps every value the same width the
 * two-digit case was already tuned for. 100 is the one value that doesn't
 * fit that padding (3 digits) - it gets a smaller font instead of clipping.
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

  const numText = String(numerator).padStart(2, '0');
  const denText = String(denominator).padStart(2, '0');

  const numberFontSize = Math.round(size * 0.42);
  const slashFontSize = Math.round(size * 0.8);

  // Diagonal slash first, underneath the numbers - most fonts already
  // render "/" as a glyph spanning most of the em height, which reads as
  // a fraction bar when the numbers straddle it.
  ctx.font = `${slashFontSize}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.separator;
  ctx.fillText('/', size * 0.5, size * 0.52);

  ctx.fillStyle = palette.foreground;

  // 100 is 3 digits where every other value is exactly 2 - shrink just
  // that piece rather than let it overflow past the icon edge.
  ctx.font = `bold ${numText.length > 2 ? Math.round(numberFontSize * 0.72) : numberFontSize}px Segoe UI`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(numText, size * 0.66, size * 0.44);

  ctx.font = `bold ${denText.length > 2 ? Math.round(numberFontSize * 0.72) : numberFontSize}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(denText, size * 0.34, size * 0.86);

  return canvas.toBuffer('image/png');
}

const STATUS_SYMBOLS = {
  'missing-credentials': '?',
  'auth-error': '!',
  loading: '…', // ellipsis
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

  ctx.font = `bold ${Math.round(size * 0.7)}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = kind === 'auth-error' ? palette.errorForeground : palette.foreground;
  ctx.fillText(STATUS_SYMBOLS[kind] || '?', size * 0.5, size * 0.54);

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderFractionIcon,
  renderStatusIcon,
};
