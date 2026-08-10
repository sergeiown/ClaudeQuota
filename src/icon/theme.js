/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Windows has no template-image auto-recoloring - the icon is re-rasterized
// by hand on every theme change using one of these palettes.

const LIGHT = {
  foreground: '#1a1a1a',
  separator: 'rgba(26, 26, 26, 0.6)',
  errorForeground: '#b3261e',
  divider: 'rgba(85, 85, 85, 0.5)',
  outline: 'rgba(85, 85, 85, 0.5)',
  trackFiveHour: 'rgba(120, 160, 210, 0.12)',
  trackSevenDay: 'rgba(195, 165, 220, 0.12)',
  fillGood: '#00c800',
  fillWarn: '#ffc800',
  fillDanger: '#e00000',
};

const DARK = {
  foreground: '#f0f0f0',
  separator: 'rgba(240, 240, 240, 0.6)',
  errorForeground: '#ff8a80',
  divider: 'rgba(240, 240, 240, 0.5)',
  outline: 'rgba(240, 240, 240, 0.5)',
  trackFiveHour: 'rgba(100, 165, 255, 0.18)',
  trackSevenDay: 'rgba(200, 155, 255, 0.18)',
  fillGood: '#00c800',
  fillWarn: '#ffc800',
  fillDanger: '#ff3b30',
};

function getPalette(isDark) {
  return isDark ? DARK : LIGHT;
}

module.exports = {
  getPalette,
};
