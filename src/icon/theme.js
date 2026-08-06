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
};

const DARK = {
  foreground: '#f0f0f0',
  separator: 'rgba(240, 240, 240, 0.6)',
  errorForeground: '#ff8a80',
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
