// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The map format and its checks (spec 02, Landforms; decisions D26,
// D55). How maps are stored is up to us; docs/formats.md (Map data)
// describes the format in full. A map is plain data:
//
//   {
//     name: 'Twin Lakes',
//     players: 2,                // suggested number of players
//     planet: 'tundra',
//     corners: ['....++', ...],  // one string per row of corners, north first
//     water: ['..1.4.', ...],    // optional: water marks, one per tile
//     craters: [{ x, y, r }],    // optional: painted craters, in pixels
//     vents: [{ x, y, size }],   // centers in pixels; size 'large' | 'medium' | 'small'
//   }
//
// Corner characters: '~' Water, '.' Ground, '+' Plateau, '^' Mountain.
// Corner (x, y) is the north-west corner of tile (x, y); the map wraps,
// so there are as many corners as tiles. A water mark is '.' for none,
// or a digit adding up: 1, a channel crosses the tile's north edge; 2, a
// channel crosses its west edge; 4, the tile holds a pond. Each edge is
// recorded by one tile only, so the tiles on both sides agree.
// The map is square, and its side is one of the five sizes.

import { WATER, GROUND, PLATEAU, MOUNTAIN, MAP_SIZES, TILE } from '../constants.js';
import { PX } from '../math/fixed.js';
import { PLANETS } from './planets.js';
import { terrainTables } from './terrain.js';

export const LEVEL_OF = Object.freeze({ '~': WATER, '.': GROUND, '+': PLATEAU, '^': MOUNTAIN });
export const LEVEL_CHARS = Object.freeze(['~', '.', '+', '^']);
const LEVEL_NAMES = ['water', 'Ground', 'Plateau', 'Mountain'];

// Water marks.
export const NORTH_CHANNEL = 1;
export const WEST_CHANNEL = 2;
export const POND = 4;

// Vent diameters (spec 02, Energy Vents): about 110, 80 and 45 px.
export const VENT_SIZES = Object.freeze({ large: 110, medium: 80, small: 45 });

