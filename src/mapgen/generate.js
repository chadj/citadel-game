// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Generated maps (spec 02, Generated maps; decision D46). The same
// settings and seed always give the same map, on every machine, so a
// generated map can be rebuilt from what made it as well as sent whole.
//
// Two styles:
//   'mirror' builds a quarter of the map and mirrors it into the other
//            three, so every start position has the same surroundings;
//   'grown'  grows land and hills across the whole map, then adds water
//            and energy.
// Energy, Terrain and Water each have five steps, 0 to 4. A map comes
// out as map data (rules/terrain/map.js) plus start positions for 2, 3
// and 4 players and every team layout (decision D16).

import { MAP_SIZES } from '../rules/constants.js';
import { PLANETS } from '../rules/terrain/planets.js';

export const STYLES = Object.freeze(['mirror', 'grown']);
export const STEPS = 5;
export const ENERGY_NAMES = Object.freeze(['Scarce', 'Low', 'Normal', 'Rich', 'Abundant']);
export const TERRAIN_NAMES = Object.freeze(['Smooth', 'Gentle', 'Normal', 'Hilly', 'Rough']);
export const WATER_NAMES = Object.freeze(['None', 'Little', 'Some', 'Much', 'Islands']);

const TILE_PX = 60;
const WATER_SHARE = [0, 0.06, 0.13, 0.24, 0.5]; // of the map, by step
const RAISED_SHARE = [0.05, 0.12, 0.2, 0.28, 0.36]; // Plateau and Mountain, of the land
const MOUNTAIN_SHARE = [0.1, 0.2, 0.3, 0.38, 0.45]; // of the raised land
const ROUGH = [0.15, 0.3, 0.45, 0.6, 0.75]; // how much the finer noise counts
const VENTS_PER_1024 = [4, 7, 11, 15, 22]; // vents per 1,024 tiles, by step
const LARGE_SHARE = [0.05, 0.15, 0.25, 0.35, 0.45];
const SMALL_SHARE = [0.6, 0.45, 0.35, 0.25, 0.15];
const CHARS = ['~', '.', '+', '^'];

// A random number source from a seed: whole numbers, the same on every
// machine.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next,
    // A whole number from 0 to n - 1.
    int: (n) => next() % n,
    // A fraction in [0, 1).
    unit: () => next() / 4294967296,
  };
}

// The settings with every 'random' replaced (spec 02: a random Energy,
// Terrain or Water setting avoids both extremes).
export function resolveSettings(settings, r) {
  const pick = (v, list) => (v === 'random' || v === undefined ? list[r.int(list.length)] : v);
  const middle = [1, 2, 3];
  return {
    style: pick(settings.style, STYLES),
    tiles: pick(settings.tiles, MAP_SIZES),
    planet: pick(settings.planet, Object.keys(PLANETS)),
    energy: pick(settings.energy, middle),
    terrain: pick(settings.terrain, middle),
    water: pick(settings.water, middle),
  };
}

// Generates a map. `settings` are { style, tiles, planet, energy,
// terrain, water }, each a value or 'random'; `seed` is a whole number.
export function generateMap(settings, seed, name = null) {
  const r = rng(seed);
  const s = resolveSettings(settings, r);
  if (!STYLES.includes(s.style)) throw new Error(`no map style "${s.style}"`);
  if (!MAP_SIZES.includes(s.tiles)) throw new Error(`no map size of ${s.tiles} tiles`);
  if (!PLANETS[s.planet]) throw new Error(`no planet "${s.planet}"`);
  for (const k of ['energy', 'terrain', 'water']) {
    if (!Number.isInteger(s[k]) || s[k] < 0 || s[k] >= STEPS) throw new Error(`${k} must be a step from 0 to ${STEPS - 1}`);
  }
  const map = s.style === 'mirror' ? mirrorMap(s, r) : grownMap(s, r);
  const n = s.tiles;
  return {
    name: name ?? `Generated ${seed >>> 0}`,
    players: n <= 40 ? 2 : n <= 52 ? 3 : 4,
    planet: s.planet,
    rows: map.rows,
    vents: map.vents,
    starts: map.starts,
    settings: s,
    seed: seed >>> 0,
  };
}

