// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 01 — Launching and flight. Flat Ground, no wind, from an
// Outpost, unless a scenario says otherwise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWind, BATTERY } from '../../src/rules/flight.js';
import { WIND_STRONG, POWER_MAX } from '../../src/rules/constants.js';
import { fly } from '../helpers/flight-cases.js';
import { AIM_FINE, markHeading, moveHeading } from '../../src/client/core/aim.js';
import { meterPower, meterShown } from '../../src/client/core/meter.js';

const near = (got, target, within) =>
  assert.ok(Math.abs(got - target) <= within, `got ${got.toFixed(1)}, target about ${target}`);

test('a full-power shot lands about 500 px away, after about 2.5 seconds', () => {
  const shot = fly();
  near(shot.distance, 500, 25);
  near(shot.seconds, 2.5, 0.25);
});

test('from a Battery, a full-power shot lands about 900 px away', () => {
  near(fly({ launcher: BATTERY }).distance, 900, 45);
});

test('the shortest shot lands about 100 px away; the quickest tap a little further', () => {
  const shortest = fly({ power: 0 }).distance;
  near(shortest, 100, 15);
  // The quickest tap: one tick of a meter that fills in about 1.25 s.
  const tap = fly({ power: Math.round(POWER_MAX / (1.25 * 30)) }).distance;
  assert.ok(tap > shortest && tap < shortest + 30, `tap ${tap.toFixed(1)}`);
});

test('a Strong wind behind a full-power shot: about 600 px', () => {
  near(fly({ wind: makeWind(WIND_STRONG, 0) }).along, 600, 40);
});

test('a Strong wind against it: about 350 px', () => {
  near(fly({ wind: makeWind(WIND_STRONG, 180) }).along, 350, 35);
});

test('a Strong wind across it: about 500 px along and 150 px to the side', () => {
  const shot = fly({ wind: makeWind(WIND_STRONG, 90) });
  near(shot.along, 500, 30);
  near(shot.across, 150, 20);
});

test('two shots with the same displayed aim and meter can land in different places', () => {
  // Two aims the targeting marks show alike, and two releases the meter
  // shows alike.
  const aims = [Math.round(10.6 * AIM_FINE), Math.round(12.4 * AIM_FINE)];
  const powers = [meterPower(18), meterPower(19)]; // ticks held
  assert.equal(markHeading(aims[0]), markHeading(aims[1]));
  assert.equal(meterShown(powers[0]), meterShown(powers[1]));
  const a = fly({ heading: moveHeading(aims[0]), power: powers[0] });
  const b = fly({ heading: moveHeading(aims[1]), power: powers[1] });
  const apart = Math.hypot(a.landing.x - b.landing.x, a.landing.y - b.landing.y) / 1024;
  assert.ok(apart > 10, `they land ${apart.toFixed(1)} px apart`);
});
