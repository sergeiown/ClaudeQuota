/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Generates PNG previews of the tray icon in every state worth eyeballing
// before it's buried inside Electron's Tray/nativeImage machinery. Run:
//
//   node scripts/preview-icon.js
//
// Writes PNGs into the OS temp dir and prints the folder path.

const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderFractionIcon, renderStatusIcon } = require('../src/icon/render');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudequota-icon-preview-'));

const cases = [
  { name: '00-00', numerator: 0, denominator: 0 },
  { name: '10-20', numerator: 10, denominator: 20 },
  { name: '42-87', numerator: 42, denominator: 87 },
  { name: '99-100', numerator: 99, denominator: 100 },
  { name: '05-08', numerator: 5, denominator: 8 },
];

for (const size of [16, 32]) {
  for (const isDark of [false, true]) {
    const themeLabel = isDark ? 'dark' : 'light';
    for (const c of cases) {
      const buf = renderFractionIcon({
        numerator: c.numerator,
        denominator: c.denominator,
        size,
        isDark,
      });
      const file = path.join(outDir, `${size}px-${themeLabel}-${c.name}.png`);
      fs.writeFileSync(file, buf);
    }
  }

  for (const isDark of [false, true]) {
    const themeLabel = isDark ? 'dark' : 'light';
    for (const kind of ['missing-credentials', 'auth-error', 'loading']) {
      const buf = renderStatusIcon({ kind, size, isDark });
      const file = path.join(outDir, `${size}px-${themeLabel}-status-${kind}.png`);
      fs.writeFileSync(file, buf);
    }
  }
}

console.log('Icon previews written to:', outDir);