// A grid of tile levels, w by h, with wrapping neighbors.
class Grid {
  constructor(w, h, wrapAround) {
    this.w = w;
    this.h = h;
    this.wrap = wrapAround;
    this.v = new Uint8Array(w * h);
  }

  at(x, y) {
    if (this.wrap) return this.v[(((y % this.h) + this.h) % this.h) * this.w + (((x % this.w) + this.w) % this.w)];
    // Without wrapping (a quarter), the edges reflect, as the mirroring
    // will make them.
    const cx = x < 0 ? -x - 1 : x >= this.w ? 2 * this.w - x - 1 : x;
    const cy = y < 0 ? -y - 1 : y >= this.h ? 2 * this.h - y - 1 : y;
    return this.v[cy * this.w + cx];
  }

  set(x, y, level) {
    const w = this.w;
    const h = this.h;
    this.v[(((y % h) + h) % h) * w + (((x % w) + w) % w)] = level;
  }

  // Levels may differ from their neighbors, corners included, by one at
  // most (decision D23): a tile too far above a neighbor comes down.
  settle() {
    for (let changed = true; changed;) {
      changed = false;
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          let low = 3;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) low = Math.min(low, this.at(x + dx, y + dy));
          if (this.at(x, y) > low + 1) {
            this.set(x, y, low + 1);
            changed = true;
          }
        }
      }
    }
  }

  // Whether the (2k+1)-square block around a tile is one dry level.
  flatBlock(x, y, k) {
    const level = this.at(x, y);
    if (level === 0) return false;
    for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (this.at(x + dx, y + dy) !== level) return false;
    return true;
  }
}

// Smooth noise over a w by h area, from a few octaves of value noise.
// `period` true makes it wrap.
function noise(w, h, r, { cells, rough, period }) {
  const out = new Float64Array(w * h);
  let amp = 1;
  let total = 0;
  for (let g = cells; g <= Math.max(w, h); g *= 2) {
    const gx = g;
    const gy = Math.max(2, Math.round((g * h) / w));
    const lattice = new Float64Array((gx + 1) * (gy + 1));
    for (let k = 0; k < lattice.length; k++) lattice[k] = r.unit();
    if (period) {
      for (let y = 0; y <= gy; y++) lattice[y * (gx + 1) + gx] = lattice[y * (gx + 1)];
      for (let x = 0; x <= gx; x++) lattice[gy * (gx + 1) + x] = lattice[x];
    }
    for (let y = 0; y < h; y++) {
      const fy = ((y + 0.5) * gy) / h;
      const iy = Math.floor(fy);
      const ty = smooth(fy - iy);
      for (let x = 0; x < w; x++) {
        const fx = ((x + 0.5) * gx) / w;
        const ix = Math.floor(fx);
        const tx = smooth(fx - ix);
        const l = (i, j) => lattice[j * (gx + 1) + i];
        const top = l(ix, iy) + (l(ix + 1, iy) - l(ix, iy)) * tx;
        const bottom = l(ix, iy + 1) + (l(ix + 1, iy + 1) - l(ix, iy + 1)) * tx;
        out[y * w + x] += amp * (top + (bottom - top) * ty);
      }
    }
    total += amp;
    amp *= rough;
  }
  for (let k = 0; k < out.length; k++) out[k] /= total;
  return out;
}

const smooth = (t) => t * t * (3 - 2 * t);

// The value below which a share of the field lies.
function quantile(field, share, mask = null) {
  const vals = [];
  for (let k = 0; k < field.length; k++) if (!mask || mask[k]) vals.push(field[k]);
  if (vals.length === 0 || share <= 0) return -Infinity;
  vals.sort((a, b) => a - b);
  return vals[Math.min(vals.length - 1, Math.floor(share * vals.length))];
}

