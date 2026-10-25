// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 03 — Turns, rounds and energy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destroyUnit } from '../../src/rules/game.js';
import { citadelOf, isWorking } from '../../src/rules/units.js';
import { cycleEnd } from '../../src/rules/effects.js';
import { makeGame, pass, timeout, shell, whoseTurn } from '../helpers/setups.js';

test('a first round, two players, clock at 60', () => {
  const game = makeGame({ clock: 60 });
  const p = game.state.players;
  assert.equal(whoseTurn(game), 0);

  // 1. P1 launches an Outpost: 11 − 7 = 4.
  shell(game, 'outpost');
  assert.equal(p[0].energy, 40);

  // 2. P2 passes. P2's 11 is put aside, and shows as 0. P2 is out for
  //    the round.
  pass(game);
  assert.equal(p[1].energy, 0);
  assert.equal(p[1].aside, 110);
  assert.equal(p[1].inRound, false);

  // 3. P1 launches a Shell: 4 − 1 = 3. P1 now has the round to themself.
  assert.equal(whoseTurn(game), 0);
  assert.equal(game.state.turn.limit, 66000);
  shell(game);
  assert.equal(p[0].energy, 30);

  // 4. P1's next turn gets about three quarters of the last one's time.
  //    P1 lets the clock run out: 3 − 1 = 2. P1 is still in the round.
  assert.equal(whoseTurn(game), 0);
  assert.equal(game.state.turn.limit, 49500);
  timeout(game);
  assert.equal(p[0].energy, 20);
  assert.equal(p[0].inRound, true);

  // 5. P1 passes. The round ends.
  assert.equal(whoseTurn(game), 0);
  pass(game);
  assert.equal(game.state.round, 2);

  // 6. Income: P1 gets 2 + 7 = 9. P2 gets 11 + 7 = 18.
  assert.equal(p[0].energy, 90);
  assert.equal(p[1].energy, 180);

  // 7. Round 2 starts with P2.
  assert.equal(whoseTurn(game), 1);
  assert.equal(game.state.turn.limit, 66000);
});

test('the cap: a player with 33 who passes gets 33 + 7 = 40, capped at 35', () => {
  const game = makeGame();
  game.state.players[0].energy = 330;
  pass(game);
  pass(game);
  assert.equal(game.state.players[0].energy, 350);
});

// In a four-player game, P2's Pulse disables P3's launcher during P2's
// turn. (The Pulse itself comes in M4; here its effect is set directly.)
function pulseOnP3(game) {
  pass(game); // P1
  assert.equal(whoseTurn(game), 1);
  const launcher = citadelOf(game.state, 2);
  launcher.disabledUntil = cycleEnd(game.state);
  timeout(game); // P2's turn ends
  return launcher;
}

test('a turn cycle: P3\'s launcher comes back once play has moved past P2\'s next turn', () => {
  const game = makeGame({ players: 4 });
  const launcher = pulseOnP3(game);

  // On P3's next turn, the launcher is still disabled.
  assert.equal(whoseTurn(game), 2);
  assert.equal(isWorking(game.state, launcher), false);
  assert.equal(game.state.turn.noLauncher, true);
  timeout(game); // P3
  timeout(game); // P4
  // P1 has passed; P2's next turn comes, and it's still disabled.
  assert.equal(whoseTurn(game), 1);
  assert.equal(isWorking(game.state, launcher), false);
  timeout(game); // P2's next turn ends
  // It works again.
  assert.equal(whoseTurn(game), 2);
  assert.equal(isWorking(game.state, launcher), true);
});

test('a turn cycle: if P4 is knocked out in between, it still comes back at the same point', () => {
  const game = makeGame({ players: 4 });
  const launcher = pulseOnP3(game);
  destroyUnit(game, citadelOf(game.state, 3), 1);
  assert.equal(whoseTurn(game), 2);
  timeout(game); // P3; P4's empty seat is passed over
  assert.equal(whoseTurn(game), 1);
  assert.equal(isWorking(game.state, launcher), false);
  timeout(game); // P2's next turn ends
  assert.equal(whoseTurn(game), 2);
  assert.equal(isWorking(game.state, launcher), true);
});

test('a turn cycle: if P2 is knocked out, the effect still ends as play passes P2\'s empty seat', () => {
  const game = makeGame({ players: 4 });
  const launcher = pulseOnP3(game);
  destroyUnit(game, citadelOf(game.state, 1), 3);
  timeout(game); // P3
  assert.equal(isWorking(game.state, launcher), false);
  timeout(game); // P4; play then passes P1 (passed) and P2 (out) to P3
  assert.equal(whoseTurn(game), 2);
  assert.equal(isWorking(game.state, launcher), true);
});
