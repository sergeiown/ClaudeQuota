/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const { getPalette } = require('./theme');

const GLYPH_COLS = 3;
const GLYPH_ROWS = 5;

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function fillColorFor(percent, palette) {
  if (percent >= 81) return palette.fillDanger;
  if (percent >= 51) return palette.fillWarn;
  return palette.fillGood;
}

// Divider only earns its place for the warn color - track is near-invisible against green/red already.
function needsDivider(fillColor, palette) {
  return fillColor === palette.fillWarn;
}

function drawBar(ctx, x, y, width, height, percent, trackColor, palette) {
  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, width, height);

  const clamped = clampPercent(percent);
  const filledWidth = Math.round((width * clamped) / 100);
  const fillColor = fillColorFor(clamped, palette);
  if (filledWidth > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, filledWidth, height);
  }

  if (filledWidth > 0 && filledWidth < width && needsDivider(fillColor, palette)) {
    const dividerWidth = Math.max(1, Math.round(height / 6));
    ctx.fillStyle = palette.divider;
    ctx.fillRect(x + filledWidth, y, dividerWidth, height);
  }
}

/**
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

function drawColumn(ctx, x, y, width, height, percent, trackColor, palette) {
  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, width, height);

  const clamped = clampPercent(percent);
  const filledHeight = Math.round((height * clamped) / 100);
  const fillColor = fillColorFor(clamped, palette);
  if (filledHeight > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y + height - filledHeight, width, filledHeight);
  }

  if (filledHeight > 0 && filledHeight < height && needsDivider(fillColor, palette)) {
    const dividerHeight = Math.max(1, Math.round(width / 6));
    ctx.fillStyle = palette.divider;
    ctx.fillRect(x, y + height - filledHeight, width, dividerHeight);
  }
}

/**
 * @param {object} opts
 * @param {number} opts.numerator 0-100 (5-hour utilization)
 * @param {number} opts.denominator 0-100 (7-day utilization)
 * @param {number} opts.size 16 or 32 (px, square)
 * @param {boolean} opts.isDark
 * @returns {Buffer} PNG
 */
function renderColumnsIcon({ numerator, denominator, size, isDark }) {
  const palette = getPalette(isDark);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  const cell = size / 16;
  const marginY = 1 * cell;
  const colHeight = size - marginY * 2;
  const colWidth = 6 * cell;
  const leftColX = 1 * cell;
  const rightColX = 9 * cell;

  drawColumn(ctx, leftColX, marginY, colWidth, colHeight, numerator, palette.trackFiveHour, palette);
  drawColumn(ctx, rightColX, marginY, colWidth, colHeight, denominator, palette.trackSevenDay, palette);

  return canvas.toBuffer('image/png');
}

// Larger, anti-aliased rounded-rect renders used only by the popup - the tray icon above stays pixel-snapped for crispness at 16px.

const SUBTLE_RADIUS = 0;

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function castRoundedShadow(ctx, x, y, width, height, radius) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 3;
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  // Only needed to cast the shadow - clear it so the real colors show through.
  ctx.clearRect(x, y, width, height);
}

function drawRoundedBar(ctx, x, y, width, height, percent, trackColor, palette) {
  const clamped = clampPercent(percent);
  const filledWidth = Math.round((width * clamped) / 100);
  const fillColor = fillColorFor(clamped, palette);
  const radius = SUBTLE_RADIUS;

  castRoundedShadow(ctx, x, y, width, height, radius);

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, width, height);
  if (filledWidth > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, filledWidth, height);
  }
  // Top-to-bottom gloss, strong enough to read against a saturated fill color too.
  const gloss = ctx.createLinearGradient(x, y, x, y + height);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  gloss.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  if (filledWidth > 0 && filledWidth < width && needsDivider(fillColor, palette)) {
    ctx.fillStyle = palette.divider;
    ctx.fillRect(x + filledWidth - 1, y, 2, height);
  }
}