// Lays out the levels of an area from noise.
function levels(grid, s, r, wrapAround) {
  const { w, h } = grid;
  const base = Math.max(2, Math.round(w / 10));
  const wet = noise(w, h, r, { cells: s.water >= 4 ? base * 2 : base, rough: 0.45, period: wrapAround });
  const high = noise(w, h, r, { cells: base, rough: ROUGH[s.terrain], period: wrapAround });
  const seaLevel = quantile(wet, WATER_SHARE[s.water]);
  const land = new Uint8Array(w * h);
  for (let k = 0; k < land.length; k++) land[k] = wet[k] >= seaLevel || WATER_SHARE[s.water] === 0 ? 1 : 0;
  const raised = quantile(high, 1 - RAISED_SHARE[s.terrain], land);
  const peak = quantile(high, 1 - RAISED_SHARE[s.terrain] * MOUNTAIN_SHARE[s.terrain], land);
  for (let k = 0; k < land.length; k++) {
    grid.v[k] = !land[k] ? 0 : high[k] >= peak ? 3 : high[k] >= raised ? 2 : 1;
  }
  // Lone raised tiles are just noise: they come down.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const level = grid.at(x, y);
      if (level < 2) continue;
      let alike = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && grid.at(x + dx, y + dy) >= level) alike += 1;
      if (alike < 2) grid.set(x, y, level - 1);
    }
  }
  grid.settle();
}

// Makes the (2k+1)-square block around a tile flat Ground.
function flatten(grid, x, y, k = 2) {
  for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) grid.set(x + dx, y + dy, 1);
  grid.settle();
}

const center = (t) => t * TILE_PX + TILE_PX / 2;

// The wrapped distance between two tiles, squared.
function tileGap2(n, a, b) {
  let dx = Math.abs(a.x - b.x) % n;
  let dy = Math.abs(a.y - b.y) % n;
  dx = Math.min(dx, n - dx);
  dy = Math.min(dy, n - dy);
  return dx * dx + dy * dy;
}

// Picks vent sizes for a number of vents.
function ventSizes(count, step, r) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const u = r.unit();
    out.push(u < LARGE_SHARE[step] ? 'large' : u < LARGE_SHARE[step] + SMALL_SHARE[step] ? 'small' : 'medium');
  }
  return out;
}

// Places vents on flat tiles of the grid: a large vent needs a 5-tile
// square of one level around it, the others a 3-tile square (D46).
// `ok` filters candidate tiles. Returns tile positions with sizes.
function placeVents(grid, sizes, r, ok, n, starts, placed = []) {
  const out = [];
  for (const size of sizes) {
    const k = size === 'large' ? 2 : 1;
    const cands = [];
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        if (!ok(x, y) || !grid.flatBlock(x, y, k)) continue;
        if (starts.some((st) => tileGap2(n, st, { x, y }) < 9)) continue;
        if ([...placed, ...out].some((v) => tileGap2(n, v, { x, y }) < 9)) continue;
        cands.push({ x, y });
      }
    }
    if (cands.length === 0) continue;
    out.push({ ...cands[r.int(cands.length)], size });
  }
  return out;
}

// Start position groups for four starts, a and b on one side and c and d
// on the other (decision D16).
export function startGroups(a, b, c, d) {
  const p = (t) => ({ x: t.x, y: t.y });
  return {
    2: { '': [[p(a)], [p(d)]] },
    3: { '': [[p(a)], [p(b)], [p(d)]], 2: [[p(d)], [p(a), p(b)]] },
    4: {
      '': [[p(a)], [p(b)], [p(c)], [p(d)]],
      '2+2': [[p(a), p(b)], [p(c), p(d)]],
      3: [[p(d)], [p(a), p(b), p(c)]],
    },
  };
}

