// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The map format and its checks (spec 02; decisions D23, D26). How maps are
// stored is up to us. A map is plain data:
//
//   {
//     name: 'Twin Lakes',
//     players: 2,              // suggested number of players
//     planet: 'tundra',
//     rows: ['....++', ...],   // one string per row of tiles, north first
//     vents: [{ x, y, size }], // centers in pixels; size 'large' | 'medium' | 'small'
//   }
//
// Tile characters: '~' Water, '.' Ground, '+' Plateau, '^' Mountain.
// The map is square, and its side is one of the five sizes.

import { WATER, GROUND, PLATEAU, MOUNTAIN, MAP_SIZES, TILE } from '../constants.js';
import { PX } from '../math/fixed.js';
import { PLANETS } from './planets.js';

const LEVEL_OF = Object.freeze({ '~': WATER, '.': GROUND, '+': PLATEAU, '^': MOUNTAIN });

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

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const n = rows.length;
  if (!MAP_SIZES.includes(n)) {
    problems.push(`it is ${n} tiles tall; the sizes are ${MAP_SIZES.join(', ')}`);
  }
  const levels = new Uint8Array(n * n);
  rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== n) {
      problems.push(`row ${y} isn't ${n} tiles wide`);
      return;
    }
    for (let x = 0; x < n; x++) {
      const level = LEVEL_OF[row[x]];
      if (level === undefined) problems.push(`row ${y}, column ${x}: "${row[x]}" isn't a tile`);
      else levels[y * n + x] = level;
    }
  });

  // Levels only meet their neighbors (spec 02, Slopes), corners included,
  // because a slope reaches into the tiles that touch it diagonally.
  if (problems.length === 0) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const a = levels[y * n + x];
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const bx = (x + dx + n) % n;
          const by = (y + dy + n) % n;
          const b = levels[by * n + bx];
          if (Math.abs(a - b) > 1) {
            problems.push(`tiles (${x}, ${y}) and (${bx}, ${by}) are two levels apart`);
          }
        }
      }
    }
  }

  const size = n * TILE;
  const vents = [];
  for (const [k, vent] of (Array.isArray(data?.vents) ? data.vents : []).entries()) {
    const diameter = VENT_SIZES[vent?.size];
    const inside = (v) => Number.isInteger(v) && v >= 0 && v < n * (TILE / PX);
    if (!diameter || !inside(vent.x) || !inside(vent.y)) {
      problems.push(`vent ${k} needs whole-pixel x and y on the map and a size of large, medium or small`);
    } else {
      vents.push(Object.freeze({ x: vent.x * PX, y: vent.y * PX, radius: (diameter * PX) / 2 }));
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
    levels,
    plateauHeight: planet.plateau,
    mountainHeight: planet.mountain,
    vents: Object.freeze(vents),
  });
}

// A map from a picture of its tiles, for tests and tools. `rows` may be
// smaller than the map; the rest is filled with `fill`.
export function sketchMap({ tiles = 32, planet = 'tundra', fill = '.', rows = [], at = [0, 0], ...rest } = {}) {
  const grid = Array.from({ length: tiles }, () => Array(tiles).fill(fill));
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) grid[(at[1] + y) % tiles][(at[0] + x) % tiles] = row[x];
  });
  return loadMap({
    name: 'Sketch',
    players: 2,
    planet,
    ...rest,
    rows: grid.map((r) => r.join('')),
  });
}
