// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The altitude and type of any point of the map (spec 02, Terrain,
// Landforms; decisions D23, D55).
//
// Each corner, where four tiles meet, sits on one level, and a tile's
// shape follows from its four corners. For each raised level, the top of
// a cliff crosses each tile edge CLIFF_INSET in from its high corner, so
// the high ground in a tile is a flat piece (all four corners high), a
// strip (a straight edge), a small triangle (an outside corner), the tile
// less a corner (an inside corner), or two triangles (a saddle). Every
// piece's sides run along the grid or at 45°, so runs of corners make
// straight 45° cliffs.
//
// The slope runs down from the high ground for SLOPE_WIDTH, measured as
// the true distance from it. So it's the same width whichever way it
// faces, and where pieces meet it turns smoothly, with no step or gap.
// With the inset this small, a slope never reaches a tile that has no
// high corner, which keeps cliffs out of tiles with water.
//
// Water lies in Ground. Lakes come from water corners, blended across
// the tile, so they make straight shores, outside corners and rounded
// points of land. Channels, half a tile wide, run from the middle of the
// tile to the middle of each edge they cross; a tile may hold a small
// round pond. A narrow shore slope at altitude 0 edges all water.
//
// Everything is whole numbers, the same on every machine.

import {
  TILE, WATER, PLATEAU, MOUNTAIN, FLAT, SLOPE, WET,
  SLOPE_WIDTH, CLIFF_INSET, SHORE_WIDTH, CHANNEL_HALF, POND_RADIUS, LAKE_BIAS,
  BUMP_CELL, BUMP_HEIGHT, ONE,
} from '../constants.js';
import { isqrt } from '../math/fixed.js';
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

// A tile's corners, as a 4-bit case: north-west 1, north-east 2,
// south-east 4, south-west 8. `test(level)` says which count.
export const NW = 1;
export const NE = 2;
export const SE = 4;
export const SW = 8;

export function cornerCase(corners, n, tx, ty, test) {
  const x1 = (tx + 1) % n;
  const y1 = (ty + 1) % n;
  return (test(corners[ty * n + tx]) ? NW : 0)
    | (test(corners[ty * n + x1]) ? NE : 0)
    | (test(corners[y1 * n + x1]) ? SE : 0)
    | (test(corners[y1 * n + tx]) ? SW : 0);
}

// The high ground in a tile for each corner case: convex polygons in the
// tile's own coordinates, each side along the grid or at 45°.
const PIECES = (() => {
  const T = TILE;
  const a = CLIFF_INSET;
  const corner = [[0, 0], [T, 0], [T, T], [0, T]]; // NW, NE, SE, SW: clockwise
  const bit = [NW, NE, SE, SW];
  // The point `d` along the edge from corner i to corner j.
  const along = (i, j, d) => [
    corner[i][0] + Math.sign(corner[j][0] - corner[i][0]) * d,
    corner[i][1] + Math.sign(corner[j][1] - corner[i][1]) * d,
  ];
  const out = [];
  for (let c = 0; c < 16; c++) {
    const high = (i) => (c & bit[i]) !== 0;
    if (c === (NW | SE) || c === (NE | SW)) {
      // A saddle: two cliffs pass each other, each around its corner.
      const polys = [];
      for (let i = 0; i < 4; i++) {
        if (!high(i)) continue;
        polys.push([corner[i], along(i, (i + 1) % 4, a), along(i, (i + 3) % 4, a)]);
      }
      out.push(polys.map(piece));
      continue;
    }
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      if (high(i)) pts.push(corner[i]);
      if (high(i) && !high(j)) pts.push(along(i, j, a));
      if (!high(i) && high(j)) pts.push(along(j, i, a));
    }
    out.push(pts.length > 0 ? [piece(pts)] : []);
  }
  return out;
})();

// A polygon with its bounding box and sides.
function piece(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    pts,
    x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys),
    sides: pts.map((p, k) => {
      const q = pts[(k + 1) % pts.length];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      return { ax: p[0], ay: p[1], sx: Math.sign(dx), sy: Math.sign(dy), len: Math.max(Math.abs(dx), Math.abs(dy)) };
    }),
  };
}

export const piecesFor = (c) => PIECES[c];

// Four times the squared distance from (px, py) to a side, exactly. A
// side runs along the grid or at 45°.
function sideDist4(px, py, s) {
  const rx = px - s.ax;
  const ry = py - s.ay;
  if (s.sx === 0 || s.sy === 0) {
    const k = Math.max(0, Math.min(s.len, rx * s.sx + ry * s.sy));
    const dx = rx - k * s.sx;
    const dy = ry - k * s.sy;
    return 4 * (dx * dx + dy * dy);
  }
  // At 45°: the nearest point is k2 / 2 steps along.
  const k2 = Math.max(0, Math.min(2 * s.len, rx * s.sx + ry * s.sy));
  const dx = 2 * rx - k2 * s.sx;
  const dy = 2 * ry - k2 * s.sy;
  return dx * dx + dy * dy;
}

// Whether (px, py) is inside a convex polygon (on its edge counts).
function inside(px, py, poly) {
  let pos = false;
  let neg = false;
  for (const s of poly.sides) {
    const cross = s.sx * (py - s.ay) - s.sy * (px - s.ax);
    if (cross > 0) pos = true;
    else if (cross < 0) neg = true;
    if (pos && neg) return false;
  }
  return true;
}