function mirrorMap(s, r) {
  const n = s.tiles;
  const q = n / 2;
  const quarter = new Grid(q, q, false);
  levels(quarter, s, r, false);
  // The start: near the middle of the quarter.
  const spread = Math.max(1, Math.floor(q / 6));
  const st = { x: Math.floor(q / 2) + r.int(2 * spread + 1) - spread, y: Math.floor(q / 2) + r.int(2 * spread + 1) - spread };
  flatten(quarter, st.x, st.y);
  // Vents in the quarter, clear of its edges so mirrored vents stay apart.
  const count = Math.max(1, Math.round((VENTS_PER_1024[s.energy] * n * n) / 1024 / 4));
  const inner = (x, y) => x >= 2 && y >= 2 && x < q - 2 && y < q - 2;
  const vents = placeVents(quarter, ventSizes(count, s.energy, r), r, inner, q, [st]);

  const full = new Grid(n, n, true);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const qx = x < q ? x : n - 1 - x;
      const qy = y < q ? y : n - 1 - y;
      full.set(x, y, quarter.at(qx, qy));
    }
  }
  full.settle();
  const flip = (t, fx, fy) => ({ x: fx ? n - 1 - t.x : t.x, y: fy ? n - 1 - t.y : t.y });
  const corners = [[false, false], [true, false], [false, true], [true, true]];
  const allVents = vents.flatMap((v) => corners.map(([fx, fy]) => ({ ...flip(v, fx, fy), size: v.size })));
  const [a, b, c, d] = corners.map(([fx, fy]) => flip(st, fx, fy));
  return finish(full, allVents, [a, b, c, d]);
}

function grownMap(s, r) {
  const n = s.tiles;
  const grid = new Grid(n, n, true);
  levels(grid, s, r, true);
  // Four starts, as far apart as can be: on dry, flat land if there is
  // any, else wherever is driest.
  const cands = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (grid.flatBlock(x, y, 2) && grid.at(x, y) === 1) cands.push({ x, y });
  if (cands.length < 4) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (grid.at(x, y) !== 0) cands.push({ x, y });
  if (cands.length < 4) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cands.push({ x, y });
  const starts = [cands[r.int(cands.length)]];
  while (starts.length < 4) {
    let best = null;
    let bestGap = -1;
    for (const c of cands) {
      const gap = Math.min(...starts.map((t) => tileGap2(n, t, c)));
      if (gap > bestGap) {
        bestGap = gap;
        best = c;
      }
    }
    starts.push(best);
  }
  for (const t of starts) flatten(grid, t.x, t.y);

  // Teams of two get the closer pairs (D16); a and d are on opposite sides.
  const pairings = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  const cost = (pr) => pr.reduce((sum, [i, j]) => sum + tileGap2(n, starts[i], starts[j]), 0);
  const [[i1, j1], [i2, j2]] = pairings.sort((x, y) => cost(x) - cost(y))[0];
  const a = starts[i1];
  const b = starts[j1];
  const [c, d] = tileGap2(n, a, starts[i2]) > tileGap2(n, a, starts[j2]) ? [starts[j2], starts[i2]] : [starts[i2], starts[j2]];

  // Energy: one vent near each start first, if there's room, then the
  // rest anywhere.
  const count = Math.max(4, Math.round((VENTS_PER_1024[s.energy] * n * n) / 1024));
  const sizes = ventSizes(count, s.energy, r);
  const vents = [];
  for (const t of [a, b, c, d]) {
    const near = (x, y) => tileGap2(n, t, { x, y }) <= 64;
    vents.push(...placeVents(grid, [sizes.pop()], r, near, n, [a, b, c, d], vents));
  }
  vents.push(...placeVents(grid, sizes, r, () => true, n, [a, b, c, d], vents));
  return finish(grid, vents, [a, b, c, d]);
}

// The map data from a grid, vents and starts in tiles.
function finish(grid, vents, [a, b, c, d]) {
  const rows = [];
  for (let y = 0; y < grid.h; y++) {
    let row = '';
    for (let x = 0; x < grid.w; x++) row += CHARS[grid.at(x, y)];
    rows.push(row);
  }
  const px = (t) => ({ x: center(t.x), y: center(t.y) });
  return {
    rows,
    vents: vents.map((v) => ({ ...px(v), size: v.size })),
    starts: startGroups(px(a), px(b), px(c), px(d)),
  };
}
