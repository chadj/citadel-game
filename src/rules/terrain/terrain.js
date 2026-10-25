// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The altitude and type of any point of the map (spec 02, Terrain;
// decision D23).
//
// Each tile has a level. A raised level's tiles are flat on top, and
// its slope lies just outside them: it runs down across the lower
// neighbor, about 40 px wide measured straight across. Distance to the
// raised tiles is measured as the larger of the east-west and
// north-south gaps, so a slope crossed at a corner is wider, as the
// spec says. A narrow shore slope at altitude 0 runs along Ground next
// to water. Water tiles are water all over.

import {
  TILE, WATER, PLATEAU, MOUNTAIN, FLAT, SLOPE, WET,
  SLOPE_WIDTH, SHORE_WIDTH, BUMP_CELL, BUMP_HEIGHT, ONE,
} from '../constants.js';
import { wrap } from '../math/wrap.js';

// The index of the tile holding (x, y): y * tiles + x.
export function tileIndex(map, x, y) {
  const tx = Math.floor(wrap(x, map.size) / TILE);
  const ty = Math.floor(wrap(y, map.size) / TILE);
  return ty * map.tiles + tx;
}

// The center of a tile, in position units.
export function tileCenter(map, index) {
  const tx = index % map.tiles;
  const ty = (index - tx) / map.tiles;
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// The terrain at (x, y), in position units. `pontoons` optionally maps
// a tile index (y * tiles + x) to a Pontoon's top altitude: the whole
// tile is then flat ground at that altitude (spec 02, Pontoons;
// decision D4).
//
// Returns { alt, type }, where type is FLAT, SLOPE or WET.
export function sampleTerrain(map, x, y, pontoons) {
  const n = map.tiles;
  const levels = map.levels;
  x = wrap(x, map.size);
  y = wrap(y, map.size);
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const fx = x - tx * TILE;
  const fy = y - ty * TILE;
  const index = ty * n + tx;

  if (pontoons) {
    const top = pontoons.get(index);
    if (top !== undefined) return { alt: top, type: FLAT };
  }
  const own = levels[index];
  if (own === WATER) return { alt: 0, type: WET };

  // The nearest tile at or above each level, among the eight neighbors.
  let toWater = Infinity;
  let toPlateau = own >= PLATEAU ? 0 : Infinity;
  let toMountain = own >= MOUNTAIN ? 0 : Infinity;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      if (di === 0 && dj === 0) continue;
      const level = levels[((ty + dj + n) % n) * n + ((tx + di + n) % n)];
      const gx = di < 0 ? fx : di > 0 ? TILE - fx : 0;
      const gy = dj < 0 ? fy : dj > 0 ? TILE - fy : 0;
      const d = Math.max(gx, gy);
      if (level === WATER && d < toWater) toWater = d;
      if (level >= PLATEAU && d < toPlateau) toPlateau = d;
      if (level >= MOUNTAIN && d < toMountain) toMountain = d;
    }
  }

  let alt = 0;
  let type = FLAT;
  let taper = 0; // how far into a slope's middle the point is, for the bumps
  const ramp = (d, height) => {
    if (d >= SLOPE_WIDTH) return;
    alt += Math.round((height * (SLOPE_WIDTH - d)) / SLOPE_WIDTH);
    if (d > 0) {
      type = SLOPE;
      const t = Math.floor((d * ONE) / SLOPE_WIDTH);
      taper = Math.max(taper, Math.floor((4 * t * (ONE - t)) / ONE));
    }
  };
  ramp(toPlateau, map.plateauHeight);
  ramp(toMountain, map.mountainHeight - map.plateauHeight);
  if (toWater < SHORE_WIDTH) type = SLOPE;

  // The climb is rocky, with small bumps (spec 02, Slopes).
  if (taper > 0) alt += Math.round((bumps(map, x, y) * taper) / ONE);
  return { alt, type };
}

// Smooth noise in [-BUMP_HEIGHT, BUMP_HEIGHT], from values at the
// corners of a BUMP_CELL grid. The grid divides the map evenly, so the
// noise wraps with it.
function bumps(map, x, y) {
  const cells = map.size / BUMP_CELL;
  const gx = Math.floor(x / BUMP_CELL);
  const gy = Math.floor(y / BUMP_CELL);
  const ux = x - gx * BUMP_CELL;
  const uy = y - gy * BUMP_CELL;
  const vx = BUMP_CELL - ux;
  const vy = BUMP_CELL - uy;
  const gx1 = (gx + 1) % cells;
  const gy1 = (gy + 1) % cells;
  const sum =
    corner(gx, gy) * vx * vy +
    corner(gx1, gy) * ux * vy +
    corner(gx, gy1) * vx * uy +
    corner(gx1, gy1) * ux * uy;
  return Math.round(sum / (BUMP_CELL * BUMP_CELL));
}

function corner(gx, gy) {
  let h = Math.imul(gx, 0x27d4eb2d) ^ Math.imul(gy + 0x9e3779b9, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % (2 * BUMP_HEIGHT + 1)) - BUMP_HEIGHT;
}
