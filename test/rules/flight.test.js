// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, stepShot, flyToGround, makeWind, launchSpeed, OUTPOST } from '../../src/rules/flight.js';
import {
  POWER_MAX, WIND_LIGHT, WIND_MEDIUM, WIND_STRONG, MEDIUM_VARIATION,
} from '../../src/rules/constants.js';
import { sketchMap } from '../../src/rules/terrain/map.js';
import { sampleTerrain } from '../../src/rules/terrain/terrain.js';
import { px } from '../../src/rules/math/fixed.js';
import { hashState } from '../../src/rules/hash.js';
import { flightCases, fly, flat, LAUNCHER_HEIGHT } from '../helpers/flight-cases.js';

for (const c of flightCases()) {
  test(`spec 01 target: ${c.name}`, () => {
    assert.ok(Math.abs(c.got - c.target) <= c.within,
      `got ${c.got.toFixed(2)}, target ${c.target} ± ${c.within}`);
  });
}

test('more power always carries further', () => {
  let last = -1;
  for (let power = 0; power <= POWER_MAX; power += 50) {
    const { distance } = fly({ power });
    assert.ok(distance > last, `power ${power}`);
    last = distance;
  }
});

test('the same launch always flies the same way', () => {
  const a = fly({ heading: 37, power: 613, wind: makeWind(WIND_MEDIUM, 211, 5000) });
  const b = fly({ heading: 37, power: 613, wind: makeWind(WIND_MEDIUM, 211, 5000) });
  assert.equal(hashState(a.landing), hashState(b.landing));
});

test('mirrored headings land at mirrored points', () => {
  for (const [h, m] of [[0, 180], [90, 270], [30, 150], [45, 315]]) {
    const a = fly({ heading: h, power: 777 });
    const b = fly({ heading: m, power: 777 });
    const sameAxis = h + m === 180; // mirrored east-west
    const ax = a.distance * Math.cos((h * Math.PI) / 180);
    const bx = b.distance * Math.cos((m * Math.PI) / 180);
    if (sameAxis) assert.ok(Math.abs(ax + bx) < 1e-9, `${h}° vs ${m}°`);
    assert.equal(a.distance, b.distance, `${h}° vs ${m}°`);
  }
});

test('a launch needs a whole-degree heading and a power from 0 to the maximum', () => {
  const base = { x: 0, y: 0, top: 0, launcher: OUTPOST };
  assert.throws(() => launch({ ...base, heading: 1.5, power: 10 }), /whole degree/);
  assert.throws(() => launch({ ...base, heading: 0, power: -1 }), /power/);
  assert.throws(() => launch({ ...base, heading: 0, power: POWER_MAX + 1 }), /power/);
  assert.throws(() => launch({ ...base, heading: 0, power: 0.5 }), /power/);
  assert.ok(launchSpeed(OUTPOST, 0) < launchSpeed(OUTPOST, POWER_MAX));
});

test('shots wrap around the map edge', () => {
  const size = px(1920);
  const env = { size, altitude: () => 0 };
  const start = { y: px(500), top: LAUNCHER_HEIGHT, heading: 0, power: POWER_MAX, launcher: OUTPOST };
  const near = flyToGround(launch({ ...start, x: size - px(100) }), null, env).landing;
  const far = flyToGround(launch({ ...start, x: px(500) }), null, { size: px(3840), altitude: () => 0 }).landing;
  assert.ok(near.x < px(500), 'it should come back in on the west side');
  assert.equal(near.x + size - (size - px(100)), far.x - px(500));
  assert.equal(near.y, far.y);
});

test('shots fired uphill fall short', () => {
  const size = px(3840);
  const uphill = {
    size,
    altitude: (x) => (x > size / 2 + px(250) ? px(40) : 0),
  };
  assert.ok(fly({ env: uphill }).distance < fly().distance - 20);
});

test('the landing point is on the ground', () => {
  const map = sketchMap({ planet: 'canyon', at: [36, 30], rows: ['++++', '++++', '++++'] });
  const env = { size: map.size, altitude: (x, y) => sampleTerrain(map, x, y).alt };
  // From the Ground, toward the Plateau about 400 px east.
  const shot = launch({ x: px(30 * 60), y: px(31 * 60 + 30), top: LAUNCHER_HEIGHT, heading: 0, power: POWER_MAX, launcher: OUTPOST });
  const { landing } = flyToGround(shot, null, env);
  assert.equal(landing.z, env.altitude(landing.x, landing.y));
  assert.ok(landing.z > 0, 'it should come down on the raised ground');
});

test('a shot that comes down this tick lands at most one tick early', () => {
  const shot = launch({ x: 0, y: 0, top: LAUNCHER_HEIGHT, heading: 0, power: 500, launcher: OUTPOST });
  let landing = null;
  let last;
  while (!landing) {
    last = shot.z;
    landing = stepShot(shot, null, flat);
  }
  assert.ok(landing.z === 0 && last > 0);
});

test('a building feels no wind until its conduit starts', () => {
  const wind = makeWind(WIND_STRONG, 90);
  const start = { x: 0, y: 0, top: LAUNCHER_HEIGHT, heading: 0, power: POWER_MAX, launcher: OUTPOST };
  const still = flyToGround(launch({ ...start, windFromStart: false }), wind, flat).landing;
  const calm = flyToGround(launch(start), null, flat).landing;
  const blown = flyToGround(launch(start), wind, flat).landing;
  assert.deepEqual(still, calm);
  assert.notEqual(blown.y, calm.y);
});

test('stronger winds push further, and Medium varies a little', () => {
  const sideways = (wind) => fly({ wind }).across;
  const light = sideways(makeWind(WIND_LIGHT, 90));
  const medium = sideways(makeWind(WIND_MEDIUM, 90));
  const strong = sideways(makeWind(WIND_STRONG, 90));
  assert.ok(light > 0 && light < medium && medium < strong);
  const low = sideways(makeWind(WIND_MEDIUM, 90, -MEDIUM_VARIATION));
  const high = sideways(makeWind(WIND_MEDIUM, 90, MEDIUM_VARIATION));
  assert.ok(low < medium && medium < high && high < strong);
  assert.throws(() => makeWind(WIND_MEDIUM, 90, MEDIUM_VARIATION + 1));
  assert.equal(makeWind(0, 90), null);
});
