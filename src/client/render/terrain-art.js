// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The terrain as a picture (spec 02, What players see; spec 01, The
// view). Each point of the ground is drawn up the screen by half its
// altitude, like everything else, so units sit on it where they stand.
// Higher ground hides what's just north of it. Slopes are lit from the
// north-west, and the rocky bumps show as texture.
//
// Plain JavaScript: returns RGBA pixels, which the screen puts in a
// texture.

import { PX, WET } from '../../rules/constants.js';
import { sampleTerrain } from '../../rules/terrain/terrain.js';
import { LIFT } from '../core/view.js';
import { PLANET_COLORS, rgb } from './palette.js';

// The map's altitude and type at every pixel, `step` pixels apart.
export function sampleGrid(map, step = 1) {
  const n = Math.floor(map.size / PX / step);
  const alt = new Float32Array(n * n);
  const wet = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const t = sampleTerrain(map, x * step * PX, y * step * PX);
      alt[y * n + x] = t.alt / PX;
      wet[y * n + x] = t.type === WET ? 1 : 0;
    }
  }
  return { n, alt, wet, step };
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// The color of one point, before it's lifted.
function groundColor(planet, map, grid, x, y) {
  const { n, alt, wet } = grid;
  const i = y * n + x;
  const colors = PLANET_COLORS[planet] ?? PLANET_COLORS.tundra;
  if (wet[i]) {
    // Shallower near the shore.
    let shore = 0;
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      if (!wet[((y + dy + n) % n) * n + ((x + dx + n) % n)]) shore = 1;
    }
    const ripple = ((x * 7 + y * 13) % 17) / 170;
    return mix(rgb(colors.water[0]), rgb(colors.water[1]), shore * 0.6 + ripple);
  }
  const a = alt[i];
  const plateau = map.plateauHeight / PX;
  const mountain = map.mountainHeight / PX;
  const levels = colors.levels.map(rgb);
  let c;
  if (a <= plateau) c = mix(levels[0], levels[1], Math.max(0, a) / plateau);
  else c = mix(levels[1], levels[2], Math.min(1, (a - plateau) / (mountain - plateau)));
  // Light from the north-west: brighter where the ground rises toward it.
  const nw = alt[((y - 1 + n) % n) * n + ((x - 1 + n) % n)];
  const se = alt[((y + 1) % n) * n + ((x + 1) % n)];
  const light = Math.max(-0.35, Math.min(0.35, (se - nw) * 0.09));
  return light >= 0 ? mix(c, [255, 255, 255], light) : mix(c, [0, 0, 0], -light);
}

// The picture: RGBA, (size / step) pixels square, each point lifted by
// half its altitude.
export function terrainPixels(map, step = 1) {
  const grid = sampleGrid(map, step);
  const { n, alt } = grid;
  const out = new Uint8ClampedArray(n * n * 4);
  const colors = new Float32Array(n * 3);
  const tops = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    let reach = 0;
    for (let y = 0; y < n; y++) {
      const c = groundColor(map.planet, map, grid, x, y);
      colors[y * 3] = c[0];
      colors[y * 3 + 1] = c[1];
      colors[y * 3 + 2] = c[2];
      tops[y] = y - (Math.max(0, alt[y * n + x]) * LIFT) / step;
      reach = Math.max(reach, y - tops[y]);
    }
    const look = Math.ceil(reach) + 1;
    // Each screen row shows the furthest-south point drawn at or above
    // it: the one nearest the viewer.
    for (let sy = 0; sy < n; sy++) {
      let src = sy;
      for (let k = look; k >= 0; k--) {
        const y = sy + k;
        const top = tops[y % n] + (y >= n ? n : 0);
        if (top <= sy + 0.5) {
          src = y % n;
          break;
        }
      }
      const o = (sy * n + x) * 4;
      out[o] = colors[src * 3];
      out[o + 1] = colors[src * 3 + 1];
      out[o + 2] = colors[src * 3 + 2];
      out[o + 3] = 255;
    }
  }
  return { width: n, height: n, data: out };
}
