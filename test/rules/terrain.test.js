// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMap, sketchMap } from '../../src/rules/terrain/map.js';
import { sampleTerrain } from '../../src/rules/terrain/terrain.js';
import { PLANETS } from '../../src/rules/terrain/planets.js';
import { FLAT, SLOPE, WET, TILE, SLOPE_WIDTH, CLIFF_INSET, SHORE_WIDTH, BUMP_HEIGHT, MAP_SIZES } from '../../src/rules/constants.js';
import { PX, px } from '../../src/rules/math/fixed.js';

const T = TILE / PX; // tile size in pixels
const INSET = CLIFF_INSET / PX; // a cliff's top, in from its high corners
const at = (map, xPx, yPx, pontoons) => sampleTerrain(map, px(xPx), px(yPx), pontoons);

// A Plateau block of 3 x 3 tiles, with a Mountain tile in the middle,
// at tiles (10..12, 10..12). Its corners are raised, so the high ground
// reaches INSET into the tiles around it.
const hill = () => sketchMap({ planet: 'canyon', at: [10, 10], rows: ['+++', '+^+', '+++'] });

test('Ground is flat at altitude 0', () => {
  const map = sketchMap();
  assert.deepEqual(at(map, 100, 100), { alt: 0, type: FLAT });
});

test('raised levels stand at their planet\'s heights, flat on top', () => {
  const map = hill();
  const { plateau, mountain } = PLANETS.canyon;
  assert.deepEqual(at(map, 10 * T + 5, 10 * T + 5), { alt: plateau, type: FLAT });
  assert.deepEqual(at(map, 11 * T + 30, 11 * T + 30), { alt: mountain, type: FLAT });
  assert.deepEqual(at(map, 11 * T + 1, 11 * T + 59), { alt: mountain, type: FLAT });
});

test('a slope is about 40 px wide straight across, and climbs between the levels', () => {
  const map = hill();
  const edge = 10 * T - INSET; // the Plateau's west edge
  const y = 11 * T + 30;
  const slope = SLOPE_WIDTH / PX;
  assert.equal(at(map, edge - slope - 1, y).type, FLAT);
  assert.equal(at(map, edge - slope - 1, y).alt, 0);
  assert.equal(at(map, edge - slope / 2, y).type, SLOPE);
  assert.equal(at(map, edge - 1, y).type, SLOPE);
  assert.equal(at(map, edge, y).type, FLAT);
  // The climb, ignoring the bumps, is steady.
  const mid = at(map, edge - slope / 2, y).alt;
  const half = PLANETS.canyon.plateau / 2;
  assert.ok(Math.abs(mid - half) <= BUMP_HEIGHT, `${mid} vs ${half}`);
});

test('the same width whichever way the slope faces', () => {
  const map = hill();
  const slope = SLOPE_WIDTH / PX;
  const mid = 11 * T + 30;
  const probes = [
    [10 * T - INSET - slope / 2, mid], // west
    [13 * T + INSET + slope / 2, mid], // east
    [mid, 10 * T - INSET - slope / 2], // north
    [mid, 13 * T + INSET + slope / 2], // south
  ];
  for (const [x, y] of probes) assert.equal(at(map, x, y).type, SLOPE, `${x}, ${y}`);
  const beyond = [
    [10 * T - INSET - slope - 1, mid],
    [13 * T + INSET + slope + 1, mid],
    [mid, 10 * T - INSET - slope - 1],
    [mid, 13 * T + INSET + slope + 1],
  ];
  for (const [x, y] of beyond) assert.equal(at(map, x, y).type, FLAT, `${x}, ${y}`);
});

test('a slope crossed at an angle is wider; around a corner it keeps its width', () => {
  const map = hill();
  const slope = SLOPE_WIDTH / PX;
  // Crossing the west slope at 45°: the path across is longer.
  let across = 0;
  for (let k = 0; k < 100; k++) if (at(map, 10 * T - INSET - k, 11 * T - k).type === SLOPE) across++;
  const path = across * Math.SQRT2;
  assert.ok(path > slope * 1.3, `${path}`);
  // Diagonally off the Plateau's north-west corner, the slope is about
  // as wide as anywhere (spec 02, Landforms: it stays about the same width).
  const top = 10 * T; // the corner itself
  let d = 0;
  while (at(map, top - d, top - d).type !== FLAT || at(map, top - d, top - d).alt > 0) d++;
  while (at(map, top - d, top - d).type === SLOPE || at(map, top - d, top - d).alt > 0) d++;
  const width = d * Math.SQRT2 - INSET * Math.SQRT1_2;
  assert.ok(Math.abs(width - slope) < 4, `${width}`);
});

