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
  // Fill/track boundary divider in the tray icon bars - softer dark gray
  // rather than near-black `foreground`, which read as too harsh/heavy a
  // line for what's meant to be a subtle boundary marker.
  divider: '#555555',
  // Track (unfilled) tint per bar, so the two fill bars stay visually
  // distinct from each other even at 0% - blue for the 5-hour window,
  // purple for the 7-day one. Independent of the fill-level colors below.
  //
  // Deliberately pale/desaturated (not vivid) - the fill colors below are
  // vivid and saturated by design (per feedback that the first two attempts
  // read as too dull/muddy), so track just needs to stay light enough to
  // sit clearly between white and any fill color's luminance, whatever hue
  // the fill happens to be. A vivid track color competing with a vivid fill
  // color was the earlier failure mode (computed luminance came out within
  // ~1 of 255 apart for track vs. amber - i.e. they read as the same
  // color); a pale, low-saturation track sidesteps that regardless of how
  // bright the fill is. render.js also draws a thin separator line at the
  // fill/track boundary as a second, color-independent guarantee.
  // Lighter/more transparent than the previous attempt - once the fill
  // colors became vivid, the track only needs to be present as a subtle
  // backdrop, not compete for attention.
  trackFiveHour: 'rgba(120, 160, 210, 0.3)',
  trackSevenDay: 'rgba(195, 165, 220, 0.3)',
  // Fill color scales with how close to the limit it is - the same
  // traffic-light meaning for both bars, layered on top of the track tint.
  // Vivid and bright by design (bright green / gold-amber / flame red) -
  // muted "safe" tones read as dull and the amber in particular was nearly
  // invisible. Kept dark/saturated enough to still clear the pale track's
  // luminance above.
  fillGood: '#22c55e',
  fillWarn: '#f59e0b',
  fillDanger: '#ff3b30',
};

const DARK = {
  foreground: '#f0f0f0',
  separator: 'rgba(240, 240, 240, 0.6)',
  errorForeground: '#ff8a80',
  // Unchanged from `foreground` - no complaint about this one being too
  // harsh (it's already an off-white, not stark white).
  divider: '#f0f0f0',
  trackFiveHour: 'rgba(100, 165, 255, 0.35)',
  trackSevenDay: 'rgba(200, 155, 255, 0.35)',
  fillGood: '#4ade80',
  fillWarn: '#fbbf24',
  fillDanger: '#ff5a4e',
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
