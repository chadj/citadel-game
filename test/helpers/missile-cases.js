// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Spec 06's chase targets, measured with the rules' own missiles.
// Shared by the tests and tools/calibrate-missile.js.

import { applyMove, step } from '../../src/rules/game.js';
import { addUnit, citadelOf } from '../../src/rules/units.js';
import { PX, TICKS_PER_SECOND } from '../../src/rules/constants.js';
import { makeGame } from './setups.js';

// Flies one Outpost Shell east past an enemy Interceptor at (ix, iy),
// pixels from P1's Citadel at (300, 300). Returns the chase's length in
// seconds from firing, or null if it wasn't caught, and whether it fired.
export function chase({ power, ix, iy }) {
  const game = makeGame();
  addUnit(game.state, { kind: 'interceptor', owner: 1, x: (300 + ix) * PX, y: (300 + iy) * PX, base: 0 });
  applyMove(game, { type: 'launch', player: 0, launcher: citadelOf(game.state, 0).id, item: 'shell', heading: 0, power });
  let fired = null;
  let caught = null;
  for (let t = 1; game.state.phase === 'flight' && t < 2000; t++) {
    const before = game.events.length;
    step(game);
    for (const e of game.events.slice(before)) {
      if (e.type === 'interceptorFired') fired = t;
      if (e.type === 'caught') caught = t;
    }
  }
  return { fired: fired !== null, seconds: caught === null ? null : (caught - fired) / TICKS_PER_SECOND };
}

// A spread of typical chases: shots at several powers past
// Interceptors along and beside their paths.
export function chaseCases() {
  const cases = [];
  for (const power of [300, 600, 1000]) {
    for (const ix of [120, 250, 400, 550]) {
      for (const iy of [0, 80, 150]) cases.push({ power, ix, iy, ...chase({ power, ix, iy }) });
    }
  }
  return cases.filter((c) => c.fired);
}
