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
//
// It works on corner levels (spec 02, Landforms; decision D55): noise
// sets each corner's level, so cliffs and shores step across the grid
// at 45° as freely as they run along it. Channels wander from tile to
// tile with straight runs, bends, branches and dead ends, often out of
// a lake; ponds sit in single tiles; and craters are painted on flat
// ground.

import { MAP_SIZES, WATER, GROUND } from '../rules/constants.js';
import { PLANETS } from '../rules/terrain/planets.js';

export const STYLES = Object.freeze(['mirror', 'grown']);
export const STEPS = 5;
export const ENERGY_NAMES = Object.freeze(['Scarce', 'Low', 'Normal', 'Rich', 'Abundant']);
export const TERRAIN_NAMES = Object.freeze(['Smooth', 'Gentle', 'Normal', 'Hilly', 'Rough']);
export const WATER_NAMES = Object.freeze(['None', 'Little', 'Some', 'Much', 'Islands']);

const TILE_PX = 60;
const WATER_SHARE = [0, 0.06, 0.13, 0.24, 0.5]; // of the map, by step
// How much of the finished land is raised, by Terrain step (D61): it's
// measured on the map as it comes out, not on the noise it starts from.
const RAISED_SHARE = [0.15, 0.25, 0.35, 0.45, 0.55]; // Plateau and Mountain, of the land
const MOUNTAIN_SHARE = [0.2, 0.28, 0.35, 0.42, 0.5]; // of the raised land
const ROUGH = [0.15, 0.3, 0.45, 0.6, 0.75]; // how much the finer noise counts
const VENTS_PER_1024 = [4, 7, 11, 15, 22]; // vents per 1,024 tiles, by step
const LARGE_SHARE = [0.05, 0.15, 0.25, 0.35, 0.45];
const SMALL_SHARE = [0.6, 0.45, 0.35, 0.25, 0.15];
const CHANNELS_PER_1024 = [0, 3, 5, 7, 5]; // channels per 1,024 tiles, by water step
const PONDS_PER_1024 = [0, 2, 3, 3, 2];
const CRATERS_PER_1024 = [1, 2, 2, 3, 4]; // painted craters, by terrain step
const CHARS = ['~', '.', '+', '^'];
const DX = [0, 1, 0, -1]; // north, east, south, west
const DY = [-1, 0, 1, 0];

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
    corners: map.corners,
    ...(map.water && { water: map.water }),
    ...(map.craters.length > 0 && { craters: map.craters }),
    vents: map.vents,
    starts: map.starts,
    settings: s,
    seed: seed >>> 0,
  };
}

// The land: a level at each corner, n by n, wrapping (corner (x, y) is
// the north-west corner of tile (x, y)), and the water marks that
// corners can't express: channels across tiles' north and west edges,
// and ponds.
class Land {
  constructor(n) {
    this.n = n;
    this.c = new Uint8Array(n * n);
    this.north = new Uint8Array(n * n);
    this.west = new Uint8Array(n * n);
    this.pond = new Uint8Array(n * n);
  }

  i(x, y) {
    const n = this.n;
    return (((y % n) + n) % n) * n + (((x % n) + n) % n);
  }

  at(x, y) {
    return this.c[this.i(x, y)];
  }

  set(x, y, level) {
    this.c[this.i(x, y)] = level;
  }

  // A tile's four corners.
  four(x, y) {
    return [this.at(x, y), this.at(x + 1, y), this.at(x + 1, y + 1), this.at(x, y + 1)];
  }

  // Whether a tile may hold water: none of its corners is raised.
  dry(x, y) {
    return Math.max(...this.four(x, y)) <= GROUND;
  }

  // Whether a tile has open water in a corner.
  lake(x, y) {
    return Math.min(...this.four(x, y)) === WATER;
  }

  // The number of channel arms in a tile.
  arms(x, y) {
    return this.north[this.i(x, y)] + this.west[this.i(x, y)] + this.north[this.i(x, y + 1)] + this.west[this.i(x + 1, y)];
  }

  wet(x, y) {
    return this.lake(x, y) || this.arms(x, y) > 0 || this.pond[this.i(x, y)] === 1;
  }