// Checks a map and compiles it for the rules. Throws an Error that lists
// every problem found.
export function loadMap(data) {
  const problems = [];
  if (typeof data?.name !== 'string' || data.name === '') problems.push('it has no name');
  if (!Number.isInteger(data?.players) || data.players < 2 || data.players > 4) {
    problems.push('its suggested number of players must be 2, 3 or 4');
  }
  const planet = PLANETS[data?.planet];
  if (!planet) problems.push(`"${data?.planet}" isn't a planet`);

  const rows = Array.isArray(data?.corners) ? data.corners : [];
  const n = rows.length;
  if (!MAP_SIZES.includes(n)) {
    problems.push(`it is ${n} tiles tall; the sizes are ${MAP_SIZES.join(', ')}`);
  }
  const corners = new Uint8Array(n * n);
  rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== n) {
      problems.push(`corner row ${y} isn't ${n} corners wide`);
      return;
    }
    for (let x = 0; x < n; x++) {
      const level = LEVEL_OF[row[x]];
      if (level === undefined) problems.push(`corner (${x}, ${y}): "${row[x]}" isn't a level`);
      else corners[y * n + x] = level;
    }
  });

  const north = new Uint8Array(n * n);
  const west = new Uint8Array(n * n);
  const pond = new Uint8Array(n * n);
  if (data?.water !== undefined) {
    const marks = Array.isArray(data.water) ? data.water : [];
    if (marks.length !== n) problems.push(`its water marks have ${marks.length} rows, not ${n}`);
    marks.forEach((row, y) => {
      if (typeof row !== 'string' || row.length !== n) {
        problems.push(`water row ${y} isn't ${n} tiles wide`);
        return;
      }
      for (let x = 0; x < n; x++) {
        const m = row[x] === '.' ? 0 : '01234567'.indexOf(row[x]);
        if (m < 0) {
          problems.push(`tile (${x}, ${y}): "${row[x]}" isn't a water mark`);
          continue;
        }
        north[y * n + x] = m & NORTH_CHANNEL ? 1 : 0;
        west[y * n + x] = m & WEST_CHANNEL ? 1 : 0;
        pond[y * n + x] = m & POND ? 1 : 0;
      }
    });
  }

  // A tile mixes at most two neighboring levels, and water never shares
  // a tile with a cliff (spec 02, Landforms).
  if (problems.length === 0) {
    for (let ty = 0; ty < n; ty++) {
      for (let tx = 0; tx < n; tx++) {
        const four = [
          corners[ty * n + tx], corners[ty * n + (tx + 1) % n],
          corners[((ty + 1) % n) * n + (tx + 1) % n], corners[((ty + 1) % n) * n + tx],
        ];
        const low = Math.min(...four);
        const high = Math.max(...four);
        if (high - low > 1) {
          const kinds = [...new Set(four)].sort().map((l) => LEVEL_NAMES[l]).join(', ');
          problems.push(`tile (${tx}, ${ty}) mixes ${kinds}`);
          continue;
        }
        const wet = north[ty * n + tx] || west[ty * n + tx] || pond[ty * n + tx]
          || north[((ty + 1) % n) * n + tx] || west[ty * n + (tx + 1) % n];
        if (wet && high > GROUND) problems.push(`tile (${tx}, ${ty}) has water and a cliff`);
      }
    }
  }

  const size = n * TILE;
  const inside = (v) => Number.isInteger(v) && v >= 0 && v < n * (TILE / PX);
  const vents = [];
  for (const [k, vent] of (Array.isArray(data?.vents) ? data.vents : []).entries()) {
    const diameter = VENT_SIZES[vent?.size];
    if (!diameter || !inside(vent.x) || !inside(vent.y)) {
      problems.push(`vent ${k} needs whole-pixel x and y on the map and a size of large, medium or small`);
    } else {
      vents.push(Object.freeze({ x: vent.x * PX, y: vent.y * PX, radius: (diameter * PX) / 2 }));
    }
  }
  const craters = [];
  for (const [k, c] of (Array.isArray(data?.craters) ? data.craters : []).entries()) {
    if (!inside(c?.x) || !inside(c?.y) || !Number.isInteger(c?.r) || c.r <= 0) {
      problems.push(`crater ${k} needs whole-pixel x and y on the map and a radius`);
    } else {
      craters.push(Object.freeze({ x: c.x, y: c.y, r: c.r }));
    }
  }

  if (problems.length > 0) {
    throw new Error(`Map "${data?.name}" is invalid:\n- ${problems.join('\n- ')}`);
  }
  return Object.freeze({
    name: data.name,
    players: data.players,
    planet: data.planet,
    tiles: n,
    size,
    corners,
    north,
    west,
    pond,
    ...terrainTables(n, corners, north, west, pond),
    plateauHeight: planet.plateau,
    mountainHeight: planet.mountain,
    vents: Object.freeze(vents),
    craters: Object.freeze(craters),
  });
}

// A map's size in tiles, from its data.
export const mapTiles = (data) => data.corners.length;

// Corners from tiles: each corner takes the highest level of the four
// tiles around it. So a raised tile is raised to its edges, and a
// corner is water only where all four tiles are.
export function cornersFromTiles(rows) {
  const n = rows.length;
  const level = (x, y) => LEVEL_OF[rows[(y + n) % n][(x + n) % n]];
  return rows.map((_, y) => Array.from({ length: n }, (__, x) => (
    LEVEL_CHARS[Math.max(level(x - 1, y - 1), level(x, y - 1), level(x - 1, y), level(x, y))]
  )).join(''));
}

// Map data from a picture, for tests and tools. `rows` is a picture of
// tiles, converted to corners as cornersFromTiles does; `corners` a
// picture of corners, laid over the result; `water` a picture of water
// marks. Each may be smaller than the map, placed with its top-left at
// `at`; the rest is `fill` tiles.
export function sketchMapData({
  tiles = 32, planet = 'tundra', fill = '.', rows = [], corners = [], water = [], at = [0, 0], ...rest
} = {}) {
  const grid = (pic, base) => {
    const g = Array.from({ length: tiles }, () => Array(tiles).fill(base));
    pic.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== ' ') g[(at[1] + y) % tiles][(at[0] + x) % tiles] = row[x];
    });
    return g.map((r) => r.join(''));
  };
  const cornerRows = cornersFromTiles(grid(rows, fill)).map((r) => r.split(''));
  corners.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== ' ') cornerRows[(at[1] + y) % tiles][(at[0] + x) % tiles] = row[x];
  });
  const marks = grid(water, '.');
  return {
    name: 'Sketch',
    players: 2,
    planet,
    ...rest,
    corners: cornerRows.map((r) => r.join('')),
    ...(marks.some((r) => /[^.]/.test(r)) && { water: marks }),
  };
}

// The same, loaded.
export function sketchMap(options) {
  return loadMap(sketchMapData(options));
}