// The distance from a point of tile (tx, ty), at (fx, fy) within it, to
// the high ground of one layer, or SLOPE_WIDTH if it's at least that far.
// A tile with no high corner is clear of every slope: its neighbors' high
// ground starts at their far corners, at least TILE - CLIFF_INSET away,
// which is more than SLOPE_WIDTH.
function layerDist(map, cases, tx, ty, fx, fy) {
  const n = map.tiles;
  const own = cases[ty * n + tx];
  if (own === 0) return SLOPE_WIDTH;
  if (own === 15) return 0;
  let best4 = 4 * SLOPE_WIDTH * SLOPE_WIDTH;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const c = cases[((ty + dj + n) % n) * n + ((tx + di + n) % n)];
      if (c === 0) continue;
      // The point in that tile's own coordinates.
      const px = fx - di * TILE;
      const py = fy - dj * TILE;
      for (const poly of PIECES[c]) {
        const gx = Math.max(0, poly.x0 - px, px - poly.x1);
        const gy = Math.max(0, poly.y0 - py, py - poly.y1);
        if (gx >= SLOPE_WIDTH || gy >= SLOPE_WIDTH) continue;
        if (inside(px, py, poly)) return 0;
        for (const s of poly.sides) best4 = Math.min(best4, sideDist4(px, py, s));
      }
    }
  }
  return Math.min(SLOPE_WIDTH, Math.floor(isqrt(best4) / 2));
}

const sq = (v) => v * v;

// How far into water a point of a tile is, in position units: above 0
// is water, and down to -SHORE_WIDTH is shore. Only the tile's own
// corners and marks count: water and its shore never leave their tile.
function waterDepth(map, index, fx, fy) {
  const T = TILE;
  const h = T / 2;
  let s = -Infinity;
  const lake = map.lakeCases[index];
  if (lake !== 0) {
    // The water corners, blended across the tile.
    const u = fx;
    const v = fy;
    const num = ((lake & NW) ? (T - u) * (T - v) : 0) + ((lake & NE) ? u * (T - v) : 0)
      + ((lake & SE) ? u * v : 0) + ((lake & SW) ? (T - u) * v : 0);
    s = Math.floor(num / T) - h + LAKE_BIAS;
  }
  const arms = map.arms[index];
  if (arms !== 0) {
    // Arms from the middle of the tile to the middle of each edge
    // crossed: north 1, east 2, south 4, west 8.
    let d2 = Infinity;
    if (arms & 1) d2 = Math.min(d2, sq(fx - h) + sq(Math.max(0, fy - h)));
    if (arms & 2) d2 = Math.min(d2, sq(fy - h) + sq(Math.max(0, h - fx)));
    if (arms & 4) d2 = Math.min(d2, sq(fx - h) + sq(Math.max(0, h - fy)));
    if (arms & 8) d2 = Math.min(d2, sq(fy - h) + sq(Math.max(0, fx - h)));
    s = Math.max(s, CHANNEL_HALF - isqrt(d2));
  }
  if (map.ponds[index]) s = Math.max(s, POND_RADIUS - isqrt(sq(fx - h) + sq(fy - h)));
  return s;
}

// The terrain at (x, y), in position units. `pontoons` optionally maps
// a tile index (y * tiles + x) to a Pontoon's top altitude: the whole
// tile is then flat ground at that altitude (spec 02, Pontoons;
// decision D4).
//
// Returns { alt, type }, where type is FLAT, SLOPE or WET.
export function sampleTerrain(map, x, y, pontoons) {
  const n = map.tiles;
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
  // A tile with water has no cliff (spec 02, Landforms).
  if (map.wet[index]) {
    const s = waterDepth(map, index, fx, fy);
    if (s > 0) return { alt: 0, type: WET };
    return { alt: 0, type: s > -SHORE_WIDTH ? SLOPE : FLAT };
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
  ramp(layerDist(map, map.plateauCases, tx, ty, fx, fy), map.plateauHeight);
  ramp(layerDist(map, map.mountainCases, tx, ty, fx, fy), map.mountainHeight - map.plateauHeight);

  // The climb is rocky, with small bumps (spec 02, Slopes).
  if (taper > 0) alt += Math.round((bumps(map, x, y) * taper) / ONE);
  return { alt, type };
}

// The per-tile tables the terrain needs, from corner levels and water
// marks: each layer's corner cases, and each tile's water.
export function terrainTables(n, corners, north, west, pond) {
  const plateauCases = new Uint8Array(n * n);
  const mountainCases = new Uint8Array(n * n);
  const lakeCases = new Uint8Array(n * n);
  const arms = new Uint8Array(n * n);
  const ponds = new Uint8Array(n * n);
  const wet = new Uint8Array(n * n);
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const i = ty * n + tx;
      plateauCases[i] = cornerCase(corners, n, tx, ty, (l) => l >= PLATEAU);
      mountainCases[i] = cornerCase(corners, n, tx, ty, (l) => l >= MOUNTAIN);
      lakeCases[i] = cornerCase(corners, n, tx, ty, (l) => l === WATER);
      arms[i] = (north[i] ? 1 : 0) | (west[ty * n + ((tx + 1) % n)] ? 2 : 0)
        | (north[((ty + 1) % n) * n + tx] ? 4 : 0) | (west[i] ? 8 : 0);
      ponds[i] = pond[i] ? 1 : 0;
      wet[i] = lakeCases[i] !== 0 || arms[i] !== 0 || ponds[i] !== 0 ? 1 : 0;
    }
  }
  return { plateauCases, mountainCases, lakeCases, arms, ponds, wet };
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