  // Marks the edge a channel crosses, leaving a tile in a direction.
  mark(x, y, dir) {
    if (dir === 0) this.north[this.i(x, y)] = 1;
    else if (dir === 2) this.north[this.i(x, y + 1)] = 1;
    else if (dir === 3) this.west[this.i(x, y)] = 1;
    else this.west[this.i(x + 1, y)] = 1;
  }

  // Whether a tile is flat all over at one dry level.
  flat(x, y, level) {
    return level !== WATER && this.four(x, y).every((l) => l === level) && !(level === GROUND && this.wet(x, y));
  }

  // Whether the (2k+1)-square block of tiles around a tile is flat at
  // one dry level.
  flatBlock(x, y, k) {
    const level = this.at(x, y);
    for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (!this.flat(x + dx, y + dy, level)) return false;
    return true;
  }

  // A tile mixes two neighboring levels at most (spec 02, Landforms): a
  // corner too far above a corner of the same tile comes down.
  settle() {
    const n = this.n;
    for (let changed = true; changed;) {
      changed = false;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
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

  // Every raised corner, and every water corner, belongs to at least one
  // whole tile of its level: so each hill has a flat top and each lake
  // some open water, with no knife-edge ridges or specks. Others become
  // like their neighbors. A corner of land with water all round goes
  // under too. Each pass reads from a copy, so the result
  // doesn't depend on the order, and mirrored land stays mirrored.
  prune() {
    const n = this.n;
    for (let changed = true; changed;) {
      changed = false;
      const was = this.c.slice();
      const at = (x, y) => was[(((y % n) + n) % n) * n + (((x % n) + n) % n)];
      const like = (level, other) => (level === WATER ? other === WATER : other >= level);
      const whole = (tx, ty, level) => like(level, at(tx, ty)) && like(level, at(tx + 1, ty))
        && like(level, at(tx + 1, ty + 1)) && like(level, at(tx, ty + 1));
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const level = at(x, y);
          if (level === GROUND) {
            // A speck of land with water all round goes under.
            let water = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy) === WATER) water++;
            if (water === 8) {
              this.set(x, y, WATER);
              changed = true;
            }
            continue;
          }
          if (whole(x - 1, y - 1, level) || whole(x, y - 1, level) || whole(x - 1, y, level) || whole(x, y, level)) continue;
          this.set(x, y, level === WATER ? GROUND : level - 1);
          changed = true;
        }
      }
    }
    this.settle();
  }

  copy() {
    return [this.c, this.north, this.west, this.pond].map((a) => a.slice());
  }

  restore([c, north, west, pond]) {
    this.c.set(c);
    this.north.set(north);
    this.west.set(west);
    this.pond.set(pond);
  }

  // Water never shares a tile with a cliff: marks go from any tile with
  // a raised corner.
  sanitize() {
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        if (this.dry(x, y)) continue;
        this.north[this.i(x, y)] = 0;
        this.west[this.i(x, y)] = 0;
        this.north[this.i(x, y + 1)] = 0;
        this.west[this.i(x + 1, y)] = 0;
        this.pond[this.i(x, y)] = 0;
      }
    }
  }

  // Makes the (2k+1)-square block of tiles around a tile flat at a level
  // (Ground unless said), with no water in it or touching it.
  flatten(x, y, k = 2, level = GROUND) {
    for (let dy = -k; dy <= k + 1; dy++) for (let dx = -k; dx <= k + 1; dx++) this.set(x + dx, y + dy, level);
    for (let dy = -k - 1; dy <= k + 1; dy++) {
      for (let dx = -k - 1; dx <= k + 1; dx++) {
        const inside = Math.abs(dx) <= k && Math.abs(dy) <= k;
        if (inside || dy === -k - 1) this.north[this.i(x + dx, y + dy + 1)] = 0;
        if (inside || dx === -k - 1) this.west[this.i(x + dx + 1, y + dy)] = 0;
        if (inside) {
          this.north[this.i(x + dx, y + dy)] = 0;
          this.west[this.i(x + dx, y + dy)] = 0;
        }
        this.pond[this.i(x + dx, y + dy)] = 0;
      }
    }
    this.settle();
  }

  // Makes the land the same in all four quarters, mirrored, from the
  // quarter of tiles 0 to n/2 - 1 each way: corners mirror x to n - x,
  // tiles x to n - 1 - x.
  mirror() {
    const n = this.n;
    const q = n / 2;
    const mc = (v) => (v <= q ? v : n - v);
    const c = this.c.slice();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) this.c[y * n + x] = c[mc(y) * n + mc(x)];
    // The marks: whatever is marked anywhere is marked in all its images.
    const north = this.north.slice();
    const west = this.west.slice();
    const pond = this.pond.slice();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const k = y * n + x;
        if (north[k]) for (const [ix, iy] of [[x, y], [n - 1 - x, y], [x, n - y], [n - 1 - x, n - y]]) this.north[this.i(ix, iy)] = 1;
        if (west[k]) for (const [ix, iy] of [[x, y], [n - x, y], [x, n - 1 - y], [n - x, n - 1 - y]]) this.west[this.i(ix, iy)] = 1;
        if (pond[k]) for (const [ix, iy] of [[x, y], [n - 1 - x, y], [x, n - 1 - y], [n - 1 - x, n - 1 - y]]) this.pond[this.i(ix, iy)] = 1;
      }
    }
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

