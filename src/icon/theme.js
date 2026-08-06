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
  trackFiveHour: 'rgba(64, 128, 224, 0.45)',
  trackSevenDay: 'rgba(158, 92, 224, 0.45)',
  // Fill color scales with how close to the limit it is - the same
  // traffic-light meaning for both bars, layered on top of the track tint.
  fillGood: '#2e9e44',
  fillWarn: '#d99a1f',
  fillDanger: '#d13a3a',
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
