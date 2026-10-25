// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Generated maps and the maps that come with the game (spec 02,
// Generated maps, Maps that come with the game, Start positions,
// Energy Vents; decisions D46, D47).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, resolveSettings, rng, STYLES } from '../../src/mapgen/generate.js';
import { loadMap } from '../../src/rules/terrain/map.js';
import { sampleTerrain } from '../../src/rules/terrain/terrain.js';
import { FLAT, PX, MAP_SIZES } from '../../src/rules/constants.js';
import { PLANETS } from '../../src/rules/terrain/planets.js';
import { MAPS, mapData } from '../../src/maps/index.js';
import { RECIPES, buildMaps } from '../../tools/make-maps.js';

const settings = (o = {}) => ({ style: 'grown', tiles: 32, planet: 'tundra', energy: 2, terrain: 2, water: 2, ...o });

// Whether a disc of the map, in pixels, is flat ground all over.
function flatDisc(map, x, y, r) {
  for (let dy = -r; dy <= r; dy += 5) {
    for (let dx = -r; dx <= r; dx += 5) {
      if (dx * dx + dy * dy > r * r) continue;
      if (sampleTerrain(map, (x + dx) * PX, (y + dy) * PX).type !== FLAT) return false;
    }
  }
  return true;
}

function checkMap(m) {
  const map = loadMap(mapData(m));
  for (const [players, layouts] of [[2, ['']], [3, ['', '2']], [4, ['', '2+2', '3']]]) {
    for (const layout of layouts) {
      const groups = m.starts[players]?.[layout];
      assert.ok(groups, `${m.name}: starts for ${players} players, layout "${layout}"`);
      assert.equal(groups.flat().length, players);
    }
  }
  const starts = m.starts[4][''].flat();
  assert.equal(new Set(starts.map((p) => `${p.x},${p.y}`)).size, 4);
  for (const p of starts) assert.ok(flatDisc(map, p.x, p.y, 40), `${m.name}: start ${p.x},${p.y} is on flat ground`);
  for (const v of m.vents) assert.ok(flatDisc(map, v.x, v.y, { large: 55, medium: 40, small: 22 }[v.size]), `${m.name}: vent ${v.x},${v.y} lies on flat ground`);
  return map;
}

test('the same settings and seed always give the same map; another seed, another map', () => {
  const a = generateMap(settings(), 7);
  assert.deepEqual(generateMap(settings(), 7), a);
  assert.notDeepEqual(generateMap(settings(), 8).rows, a.rows);
});

test('every style, size and water step gives a valid map: starts and vents on flat ground', () => {
  for (const style of STYLES) {
    for (const tiles of MAP_SIZES) {
      for (const water of [0, 2, 4]) {
        const m = generateMap(settings({ style, tiles, water, terrain: water === 4 ? 4 : 1, energy: water }), tiles + water);
        checkMap(m);
        assert.equal(m.rows.length, tiles);
        assert.ok(m.vents.length > 0);
      }
    }
  }
});

test('the planet sets the heights, and nothing else', () => {
  for (const planet of Object.keys(PLANETS)) {
    const m = generateMap(settings({ planet }), 3);
    assert.equal(loadMap(mapData(m)).plateauHeight, PLANETS[planet].plateau);
    assert.deepEqual(m.rows, generateMap(settings(), 3).rows);
  }
});

test('the mirrored style: every quarter the same, so every start has the same surroundings', () => {
  const m = generateMap(settings({ style: 'mirror', tiles: 48 }), 12);
  const n = m.rows.length;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      assert.equal(m.rows[y][x], m.rows[y][n - 1 - x]);
      assert.equal(m.rows[y][x], m.rows[n - 1 - y][x]);
    }
  }
  const size = n * 60;
  const key = (v) => `${v.x},${v.y},${v.size}`;
  const vents = new Set(m.vents.map(key));
  for (const v of m.vents) {
    assert.ok(vents.has(key({ ...v, x: size - v.x })));
    assert.ok(vents.has(key({ ...v, y: size - v.y })));
  }
  const [[a], [b], [c], [d]] = m.starts[4][''];
  assert.deepEqual([b.x, b.y], [size - a.x, a.y]);
  assert.deepEqual([c.x, c.y], [a.x, size - a.y]);
  assert.deepEqual([d.x, d.y], [size - a.x, size - a.y]);
});

// Land regions, joined across edges and corners.
function islands(rows) {
  const n = rows.length;
  const seen = new Uint8Array(n * n);
  let count = 0;
  for (let k = 0; k < n * n; k++) {
    if (seen[k] || rows[Math.floor(k / n)][k % n] === '~') continue;
    count += 1;
    const stack = [k];
    seen[k] = 1;
    while (stack.length) {
      const t = stack.pop();
      const x = t % n;
      const y = Math.floor(t / n);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const u = ((y + dy + n) % n) * n + ((x + dx + n) % n);
          if (!seen[u] && rows[Math.floor(u / n)][u % n] !== '~') {
            seen[u] = 1;
            stack.push(u);
          }
        }
      }
    }
  }
  return count;
}

test('water: none at the low end; at the high end the map breaks into islands', () => {
  for (const style of STYLES) {
    assert.ok(!generateMap(settings({ style, water: 0 }), 4).rows.join('').includes('~'));
    const broken = [1, 2, 3, 4, 5].filter((seed) => islands(generateMap(settings({ style, tiles: 48, water: 4 }), seed).rows) >= 3);
    assert.ok(broken.length >= 4, `${style}: islands on ${broken.length} of 5 maps`);
  }
});

test('more energy, more vents', () => {
  const vents = (energy) => generateMap(settings({ style: 'grown', tiles: 48, energy, water: 0 }), 9).vents.length;
  assert.ok(vents(0) < vents(2) && vents(2) < vents(4));
});

test('left to chance, Energy, Terrain and Water avoid both extremes; the rest take any value', () => {
  const r = rng(1);
  const seen = { style: new Set(), tiles: new Set(), planet: new Set(), energy: new Set(), terrain: new Set(), water: new Set() };
  for (let k = 0; k < 400; k++) {
    const s = resolveSettings({ style: 'random', tiles: 'random', planet: 'random', energy: 'random', terrain: 'random', water: 'random' }, r);
    for (const key of Object.keys(seen)) seen[key].add(s[key]);
  }
  for (const key of ['energy', 'terrain', 'water']) assert.deepEqual([...seen[key]].sort(), [1, 2, 3]);
  assert.equal(seen.style.size, STYLES.length);
  assert.equal(seen.tiles.size, MAP_SIZES.length);
  assert.equal(seen.planet.size, Object.keys(PLANETS).length);
});

test('the maps that come with the game: all five sizes, all six planets, every one valid', () => {
  assert.equal(new Set(MAPS.map((m) => m.name)).size, MAPS.length);
  assert.deepEqual(new Set(MAPS.map((m) => m.rows.length)), new Set(MAP_SIZES));
  assert.deepEqual(new Set(MAPS.map((m) => m.planet)), new Set(Object.keys(PLANETS)));
  for (const m of MAPS) checkMap(m);
});

test('the generated maps that come with the game are what tools/make-maps.js makes', () => {
  const built = buildMaps();
  assert.equal(built.length, RECIPES.length);
  for (const m of built) assert.deepEqual(MAPS.find((x) => x.name === m.name), m);
});