test('the bumps are deterministic and only on slopes', () => {
  const map = hill();
  const y = 11 * T + 30;
  const samples = [];
  for (let x = 10 * T - 40; x < 10 * T; x++) samples.push(at(map, x, y).alt);
  const again = [];
  for (let x = 10 * T - 40; x < 10 * T; x++) again.push(at(map, x, y).alt);
  assert.deepEqual(again, samples);
  // A perfectly steady climb would rise every pixel; bumps break that.
  const steps = samples.slice(1).map((v, k) => v - samples[k]);
  assert.ok(steps.some((s) => s !== steps[0]), 'the climb should be rough');
});

// A lake of 3 x 3 tiles at (4..6, 4..6): the corners all around tile
// (5, 5) are water, so it's open water, and the tiles around it are
// half water, half Ground.
const lake = () => sketchMap({ at: [4, 4], rows: ['~~~', '~~~', '~~~'] });

test('water is wet at altitude 0, with a narrow shore slope on the Ground beside it', () => {
  const map = lake();
  assert.deepEqual(at(map, 5 * T + 2, 5 * T + 58), { alt: 0, type: WET });
  // In tile (4, 5) the water's edge runs down the middle.
  const y = 5 * T + 30;
  assert.deepEqual(at(map, 4 * T + 35, y), { alt: 0, type: WET });
  assert.deepEqual(at(map, 4 * T + 25, y), { alt: 0, type: SLOPE });
  assert.deepEqual(at(map, 4 * T + 25 - SHORE_WIDTH / PX, y), { alt: 0, type: FLAT });
  assert.deepEqual(at(map, 4 * T - 5, y), { alt: 0, type: FLAT });
});

test('channels and ponds are water in Ground tiles', () => {
  // A channel down tile column 3 (every tile's north edge crossed), and a
  // pond in tile (8, 8).
  const map = sketchMap({ water: Array(32).fill('...1') });
  const pond = sketchMap({ at: [8, 8], water: ['4'] });
  for (const y of [5, 100, 1000]) {
    assert.equal(at(map, 3 * T + 30, y).type, WET);
    assert.equal(at(map, 3 * T + 44, y).type, WET);
    assert.equal(at(map, 3 * T + 46, y).type, SLOPE);
    assert.equal(at(map, 4 * T + 1, y).type, FLAT);
  }
  assert.equal(at(pond, 8 * T + 30, 8 * T + 30).type, WET);
  assert.equal(at(pond, 8 * T + 30, 8 * T).type, FLAT);
});

test('a Pontoon makes its whole tile flat ground at its top', () => {
  const map = lake();
  const pontoons = new Map([[5 * 32 + 5, px(10)]]);
  assert.deepEqual(at(map, 5 * T + 2, 5 * T + 58, pontoons), { alt: px(10), type: FLAT });
  assert.deepEqual(at(map, 5 * T + 2, 5 * T + 58), { alt: 0, type: WET });
});

test('the terrain wraps around every edge', () => {
  const map = sketchMap({ at: [31, 31], rows: ['+'] });
  const size = 32 * T;
  // Just inside tile (0, 0), which touches the Plateau across the corner.
  assert.equal(at(map, 5, 5).type, SLOPE);
  assert.deepEqual(at(map, size + 31 * T + 30, -T + 30), at(map, 31 * T + 30, 31 * T + 30));
});

test('map checks', () => {
  // At most two neighboring levels in a tile (spec 02, Landforms).
  assert.throws(() => sketchMap({ rows: ['.^'] }), /mixes Ground, Mountain/);
  assert.throws(() => sketchMap({ corners: ['~+', '~+'] }), /mixes water, Plateau/);
  assert.throws(() => sketchMap({ corners: ['~', '.+'] }), /mixes water, Ground, Plateau/); // diagonal
  // No water in a tile with a cliff.
  assert.throws(() => sketchMap({ at: [5, 5], corners: ['+'], water: ['4'] }), /tile \(5, 5\) has water and a cliff/);
  assert.throws(() => sketchMap({ at: [5, 5], corners: ['+'], water: ['.', '1'] }), /tile \(5, 5\) has water and a cliff/);
  assert.throws(() => sketchMap({ planet: 'venus' }), /isn't a planet/);
  assert.throws(() => sketchMap({ tiles: 33 }), /sizes are/);
  assert.throws(() => sketchMap({ corners: ['x'] }), /isn't a level/);
  assert.throws(() => sketchMap({ water: ['9'] }), /isn't a water mark/);
  assert.throws(() => loadMap({ name: '', players: 5, planet: 'tundra', corners: [] }), /no name[\s\S]*players/);
  assert.throws(() => sketchMap({ vents: [{ x: 10, y: 10, size: 'huge' }] }), /vent 0/);
  assert.throws(() => sketchMap({ craters: [{ x: 10, y: 10, r: 0 }] }), /crater 0/);
  const map = sketchMap({ vents: [{ x: 100, y: 200, size: 'large' }] });
  assert.deepEqual(map.vents, [{ x: px(100), y: px(200), radius: px(55) }]);
  for (const tiles of MAP_SIZES) assert.equal(sketchMap({ tiles }).size, tiles * TILE);
});
