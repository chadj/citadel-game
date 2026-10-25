// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMap, sketchMap } from '../../src/rules/terrain/map.js';
import { sampleTerrain } from '../../src/rules/terrain/terrain.js';
import { PLANETS } from '../../src/rules/terrain/planets.js';
import { FLAT, SLOPE, WET, TILE, SLOPE_WIDTH, BUMP_HEIGHT, MAP_SIZES } from '../../src/rules/constants.js';
import { PX, px } from '../../src/rules/math/fixed.js';

const T = TILE / PX; // tile size in pixels
const at = (map, xPx, yPx, pontoons) => sampleTerrain(map, px(xPx), px(yPx), pontoons);

// A Plateau block of 3 x 3 tiles, with a Mountain tile in the middle,
// at tiles (10..12, 10..12).
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
  const edge = 10 * T; // the Plateau's west edge
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
    [10 * T - slope / 2, mid], // west
    [13 * T + slope / 2, mid], // east
    [mid, 10 * T - slope / 2], // north
    [mid, 13 * T + slope / 2], // south
  ];
  for (const [x, y] of probes) assert.equal(at(map, x, y).type, SLOPE, `${x}, ${y}`);
  const beyond = [
    [10 * T - slope - 1, mid],
    [13 * T + slope + 1, mid],
    [mid, 10 * T - slope - 1],
    [mid, 13 * T + slope + 1],
  ];
  for (const [x, y] of beyond) assert.equal(at(map, x, y).type, FLAT, `${x}, ${y}`);
});

test('a slope crossed at a corner is wider', () => {
  const map = hill();
  const slope = SLOPE_WIDTH / PX;
  // Diagonally off the Plateau's north-west corner, further away than a
  // slope's width but still on it.
  const d = slope * 0.9;
  assert.ok(Math.hypot(d, d) > slope);
  assert.equal(at(map, 10 * T - d, 10 * T - d).type, SLOPE);
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

test('water is wet at altitude 0, with a narrow shore slope on the Ground beside it', () => {
  const map = sketchMap({ at: [5, 5], rows: ['~'] });
  assert.deepEqual(at(map, 5 * T + 30, 5 * T + 30), { alt: 0, type: WET });
  assert.deepEqual(at(map, 5 * T - 5, 5 * T + 30), { alt: 0, type: SLOPE });
  assert.deepEqual(at(map, 5 * T - 25, 5 * T + 30), { alt: 0, type: FLAT });
});

test('a Pontoon makes its whole tile flat ground at its top', () => {
  const map = sketchMap({ tiles: 32, at: [5, 5], rows: ['~'] });
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
  assert.throws(() => sketchMap({ rows: ['.^'] }), /two levels apart/);
  assert.throws(() => sketchMap({ rows: ['~+'] }), /two levels apart/);
  assert.throws(() => sketchMap({ rows: ['~', '.+'] }), /two levels apart/); // diagonal
  assert.throws(() => sketchMap({ planet: 'venus' }), /isn't a planet/);
  assert.throws(() => sketchMap({ tiles: 33 }), /sizes are/);
  assert.throws(() => sketchMap({ rows: ['x'] }), /isn't a tile/);
  assert.throws(() => loadMap({ name: '', players: 5, planet: 'tundra', rows: [] }), /no name[\s\S]*players/);
  assert.throws(() => sketchMap({ vents: [{ x: 10, y: 10, size: 'huge' }] }), /vent 0/);
  const map = sketchMap({ vents: [{ x: 100, y: 200, size: 'large' }] });
  assert.deepEqual(map.vents, [{ x: px(100), y: px(200), radius: px(55) }]);
  for (const tiles of MAP_SIZES) assert.equal(sketchMap({ tiles }).size, tiles * TILE);
});
