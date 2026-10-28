// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Draws the game's home-screen icons (decision D60) and writes them as
// PNGs to assets/icons:
//   node tools/make-icons.js
// A Citadel's dome and spire on a moon's horizon, under a night sky.
// Everything sits inside the middle 80% circle, so phones that cut the
// icon to a circle or rounded square (a "maskable" icon) keep all of it.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT = resolve(import.meta.dirname, '..', 'assets', 'icons');
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };
const SAMPLES = 4;

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const SKY_TOP = hex(0x0b0f14);
const SKY_LOW = hex(0x1a2430);
const GROUND = hex(0x5b6672);
const GROUND_LIT = hex(0x8a96a2);
const DOME = hex(0x3d6f9e);
const DOME_LIT = hex(0x6b9ccb);
const SPIRE = hex(0xc7d1db);
const BEACON = hex(0xffb347);
const STAR = hex(0xe6edf3);
const STARS = [[0.24, 0.22], [0.71, 0.18], [0.82, 0.38], [0.33, 0.4], [0.6, 0.3], [0.17, 0.52]];

// The colour at a point of the icon, x and y from 0 to 1.
function colour(x, y) {
  const horizon = Math.hypot(x - 0.5, y - 1.5) - 0.78;
  if (horizon < 0) return mix(GROUND, GROUND_LIT, Math.max(0, 1 + horizon / 0.06));
  // The dome's base runs down into the curve of the ground.
  const dome = y < 0.72 ? Math.hypot(x - 0.5, y - 0.72) - 0.17 : Math.abs(x - 0.5) - 0.17;
  if (dome < 0) return mix(DOME, DOME_LIT, Math.max(0, (0.5 - x) * 3 + (0.72 - y) * 2));
  if (Math.hypot(x - 0.5, y - 0.41) < 0.028) return BEACON;
  if (Math.abs(x - 0.5) < 0.014 && y > 0.41 && y < 0.56) return SPIRE;
  for (const [sx, sy] of STARS) if (Math.hypot(x - sx, y - sy) < 0.009) return STAR;
  return mix(SKY_TOP, SKY_LOW, y);
}

function draw(size) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let j = 0; j < SAMPLES; j++) {
        for (let i = 0; i < SAMPLES; i++) {
          const c = colour((px + (i + 0.5) / SAMPLES) / size, (py + (j + 0.5) / SAMPLES) / size);
          for (let k = 0; k < 3; k++) sum[k] += c[k];
        }
      }
      for (let k = 0; k < 3; k++) row[1 + px * 4 + k] = Math.round(sum[k] / SAMPLES ** 2);
      row[1 + px * 4 + 3] = 255;
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
// Rows of RGBA, each led by filter byte 0, as a PNG file.
function png(size, rows) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8;
  head[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, size] of Object.entries(SIZES)) {
  writeFileSync(join(OUT, name), draw(size));
  console.log(`wrote assets/icons/${name}`);
}
