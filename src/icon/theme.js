/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

/**
 * Tray icon color palettes. Windows has no template-image auto-recoloring
 * (that's macOS-specific) - the icon must be re-rasterized by hand whenever
 * the system theme changes, using one of these palettes.
 *
 * The icon background is always left transparent (never filled) so it
 * reads as a native part of the taskbar rather than a colored square.
 */

const LIGHT = {
  foreground: '#1a1a1a',
  separator: 'rgba(26, 26, 26, 0.6)',
  errorForeground: '#b3261e',
  // Track (unfilled) tint per bar, so the two fill bars stay visually
  // distinct from each other even at 0% - blue for the 5-hour window,
  // purple for the 7-day one. Independent of the fill-level colors below.
  // Higher opacity and deeper hues than the first attempt - the original
  // 0.45 alpha washed out to near-invisible against the near-white
  // Windows 11 light-theme taskbar (real-world feedback, not a guess).
  trackFiveHour: 'rgba(40, 100, 200, 0.85)',
  trackSevenDay: 'rgba(130, 60, 200, 0.85)',
  // Fill color scales with how close to the limit it is - the same
  // traffic-light meaning for both bars, layered on top of the track tint.
  // Darkened from the first attempt for the same light-background contrast
  // reason, especially the amber, which read as too pale/yellow on white.
  fillGood: '#217a37',
  fillWarn: '#a8690a',
  fillDanger: '#b23032',
};

const DARK = {
  foreground: '#f0f0f0',
  separator: 'rgba(240, 240, 240, 0.6)',
  errorForeground: '#ff8a80',
  trackFiveHour: 'rgba(90, 158, 255, 0.5)',
  trackSevenDay: 'rgba(186, 140, 255, 0.5)',
  fillGood: '#4cc366',
  fillWarn: '#f0b429',
  fillDanger: '#ff5c5c',
};

/**
 * @param {boolean} isDark
 */
function getPalette(isDark) {
  return isDark ? DARK : LIGHT;
}

module.exports = {
  getPalette,
};
