// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 02 — The map and terrain.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { px } from '../../src/rules/math/fixed.js';
import { fly, raisedLauncher } from '../helpers/flight-cases.js';

test('a full-power shot from ground about 75 px above the target lands about 540 px away', () => {
  const { distance } = fly({ env: raisedLauncher(px(75)) });
  assert.ok(Math.abs(distance - 540) <= 30, `got ${distance.toFixed(1)}`);
});

// These need buildings, Pontoons and Extractors (M3).
test.todo('a building whose landing point is on a slope fails; one on flat ground with only its edge over the slope lands');
test.todo('a building that comes down on water sinks; a Pontoon moves to the center of its tile, and a building launched onto it lands');
test.todo('an Extractor just overlapping a vent earns 3 a round; one well clear earns 1');
test.todo('a Pontoon destroyed under a conduit burns it both ways; the far building goes, the launcher survives');
