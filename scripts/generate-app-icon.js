/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

// Generates build/icon.ico from build/icon-source.png. Run with:
//   node scripts/generate-app-icon.js

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const SOURCE_PATH = path.join(__dirname, '..', 'build', 'icon-source.png');
const OUT_PATH = path.join(__dirname, '..', 'build', 'icon.ico');
const SIZES = [16, 32, 48, 256];

function buildIco(entries) {
  const headerSize = 6 + 16 * entries.length;
  let offset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dirEntries = [];
  for (const { size, buffer } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buffer.length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...entries.map((e) => e.buffer)]);
}

(async () => {
  const source = await loadImage(fs.readFileSync(SOURCE_PATH));

  const entries = SIZES.map((size) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, size, size);
    return { size, buffer: canvas.toBuffer('image/png') };
  });

  const ico = buildIco(entries);
  fs.writeFileSync(OUT_PATH, ico);
  console.log('wrote', OUT_PATH, `(${ico.length} bytes)`);
})();