// The noise for an area, w by h: one field for water, one for height.
function fields(w, h, s, r, wrapAround) {
  const base = Math.max(2, Math.round(w / 10));
  const wet = noise(w, h, r, { cells: s.water >= 4 ? base * 2 : base, rough: 0.45, period: wrapAround });
  const high = noise(w, h, r, { cells: base, rough: ROUGH[s.terrain], period: wrapAround });
  const seaLevel = quantile(wet, WATER_SHARE[s.water]);
  const land = new Uint8Array(w * h);
  for (let k = 0; k < land.length; k++) land[k] = wet[k] >= seaLevel || WATER_SHARE[s.water] === 0 ? 1 : 0;
  return { high, land };
}

// The levels from the noise, 0 water to 3 Mountain, with shares of the
// land cut for raised ground and for Mountains.
function levels({ high, land }, raisedShare, peakShare) {
  const raised = quantile(high, 1 - raisedShare, land);
  const peak = quantile(high, 1 - peakShare, land);
  const out = new Uint8Array(high.length);
  for (let k = 0; k < out.length; k++) out[k] = !land[k] ? 0 : high[k] >= peak ? 3 : high[k] >= raised ? 2 : 1;
  return out;
}

// The shares of the land that are raised and that are Mountain.
function measure(land) {
  let dry = 0;
  let raised = 0;
  let peak = 0;
  for (const l of land.c) {
    if (l === WATER) continue;
    dry++;
    if (l > GROUND) raised++;
    if (l === 3) peak++;
  }
  return [raised / Math.max(1, dry), peak / Math.max(1, dry)];
}

