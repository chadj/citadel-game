// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Builds the maps that come with the game (spec 02, Maps that come with
// the game; decision D47) with the map generator, and writes them to
// src/maps/generated.js. They're kept as data, so they stay the same
// if the generator changes later.
//
//   node tools/make-maps.js          writes the file
//   node tools/make-maps.js --show   also prints each map

import { writeFileSync } from 'node:fs';
import { generateMap } from '../src/mapgen/generate.js';
import { loadMap } from '../src/rules/terrain/map.js';

// name, then the generator's settings and seed.
export const RECIPES = [
  ['Red Steps', { style: 'mirror', tiles: 32, planet: 'canyon', energy: 2, terrain: 3, water: 1 }, 11],
  ['Twin Ridges', { style: 'mirror', tiles: 40, planet: 'plains', energy: 1, terrain: 3, water: 2 }, 23],
  ['Sump Flats', { style: 'grown', tiles: 40, planet: 'toxic', energy: 2, terrain: 1, water: 2 }, 5],
  ['Ice Shelf', { style: 'mirror', tiles: 48, planet: 'glacier', energy: 2, terrain: 2, water: 3 }, 31],
  ['Long Meadow', { style: 'grown', tiles: 48, planet: 'plains', energy: 3, terrain: 1, water: 1 }, 8],
  ['Broken Mesa', { style: 'grown', tiles: 56, planet: 'canyon', energy: 2, terrain: 4, water: 1 }, 17],
  ['Scattered Isles', { style: 'mirror', tiles: 56, planet: 'tundra', energy: 3, terrain: 2, water: 4 }, 41],
  ['Great Erg', { style: 'mirror', tiles: 64, planet: 'desert', energy: 2, terrain: 3, water: 0 }, 2],
  ['Floe Field', { style: 'grown', tiles: 64, planet: 'glacier', energy: 3, terrain: 2, water: 4 }, 13],
  ['Green Haze', { style: 'grown', tiles: 32, planet: 'toxic', energy: 2, terrain: 2, water: 0 }, 29],
];

export function buildMaps() {
  return RECIPES.map(([name, settings, seed]) => {
    const { settings: _s, seed: _seed, ...map } = generateMap(settings, seed, name);
    loadMap(map);
    return map;
  });
}

function show(map) {
  const rows = map.rows.map((r) => r.split(''));
  for (const v of map.vents) rows[Math.floor(v.y / 60)][Math.floor(v.x / 60)] = v.size[0].toUpperCase();
  map.starts[4][''].forEach(([p], k) => { rows[Math.floor(p.y / 60)][Math.floor(p.x / 60)] = String(k); });
  console.log(`\n${map.name} (${map.rows.length} tiles, ${map.planet})`);
  console.log(rows.map((r) => r.join('')).join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const maps = buildMaps();
  if (process.argv.includes('--show')) maps.forEach(show);
  const text = `// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The generated maps that come with the game (decision D47). Written by
// tools/make-maps.js: don't edit by hand.

export const GENERATED = ${JSON.stringify(maps, null, 1)};
`;
  writeFileSync(new URL('../src/maps/generated.js', import.meta.url), text);
  console.log(`wrote ${maps.length} maps`);
}
