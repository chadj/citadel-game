// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The terrain as a picture (spec 02, What players see, Landforms; spec
// 01, The view). Each point of the ground is drawn up the screen by half
// its altitude, like everything else, so units sit on it where they
// stand. Higher ground hides what's just north of it. Slopes are lit
// from the north-west, and the rocky bumps show as texture.
//
// Variety (spec 02, Landforms; decision D55): each level's plain surface,
// and open water, comes in three looks, blended by smooth noise whose
// cells don't line up with the tiles, so the grid doesn't show. Painted
// craters come with the map and are drawn into the ground.
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

// A hash of whole numbers to [0, 1).
function hash(x, y, seed) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y + seed, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// Smooth noise in [0, 1) over the map, `cell` pixels to a cell. The
// cells divide every map size evenly, so it wraps with the map.
function smoothNoise(sizePx, n, step, cell, seed) {
  const cells = Math.round(sizePx / cell);
  const lattice = new Float32Array(cells * cells);
  for (let k = 0; k < lattice.length; k++) lattice[k] = hash(k % cells, Math.floor(k / cells), seed);
  const v = (gx, gy) => lattice[gy * cells + gx];
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const fy = (y * step * cells) / sizePx;
    const gy = Math.floor(fy);
    const ty = fy - gy;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < n; x++) {
      const fx = (x * step * cells) / sizePx;
      const gx = Math.floor(fx);
      const tx = fx - gx;
      const sx = tx * tx * (3 - 2 * tx);
      const x1 = (gx + 1) % cells;
      const y1 = (gy + 1) % cells;
      const top = v(gx, gy) + (v(x1, gy) - v(gx, gy)) * sx;
      const bottom = v(gx, y1) + (v(x1, y1) - v(gx, y1)) * sx;
      out[y * n + x] = top + (bottom - top) * sy;
    }
  }
  return out;
}

// Painted craters as shading: below 0 darkens, above 0 lightens. A bowl,
// shadowed toward the north-west where the light comes from, with a
// lighter rim.
function craterShading(map, n, step) {
  const shade = new Float32Array(n * n);
  for (const c of map.craters ?? []) {
    const r = c.r / step;
    const cx = c.x / step;
    const cy = c.y / step;
    const reach = Math.ceil(r * 1.15);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy) / r;
        if (d > 1.15) continue;
        let s;
        if (d < 0.85) {
          // The floor: darker toward the middle, and on the north-west
          // side of the bowl, which faces away from the light.
          const facing = -(dx + dy) / (Math.SQRT2 * r);
          s = -0.12 - 0.1 * (1 - d) - 0.12 * Math.max(0, -facing);
        } else {
          // The rim, fading out beyond the edge.
          s = 0.08 * (1 - Math.abs(d - 1) / 0.15);
        }
        const x = (((Math.round(cx) + dx) % n) + n) % n;
        const y = (((Math.round(cy) + dy) % n) + n) % n;
        shade[y * n + x] += s;
      }
    }
  }
  return shade;
}

// The three looks of each surface: the color itself, one darker and
// warmer with grain, and one lighter with streaks.
function looks(c) {
  return [c, [c[0] * 0.95 + 3, c[1] * 0.94 + 1, c[2] * 0.92], [c[0] * 1.02 + 5, c[1] * 1.02 + 5, c[2] * 1.02 + 4]];
}