// Builds the land so the finished map has its Terrain step's shares.
// Pruning trims hills, so the noise is cut higher until what's left
// measures right (D61). `build(raisedShare, peakShare)` makes the land
// from the same noise each time.
function shaped(build, s) {
  const want = RAISED_SHARE[s.terrain];
  const wantPeak = want * MOUNTAIN_SHARE[s.terrain];
  let cut = want;
  let cutPeak = wantPeak;
  let land = null;
  for (let k = 0; k < 8; k++) {
    land = build(cut, cutPeak);
    const [raised, peak] = measure(land);
    if (Math.abs(raised - want) < 0.01 && Math.abs(peak - wantPeak) < 0.01) break;
    cut = Math.min(0.95, cut * (want / Math.max(raised, 0.01)));
    cutPeak = Math.min(cut, cutPeak * (wantPeak / Math.max(peak, 0.005)));
  }
  return land;
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

// Places vents on flat tiles: a large vent needs a 5-tile square of one
// level around it, the others a 3-tile square (D46). `ok` filters
// candidate tiles. Where hills leave no such square, the spot closest to
// one is levelled down to its lowest level, in every image of it that
// `images` gives (D61). Returns tile positions with sizes.
function placeVents(land, sizes, r, ok, starts, placed = [], images = (t) => [t]) {
  const n = land.n;
  const out = [];
  for (const size of sizes) {
    const k = size === 'large' ? 2 : 1;
    const cands = [];
    const spots = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!ok(x, y)) continue;
        if (starts.some((st) => tileGap2(n, st, { x, y }) < 9)) continue;
        if ([...placed, ...out].some((v) => tileGap2(n, v, { x, y }) < 9)) continue;
        if (land.flatBlock(x, y, k)) cands.push({ x, y });
        else spots.push({ x, y });
      }
    }
    if (cands.length > 0) {
      out.push({ ...cands[r.int(cands.length)], size });
      continue;
    }
    // The spots with the most of their square flat already, levelled to
    // their lowest dry level. A spot whose levelling wears away the flat
    // ground of a start or a vent already placed is put back as it was.
    const flatCount = (t) => {
      let flat = 0;
      for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (land.flat(t.x + dx, t.y + dy, land.at(t.x, t.y))) flat++;
      return flat;
    };
    const ranked = spots.map((t) => ({ t, flat: flatCount(t), tie: r.unit() })).sort((p, q) => q.flat - p.flat || p.tie - q.tie);
    const keep = [...starts.map((t) => ({ ...t, k: 2 })), ...[...placed, ...out].map((v) => ({ ...v, k: v.size === 'large' ? 2 : 1 }))];
    for (const { t } of ranked.slice(0, 20)) {
      const was = land.copy();
      let level = 3;
      for (let dy = -k; dy <= k + 1; dy++) for (let dx = -k; dx <= k + 1; dx++) level = Math.min(level, Math.max(GROUND, land.at(t.x + dx, t.y + dy)));
      for (const im of images(t)) land.flatten(im.x, im.y, k, level);
      land.prune();
      land.sanitize();
      if (land.flatBlock(t.x, t.y, k) && keep.every((v) => land.flatBlock(v.x, v.y, v.k))) {
        out.push({ ...t, size });
        break;
      }
      land.restore(was);
    }
  }
  return out;
}

// Channels: each starts in a dry tile, often beside a lake, and wanders
// with straight runs and bends. It stops where it reaches raised land (a
// dead end), opens into a lake, or meets another channel (a T-junction),
// though it may carry on across it (a crossing); now and then a branch
// leaves it (another T-junction). `ok` says which tiles it may start in
// or enter: off them, it stops at the edge, where its mirror image will
// meet it.
function addChannels(land, count, r, ok) {
  const n = land.n;
  const shore = [];
  const inland = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!ok(x, y) || !land.dry(x, y) || land.wet(x, y)) continue;
      const byLake = [0, 1, 2, 3].some((d) => land.lake(x + DX[d], y + DY[d]));
      (byLake ? shore : inland).push({ x, y });
    }
  }
  // Whether a channel entering a tile would run alongside another: a
  // tile beside it, across the way it's going, has water in it.
  const alongside = (x, y, dir) => [1, 3].some((side) => {
    const d = (dir + side) % 4;
    return land.arms(x + DX[d], y + DY[d]) > 0;
  });
  const walk = (x, y, dir, length, branches) => {
    let lastTurn = 0;
    for (let step = 0; step < length; step++) {
      // Bends turn back and forth, never round into a loop.
      if (step > 0 && r.unit() < 0.25) {
        const turn = lastTurn === 1 ? 3 : lastTurn === 3 ? 1 : r.int(2) ? 1 : 3;
        dir = (dir + turn) % 4;
        lastTurn = turn;
      }
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      if (!land.dry(nx, ny)) return;
      const met = land.arms(nx, ny) > 0;
      if (!met && !land.lake(nx, ny) && alongside(nx, ny, dir)) return;
      land.mark(x, y, dir);
      if (!ok(nx, ny) || land.lake(nx, ny)) return;
      if (met && r.unit() < 0.5) return;
      if (branches > 0 && step > 0 && r.unit() < 0.15) {
        const side = (dir + (r.int(2) ? 1 : 3)) % 4;
        if (land.arms(x + DX[side], y + DY[side]) === 0) walk(x, y, side, 2 + r.int(4), branches - 1);
      }
      x = nx;
      y = ny;
    }
  };
  for (let k = 0; k < count; k++) {
    const from = shore.length > 0 && (k % 2 === 0 || inland.length === 0) ? shore : inland;
    if (from.length === 0) return;
    const t = from[r.int(from.length)];
    // Out of a lake, away from it; inland, any way.
    const away = [0, 1, 2, 3].filter((d) => !land.lake(t.x + DX[d], t.y + DY[d]));
    const dir = from === shore && away.length > 0 ? away[r.int(away.length)] : r.int(4);
    // A channel shorter than three tiles' edges would be a stray dash:
    // it's taken back.
    const north = land.north.slice();
    const west = land.west.slice();
    walk(t.x, t.y, dir, 4 + r.int(9), 1);
    let added = 0;
    for (let i = 0; i < n * n; i++) added += land.north[i] - north[i] + land.west[i] - west[i];
    if (added < 3) {
      land.north.set(north);
      land.west.set(west);
    }
  }
}