function drawRoundedColumn(ctx, x, y, width, height, percent, trackColor, palette) {
  const clamped = clampPercent(percent);
  const filledHeight = Math.round((height * clamped) / 100);
  const fillColor = fillColorFor(clamped, palette);
  const radius = SUBTLE_RADIUS;

  castRoundedShadow(ctx, x, y, width, height, radius);

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, width, height);
  if (filledHeight > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y + height - filledHeight, width, filledHeight);
  }
  // Left-to-right gloss, matching the vertical pill's rounded cross-section.
  const gloss = ctx.createLinearGradient(x, y, x + width, y);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  gloss.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  if (filledHeight > 0 && filledHeight < height && needsDivider(fillColor, palette)) {
    ctx.fillStyle = palette.divider;
    ctx.fillRect(x, y + height - filledHeight - 1, width, 2);
  }
}

// Single-bar/column previews, one image per stat. Margin is generous so the
// drop shadow has room to fade before the canvas edge, instead of getting
// hard-clipped into a visible rectangle.
const PREVIEW_BAR_WIDTH = 340;
const PREVIEW_BAR_HEIGHT = 120;
const PREVIEW_BAR_PILL_HEIGHT = 72;
const PREVIEW_BAR_MARGIN_X = 24;

function renderBarPreview({ percent, variant, isDark }) {
  const palette = getPalette(isDark);
  const trackColor = variant === 'seven-day' ? palette.trackSevenDay : palette.trackFiveHour;
  const canvas = createCanvas(PREVIEW_BAR_WIDTH, PREVIEW_BAR_HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, PREVIEW_BAR_WIDTH, PREVIEW_BAR_HEIGHT);

  const y = (PREVIEW_BAR_HEIGHT - PREVIEW_BAR_PILL_HEIGHT) / 2;
  const width = PREVIEW_BAR_WIDTH - PREVIEW_BAR_MARGIN_X * 2;
  drawRoundedBar(ctx, PREVIEW_BAR_MARGIN_X, y, width, PREVIEW_BAR_PILL_HEIGHT, percent, trackColor, palette);

  return canvas.toBuffer('image/png');
}

const PREVIEW_COLUMN_WIDTH = 120;
const PREVIEW_COLUMN_HEIGHT = 340;
const PREVIEW_COLUMN_PILL_WIDTH = 72;
const PREVIEW_COLUMN_MARGIN_Y = 24;

function renderColumnPreview({ percent, variant, isDark }) {
  const palette = getPalette(isDark);
  const trackColor = variant === 'seven-day' ? palette.trackSevenDay : palette.trackFiveHour;
  const canvas = createCanvas(PREVIEW_COLUMN_WIDTH, PREVIEW_COLUMN_HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, PREVIEW_COLUMN_WIDTH, PREVIEW_COLUMN_HEIGHT);

  const x = (PREVIEW_COLUMN_WIDTH - PREVIEW_COLUMN_PILL_WIDTH) / 2;
  const height = PREVIEW_COLUMN_HEIGHT - PREVIEW_COLUMN_MARGIN_Y * 2;
  drawRoundedColumn(ctx, x, PREVIEW_COLUMN_MARGIN_Y, PREVIEW_COLUMN_PILL_WIDTH, height, percent, trackColor, palette);

  return canvas.toBuffer('image/png');
}

const STATUS_PATTERNS = {
  'missing-credentials': ['111', '001', '011', '000', '010'],
  'auth-error': ['010', '010', '010', '000', '010'],
  loading: ['000', '000', '000', '000', '101'],
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
  renderColumnsIcon,
  renderBarPreview,
  renderColumnPreview,
  PREVIEW_BAR_WIDTH,
  PREVIEW_BAR_HEIGHT,
  PREVIEW_COLUMN_WIDTH,
  PREVIEW_COLUMN_HEIGHT,
  renderStatusIcon,
};