// The picture: RGBA, (size / step) pixels square, each point lifted by
// half its altitude.
export function terrainPixels(map, step = 1) {
  const grid = sampleGrid(map, step);
  const { n, alt, wet } = grid;
  const sizePx = map.size / PX;
  const colors = PLANET_COLORS[map.planet] ?? PLANET_COLORS.tundra;
  const levels = colors.levels.map(rgb);
  const levelLooks = levels.map(looks);
  const waterDeep = rgb(colors.water[0]);
  const waterShallow = rgb(colors.water[1]);
  const waterLooks = looks(waterDeep);
  const plateau = map.plateauHeight / PX;
  const mountain = map.mountainHeight / PX;
  // Which look shows where: broad patches and smaller ones.
  const broad = smoothNoise(sizePx, n, step, 120, 11);
  const patch = smoothNoise(sizePx, n, step, 48, 23);
  const streak = smoothNoise(sizePx, n, step, 24, 37);
  const craters = craterShading(map, n, step);

  const at = (x, y) => ((y + n) % n) * n + ((x + n) % n);
  const color = new Float32Array(n * n * 3);
  const c = [0, 0, 0];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const w1 = Math.max(0, Math.min(1, (broad[i] - 0.3) * 2));
      const w2 = Math.max(0, Math.min(1, (patch[i] - 0.4) * 2));
      const grain = (hash(x, y, 5) - 0.5) * 0.05;
      let pick;
      if (wet[i]) {
        // Shallower near the shore.
        let shore = 0;
        if (!wet[at(x + 3, y)] || !wet[at(x - 3, y)] || !wet[at(x, y + 3)] || !wet[at(x, y - 3)]) shore = 1;
        pick = waterLooks;
        blend(c, pick, w1, w2 * 0.6, 0);
        const t = shore * 0.6 + ((x * 7 + y * 13) % 17) / 170;
        for (let k = 0; k < 3; k++) c[k] += (waterShallow[k] - c[k]) * t;
      } else {
        const a = alt[i];
        // The level's own looks, and between levels a blend of the two.
        if (a <= plateau) {
          const t = Math.max(0, a) / plateau;
          blendLevels(c, levelLooks[0], levelLooks[1], t, w1, w2, streak[i], grain);
        } else {
          const t = Math.min(1, (a - plateau) / (mountain - plateau));
          blendLevels(c, levelLooks[1], levelLooks[2], t, w1, w2, streak[i], grain);
        }
        // Light from the north-west: brighter where the ground rises
        // toward it.
        const light = Math.max(-0.35, Math.min(0.35, (alt[at(x + 1, y + 1)] - alt[at(x - 1, y - 1)]) * 0.09)) + craters[i];
        if (light >= 0) for (let k = 0; k < 3; k++) c[k] += (255 - c[k]) * light;
        else for (let k = 0; k < 3; k++) c[k] *= 1 + light;
      }
      color[i * 3] = c[0];
      color[i * 3 + 1] = c[1];
      color[i * 3 + 2] = c[2];
    }
  }

  // Each screen row shows the furthest-south point drawn at or above it:
  // the one nearest the viewer. So each column is painted from north to
  // south, each point over the rows from its lifted top down to itself.
  // Points lifted past the top of the map wrap round to the bottom, and
  // are painted last: they're further south than anything there.
  const out = new Uint8ClampedArray(n * n * 4);
  const paint = (x, y, from, to) => {
    const s = (y * n + x) * 3;
    for (let sy = from; sy <= to; sy++) {
      const o = (sy * n + x) * 4;
      out[o] = color[s];
      out[o + 1] = color[s + 1];
      out[o + 2] = color[s + 2];
      out[o + 3] = 255;
    }
  };
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const top = Math.ceil(y - (Math.max(0, alt[y * n + x]) * LIFT) / step - 0.5);
      paint(x, y, Math.max(0, top), y);
    }
    for (let y = 0; y < n; y++) {
      const top = Math.ceil(y - (Math.max(0, alt[y * n + x]) * LIFT) / step - 0.5);
      if (top < 0) paint(x, y, top + n, n - 1);
    }
  }
  return { width: n, height: n, data: out };
}

// A surface's color from its three looks: w1 brings in the second, w2
// the third.
function blend(c, l, w1, w2, grain) {
  for (let k = 0; k < 3; k++) {
    const v = l[0][k] + (l[1][k] - l[0][k]) * w1;
    c[k] = (v + (l[2][k] - v) * w2) * (1 + grain);
  }
}

// Between two levels, by how far up the slope a point is. The second
// look's grain and the third's streaks show only on that look.
function blendLevels(c, low, high, t, w1, w2, streak, grain) {
  const s = (streak - 0.5) * 0.08 * w2;
  for (let k = 0; k < 3; k++) {
    const a = low[0][k] + (low[1][k] - low[0][k]) * w1;
    const lo = a + (low[2][k] - a) * w2;
    const b = high[0][k] + (high[1][k] - high[0][k]) * w1;
    const hi = b + (high[2][k] - b) * w2;
    c[k] = (lo + (hi - lo) * t) * (1 + grain * w1 + s);
  }
}