// Ponds: in flat Ground tiles with no water beside them.
function addPonds(land, count, r, ok) {
  const n = land.n;
  for (let k = 0; k < count; k++) {
    const cands = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!ok(x, y) || !land.flat(x, y, GROUND)) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = land.wet(x + dx, y + dy);
        if (!near) cands.push({ x, y });
      }
    }
    if (cands.length === 0) return;
    const t = cands[r.int(cands.length)];
    land.pond[land.i(t.x, t.y)] = 1;
  }
}

// Painted craters, larger than a tile, on flat ground of any level and
// clear of the starts and vents (spec 02, Landforms: Variety). In pixels.
function placeCraters(land, count, r, ok, starts, vents) {
  const n = land.n;
  const out = [];
  for (let k = 0; k < count; k++) {
    // Where hills leave no room 3 tiles from every vent, a smaller crater
    // may sit 2 tiles from one (D61).
    let cands = [];
    let small = false;
    for (const ventGap of [9, 5]) {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (!ok(x, y) || !land.flatBlock(x, y, 1)) continue;
          if ([...starts, ...out.map((c) => c.tile)].some((t) => tileGap2(n, t, { x, y }) < 9)) continue;
          if (vents.some((t) => tileGap2(n, t, { x, y }) < ventGap)) continue;
          cands.push({ x, y });
        }
      }
      if (cands.length > 0) break;
      small = true;
    }
    if (cands.length === 0) break;
    const t = cands[r.int(cands.length)];
    // Within the flat 3-tile square: radius 40 to 80 px (40 to 50 for a
    // small one), nudged a little.
    const radius = 40 + r.int(small ? 11 : 41);
    const room = 90 - radius;
    const nudge = () => r.int(2 * Math.min(10, room) + 1) - Math.min(10, room);
    out.push({ tile: t, x: center(t.x) + nudge(), y: center(t.y) + nudge(), r: radius });
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
  // The quarter's corners, 0 to q each way: the corners on its edges are
  // their own mirror images.
  const noiseQ = fields(q + 1, q + 1, s, r, false);
  const inQuarter = (x, y) => x >= 0 && y >= 0 && x < q && y < q;
  // The start: near the middle of the quarter.
  const spread = Math.max(1, Math.floor(q / 6));
  const st = { x: Math.floor(q / 2) + r.int(2 * spread + 1) - spread, y: Math.floor(q / 2) + r.int(2 * spread + 1) - spread };
  const flip = (t, fx, fy) => ({ x: fx ? n - 1 - t.x : t.x, y: fy ? n - 1 - t.y : t.y });
  const quarters = [[false, false], [true, false], [false, true], [true, true]];
  // The starts are flattened before the land is measured, so the hills
  // they take are made up elsewhere.
  const land = shaped((cut, cutPeak) => {
    const built = new Land(n);
    const quarter = levels(noiseQ, cut, cutPeak);
    for (let y = 0; y <= q; y++) for (let x = 0; x <= q; x++) built.set(x, y, quarter[y * (q + 1) + x]);
    built.mirror();
    built.prune();
    for (const [fx, fy] of quarters) {
      const t = flip(st, fx, fy);
      built.flatten(t.x, t.y);
    }
    built.prune();
    return built;
  }, s);
  const clear = (x, y) => inQuarter(x, y) && tileGap2(n, st, { x, y }) > 8;
  addChannels(land, Math.round((CHANNELS_PER_1024[s.water] * n * n) / 1024 / 4), r, clear);
  addPonds(land, Math.round((PONDS_PER_1024[s.water] * n * n) / 1024 / 4), r, clear);
  land.mirror();
  land.sanitize();
  // Vents in the quarter, clear of its edges so mirrored vents stay apart.
  const count = Math.max(1, Math.round((VENTS_PER_1024[s.energy] * n * n) / 1024 / 4));
  const inner = (x, y) => x >= 2 && y >= 2 && x < q - 2 && y < q - 2;
  const vents = placeVents(land, ventSizes(count, s.energy, r), r, inner, [st], [], (t) => quarters.map(([fx, fy]) => flip(t, fx, fy)));
  const craters = placeCraters(land, Math.round((CRATERS_PER_1024[s.terrain] * n * n) / 1024 / 4) || 1, r, inner, [st], vents);
  const size = n * TILE_PX;
  const allVents = vents.flatMap((v) => quarters.map(([fx, fy]) => ({ ...flip(v, fx, fy), size: v.size })));
  const allCraters = craters.flatMap((c) => quarters.map(([fx, fy]) => ({ x: fx ? size - c.x : c.x, y: fy ? size - c.y : c.y, r: c.r })));
  const [a, b, c, d] = quarters.map(([fx, fy]) => flip(st, fx, fy));
  return finish(land, allVents, allCraters, [a, b, c, d]);
}

