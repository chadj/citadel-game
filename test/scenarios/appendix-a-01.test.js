// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 01 — Launching and flight. Flat Ground, no wind, from an
// Outpost, unless a scenario says otherwise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWind, BATTERY } from '../../src/rules/flight.js';
import { WIND_STRONG, POWER_MAX } from '../../src/rules/constants.js';
import { fly } from '../helpers/flight-cases.js';

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

test.todo('two shots with the same displayed aim and meter can land in different places (the meter and aim display come with the client, M6)');
