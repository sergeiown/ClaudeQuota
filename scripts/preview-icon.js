/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Generates PNG previews of the tray icon in every state worth eyeballing.
// Run with:
//   node scripts/preview-icon.js

const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderFractionIcon, renderColumnsIcon, renderStatusIcon } = require('../src/icon/render');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudequota-icon-preview-'));

const cases = [
  { name: '00-00', numerator: 0, denominator: 0 },
  { name: '05-08', numerator: 5, denominator: 8 },
  { name: '10-20', numerator: 10, denominator: 20 },
  { name: '45-65', numerator: 45, denominator: 65 },
  { name: '65-95', numerator: 65, denominator: 95 },
  { name: '99-100', numerator: 99, denominator: 100 },
  { name: '100-100', numerator: 100, denominator: 100 },
];

for (const size of [16, 32]) {
  for (const isDark of [false, true]) {
    const themeLabel = isDark ? 'dark' : 'light';
    for (const c of cases) {
      const args = { numerator: c.numerator, denominator: c.denominator, size, isDark };
      fs.writeFileSync(path.join(outDir, `bars-${size}px-${themeLabel}-${c.name}.png`), renderFractionIcon(args));
      fs.writeFileSync(path.join(outDir, `columns-${size}px-${themeLabel}-${c.name}.png`), renderColumnsIcon(args));
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
