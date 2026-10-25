// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 04 — Units.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, step } from '../../src/rules/game.js';
import { citadelOf, findUnit } from '../../src/rules/units.js';
import { EXTRACTOR_BLAST, CHARGE_BLAST } from '../../src/rules/constants.js';
import { makeGame, pass } from '../helpers/setups.js';
import { place, destroyAndSettle, launchAt, richPlayers, settleEvents, landingPx } from '../helpers/build.js';

test('an Extractor\'s blast: 5 to an Outpost about 100 px away, a Barrier destroyed, another Extractor set off; an Outpost about 250 px away untouched', () => {
  const game = makeGame();
  const extractor = place(game, 'extractor', 1, 800, 800);
  const outpost = place(game, 'outpost', 1, 900, 800);
  const barrier = place(game, 'barrier', 1, 700, 800, { armor: 30 });
  const second = place(game, 'extractor', 1, 800, 700);
  const far = place(game, 'outpost', 1, 1050, 800);

  const events = destroyAndSettle(game, extractor);
  const blasts = events.filter((e) => e.type === 'blast');
  assert.equal(blasts.length, 2, 'the second Extractor explodes in turn');
  const at = (pred) => events.findIndex(pred);
  assert.ok(at((e) => e.type === 'blast') > at((e) => e.type === 'destroy' && e.unit === extractor.id));
  for (const u of [outpost, barrier, second]) assert.equal(findUnit(game.state, u.id), null);
  assert.equal(findUnit(game.state, far.id).armor, 50, 'the far Outpost isn\'t touched');
  assert.equal(EXTRACTOR_BLAST.delay, 24, 'about 0.8 s');
});

test('a disabled Extractor destroyed the same way doesn\'t explode', () => {
  const game = makeGame();
  const extractor = place(game, 'extractor', 1, 800, 800, { disabledUntil: 99 });
  const outpost = place(game, 'outpost', 1, 900, 800);
  const events = destroyAndSettle(game, extractor);
  assert.ok(!events.some((e) => e.type === 'blast'));
  assert.equal(findUnit(game.state, outpost.id).armor, 50);
});

test('a Charge going off: an enemy Shell about 50 px above it is destroyed with no effect; 0.5 s later every unit within about 90 px takes 3', () => {
  const game = makeGame();
  const citadel = citadelOf(game.state, 0);
  // Where the Shell comes down, and a point on its way there.
  const { x } = landingPx(game, citadel, 0, 400);
  const charge = place(game, 'charge', 1, x - 70, 300, { armed: true });
  const near = place(game, 'outpost', 1, x - 70, 360);
  const far = place(game, 'outpost', 1, x - 70, 500);

  assert.ok(applyMove(game, { type: 'launch', player: 0, launcher: citadel.id, item: 'shell', heading: 0, power: 400 }).ok);
  let setOffAt = null;
  let shellZ = null;
  let blastAt = null;
  for (let t = 1; game.state.phase === 'flight'; t++) {
    const before = game.events.length;
    const z = game.state.shots[0]?.z;
    step(game);
    for (const e of game.events.slice(before)) {
      if (e.type === 'chargeHit') {
        setOffAt = t;
        shellZ = z;
      }
      if (e.type === 'blast') blastAt = t;
    }
  }
  assert.ok(setOffAt, 'the Shell sets the Charge off');
  assert.ok(shellZ / 1024 > 40, `the Shell was about ${Math.round(shellZ / 1024)} px up`);
  assert.ok(!game.events.some((e) => e.type === 'explosion' || e.type === 'crater'), 'the Shell does nothing of its own');
  assert.equal(blastAt - setOffAt, CHARGE_BLAST.delay);
  assert.equal(findUnit(game.state, charge.id), null);
  assert.equal(findUnit(game.state, near.id).armor, 20);
  assert.equal(findUnit(game.state, far.id).armor, 50);
});

test('a new Barrier shows no dome until the turn passes; from then on it stops enemy shots', () => {
  const game = makeGame();
  richPlayers(game);
  pass(game); // P2 builds first
  const p2 = citadelOf(game.state, 1);
  applyMove(game, { type: 'launch', player: 1, launcher: p2.id, item: 'barrier', heading: 180, power: 1000 });
  let barrier = null;
  while (!barrier) {
    step(game);
    barrier = game.state.units.find((u) => u.kind === 'barrier');
  }
  assert.equal(barrier.up, false, 'no dome as it lands');
  const events = settleEvents(game);
  assert.ok(events.some((e) => e.type === 'barrierUp'));
  assert.equal(barrier.up, true);

  // P1's next round: a Shell into the dome is stopped.
  pass(game); // the round ends; P2 starts the next one
  pass(game);
  const target = { x: barrier.x / 1024, y: barrier.y / 1024 };
  const shot = launchAt(game, 'shell', target.x - 30, target.y);
  assert.ok(shot.events.some((e) => e.type === 'stopped'));
  assert.ok(!shot.events.some((e) => e.type === 'explosion'));
});