function grownMap(s, r) {
  const n = s.tiles;
  const noiseN = fields(n, n, s, r, true);
  const land = shaped((cut, cutPeak) => {
    const built = new Land(n);
    built.c.set(levels(noiseN, cut, cutPeak));
    built.prune();
    return built;
  }, s);
  // Four starts, as far apart as can be: on dry, flat land if there is
  // any, else wherever is driest.
  const cands = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (land.flatBlock(x, y, 2) && land.at(x, y) === GROUND) cands.push({ x, y });
  if (cands.length < 4) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!land.lake(x, y)) cands.push({ x, y });
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
  for (const t of starts) land.flatten(t.x, t.y);
  land.prune();
  const clear = (x, y) => starts.every((t) => tileGap2(n, t, { x, y }) > 8);
  addChannels(land, Math.round((CHANNELS_PER_1024[s.water] * n * n) / 1024), r, clear);
  addPonds(land, Math.round((PONDS_PER_1024[s.water] * n * n) / 1024), r, clear);
  land.sanitize();

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
    vents.push(...placeVents(land, [sizes.pop()], r, near, [a, b, c, d], vents));
  }
  vents.push(...placeVents(land, sizes, r, () => true, [a, b, c, d], vents));
  const craters = placeCraters(land, Math.max(1, Math.round((CRATERS_PER_1024[s.terrain] * n * n) / 1024)), r, () => true, [a, b, c, d], vents);
  return finish(land, vents, craters, [a, b, c, d]);
}

// The map data from the land, and vents and starts in tiles.
function finish(land, vents, craters, [a, b, c, d]) {
  const n = land.n;
  const corners = [];
  const water = [];
  let anyWater = false;
  for (let y = 0; y < n; y++) {
    let row = '';
    let marks = '';
    for (let x = 0; x < n; x++) {
      const k = y * n + x;
      row += CHARS[land.c[k]];
      const m = land.north[k] + 2 * land.west[k] + 4 * land.pond[k];
      marks += m === 0 ? '.' : String(m);
      if (m) anyWater = true;
    }
    corners.push(row);
    water.push(marks);
  }
  const px = (t) => ({ x: center(t.x), y: center(t.y) });
  return {
    corners,
    water: anyWater ? water : null,
    craters: craters.map(({ x, y, r }) => ({ x, y, r })),
    vents: vents.map((v) => ({ ...px(v), size: v.size })),
    starts: startGroups(px(a), px(b), px(c), px(d)),
  };
}
