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
  // line for what's meant to be a subtle boundary marker. Partial opacity
  // so it stays proportional to the now near-invisible track below - a
  // solid line would otherwise be the most prominent thing in the empty
  // part of the bar, backwards from the point of making track subtle.
  divider: 'rgba(85, 85, 85, 0.5)',
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
  // Pushed to near-invisible per feedback that the track still read as a
  // colored "fill" over the taskbar instead of a barely-there boundary
  // marker - now it's just enough tint to tell the two bars apart up
  // close, not a competing block of color at a glance.
  trackFiveHour: 'rgba(120, 160, 210, 0.12)',
  trackSevenDay: 'rgba(195, 165, 220, 0.12)',
  // Fill color scales with how close to the limit it is - the same
  // traffic-light meaning for both bars, layered on top of the track tint.
  // User-picked palette (pure, high-saturation primaries) after two earlier
  // rounds still read as pastel/muddy - checked against a real Windows 11
  // light taskbar (#F2F2F2): green and red both have very high contrast,
  // yellow is the one that stays close to the pale track's luminance (both
  // are light), same recurring risk as every previous amber attempt - the
  // divider tick in drawBar/drawColumn is the safety net for that case.
  fillGood: '#00c800',
  fillWarn: '#ffc800',
  fillDanger: '#e00000',
};

const DARK = {
  foreground: '#f0f0f0',
  separator: 'rgba(240, 240, 240, 0.6)',
  errorForeground: '#ff8a80',
  // Same partial-opacity reasoning as the light theme's divider above.
  divider: 'rgba(240, 240, 240, 0.5)',
  trackFiveHour: 'rgba(100, 165, 255, 0.08)',
  trackSevenDay: 'rgba(200, 155, 255, 0.08)',
  // Green/yellow unchanged from light theme - both already have strong
  // contrast against a near-black taskbar. Red alone is brightened: pure
  // #E00000 has low luminance and reads as muddy/near-invisible against a
  // dark background specifically.
  fillGood: '#00c800',
  fillWarn: '#ffc800',
  fillDanger: '#ff3b30',
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
