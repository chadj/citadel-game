// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, destroyUnit, turnLimit } from '../../src/rules/game.js';
import { addUnit, citadelOf, isWorking } from '../../src/rules/units.js';
import { cycleEnd } from '../../src/rules/effects.js';
import { roundIncome } from '../../src/rules/energy.js';
import { PX } from '../../src/rules/constants.js';
import { makeGame, play, pass, timeout, shell, whoseTurn } from '../helpers/setups.js';

const energy = (game, p) => game.state.players[p].energy;

test('a new game: 11 energy each, a Citadel at each start, the first seat to play', () => {
  const game = makeGame({ players: 3, order: [2, 0, 1] });
  assert.deepEqual(game.state.players.map((p) => p.energy), [110, 110, 110]);
  const citadels = game.state.units.filter((u) => u.citadel);
  assert.deepEqual(citadels.map((u) => [u.owner, u.x / PX, u.y / PX]), [[0, 300, 300], [1, 1300, 300], [2, 300, 1300]]);
  assert.equal(whoseTurn(game), 2);
  assert.equal(game.state.turn.limit, 66000);
});

test('a launch costs its level, and the turn passes once it lands', () => {
  const game = makeGame();
  shell(game);
  assert.equal(energy(game, 0), 100);
  assert.equal(whoseTurn(game), 1);
  assert.ok(game.events.some((e) => e.type === 'land'));
});

test('launches that don\'t count leave the game unchanged', () => {
  const game = makeGame();
  const citadel = citadelOf(game.state, 0).id;
  const other = citadelOf(game.state, 1).id;
  const launch = (m) => applyMove(game, { type: 'launch', player: 0, launcher: citadel, item: 'shell', heading: 0, power: 500, ...m });
  assert.match(launch({ player: 1, launcher: other }).reason, /isn't that player's turn/);
  assert.match(launch({ launcher: other }).reason, /isn't one of your launchers/);
  assert.match(launch({ item: 'castle' }).reason, /no such item/);
  assert.match(launch({ heading: 360 }).reason, /heading/);
  assert.match(launch({ heading: 1.5 }).reason, /heading/);
  assert.match(launch({ power: 1001 }).reason, /power/);
  game.state.players[0].energy = 60;
  assert.match(launch({ item: 'outpost' }).reason, /not enough energy/);
  citadelOf(game.state, 0).disabledUntil = 99;
  assert.match(launch({}).reason, /disabled/);
  assert.equal(whoseTurn(game), 0);
  assert.equal(game.state.phase, 'turn');
});

test('a Battery launches only the attacking weapons', () => {
  const game = makeGame();
  const battery = addUnit(game.state, { kind: 'battery', owner: 0, x: 400 * PX, y: 400 * PX, base: 0 });
  const launch = (item) => applyMove(game, { type: 'launch', player: 0, launcher: battery.id, item, heading: 0, power: 0 });
  for (const item of ['outpost', 'interceptor', 'repair', 'salvager', 'pontoon', 'skyProbe']) {
    assert.match(launch(item).reason, /only the attacking weapons/, item);
  }
  assert.ok(launch('rover').ok);
});

test('no moves while a shot is in the air', () => {
  const game = makeGame();
  applyMove(game, { type: 'launch', player: 0, launcher: citadelOf(game.state, 0).id, item: 'shell', heading: 0, power: 0 });
  assert.match(applyMove(game, { type: 'pass', player: 0 }).reason, /wait/);
});

test('passing puts energy aside; it shows 0 and comes back at the round\'s end', () => {
  const game = makeGame();
  pass(game);
  assert.equal(energy(game, 0), 0);
  assert.equal(game.state.players[0].aside, 110);
  assert.equal(game.state.players[0].inRound, false);
  assert.equal(whoseTurn(game), 1);
  pass(game);
  assert.equal(game.state.round, 2);
  assert.equal(energy(game, 0), 180);
  assert.equal(game.state.players[0].aside, 0);
});

test('a timeout costs 1, and the player stays in the round', () => {
  const game = makeGame();
  timeout(game);
  assert.equal(energy(game, 0), 100);
  assert.equal(game.state.players[0].inRound, true);
  pass(game);
  assert.equal(whoseTurn(game), 0);
});

test('a player who can\'t afford anything is out for the round', () => {
  const game = makeGame();
  game.state.players[0].energy = 15;
  shell(game); // 15 - 10 = 5, below 1
  assert.equal(game.state.players[0].inRound, false);
  pass(game);
  assert.equal(game.state.round, 2);
  assert.equal(energy(game, 0), 75);
});

test('the order shifts by one each round, skipping players out of the game', () => {
  const game = makeGame({ players: 3 });
  const firsts = [];
  for (let r = 0; r < 4; r++) {
    firsts.push(whoseTurn(game));
    if (r < 3) {
      pass(game);
      pass(game);
      pass(game);
    }
  }
  assert.deepEqual(firsts, [0, 1, 2, 0]);

  // In round 4, P2 is knocked out. P1 passes, P2 is skipped, P3 passes.
  destroyUnit(game, citadelOf(game.state, 1), null);
  pass(game);
  assert.equal(whoseTurn(game), 2);
  pass(game);
  // Round 5 would start with P2, but P2 is out of the game, so P3 starts.
  assert.equal(game.state.round, 5);
  assert.equal(whoseTurn(game), 2);
});

test('the energy cap applies to income', () => {
  const game = makeGame();
  game.state.players[0].energy = 330;
  pass(game);
  pass(game);
  assert.equal(energy(game, 0), 350);
});

test('income: 7 from the Citadel, 3 per working Extractor on a vent, 1 off one, 0 if disabled', () => {
  const game = makeGame();
  const at = { owner: 0, x: 0, y: 0, base: 0 };
  addUnit(game.state, { kind: 'extractor', ...at }).onVent = true;
  addUnit(game.state, { kind: 'extractor', ...at }).onVent = true;
  addUnit(game.state, { kind: 'extractor', ...at }).onVent = false;
  const off = addUnit(game.state, { kind: 'extractor', ...at });
  off.onVent = true;
  off.disabledUntil = 99;
  assert.equal(roundIncome(game.state, 0), 70 + 30 + 30 + 10);
});

test('the shot clock: the setting plus about 10%, none when off, 10 s with no working launcher', () => {
  assert.equal(turnLimit(60, false, null), 66000);
  assert.equal(turnLimit(30, false, null), 33000);
  assert.equal(turnLimit(15, false, null), 16500);
  assert.equal(turnLimit(0, false, null), null);
  assert.equal(turnLimit(0, true, null), 10000);
  assert.equal(turnLimit(60, true, 66000), 10000);
});

test('back-to-back turns get three quarters of the last limit, down to 10 s', () => {
  const game = makeGame({ clock: 15 });
  shell(game);
  pass(game); // P2 passes; P1 has the round to themself
  assert.equal(game.state.turn.limit, 16500);
  const limits = [];
  for (let k = 0; k < 4; k++) {
    shell(game);
    limits.push(game.state.turn.limit);
  }
  assert.deepEqual(limits, [12375, 10000, 10000, 10000]);
});

test('a player with no working launcher gets 10 s, even with the clock off', () => {
  const game = makeGame({ clock: 0 });
  assert.equal(game.state.turn.limit, null);
  citadelOf(game.state, 1).disabledUntil = cycleEnd(game.state);
  pass(game);
  assert.equal(game.state.turn.noLauncher, true);
  assert.equal(game.state.turn.limit, 10000);
});

test('a disconnected player passes if it was their turn, then is skipped and earns nothing', () => {
  const game = makeGame({ players: 3 });
  play(game, { type: 'disconnect', player: 0 });
  assert.equal(whoseTurn(game), 1);
  assert.equal(game.state.players[0].mark, 'left');
  pass(game);
  pass(game);
  // Round 2 would start with P2; P1 never plays, and lost what was put aside.
  assert.equal(energy(game, 0), 0);
  assert.equal(game.state.players[0].aside, 0);
  for (let k = 0; k < 6; k++) {
    assert.notEqual(whoseTurn(game), 0);
    pass(game);
  }
});

test('a disconnect during someone else\'s turn takes effect at the change of turn', () => {
  const game = makeGame({ players: 3 });
  play(game, { type: 'disconnect', player: 1 });
  assert.equal(whoseTurn(game), 0);
  pass(game);
  assert.equal(whoseTurn(game), 2);
  assert.match(applyMove(game, { type: 'disconnect', player: 1 }).reason, /already/);
});

test('the newest mark replaces the older one', () => {
  const game = makeGame({ players: 3 });
  destroyUnit(game, citadelOf(game.state, 2), 0);
  assert.equal(game.state.players[2].mark, 'out');
  play(game, { type: 'disconnect', player: 2 });
  assert.equal(game.state.players[2].mark, 'left');
});

test('the Citadel bonus: 7 at once to the credited player, capped, never for one\'s own side', () => {
  const game = makeGame({ players: [{ team: 'a' }, { team: 'b' }, { team: 'a' }, { team: 'b' }] });
  game.state.players[0].energy = 300;
  destroyUnit(game, citadelOf(game.state, 1), 0);
  assert.equal(energy(game, 0), 350);
  destroyUnit(game, citadelOf(game.state, 2), 0); // a teammate's
  assert.equal(energy(game, 0), 350);
  game.state.players[3].energy = 50;
  destroyUnit(game, citadelOf(game.state, 0), 3);
  assert.equal(energy(game, 3), 120);
});

test('a team stays in while any member has a Citadel; the last team wins, even if only computers are left', () => {
  const game = makeGame({ players: [{}, { team: 'b', computer: true }, { team: 'b', computer: true }] });
  destroyUnit(game, citadelOf(game.state, 1), 0);
  pass(game);
  assert.equal(game.state.phase, 'turn');
  destroyUnit(game, citadelOf(game.state, 0), 2);
  pass(game);
  assert.equal(game.state.phase, 'over');
  assert.deepEqual(game.state.result, { winner: 1 });
});

test('with two sides left but no connected human, the game ends with no winner', () => {
  const game = makeGame({ players: [{}, { computer: true }, { computer: true }] });
  play(game, { type: 'disconnect', player: 0 });
  assert.equal(game.state.phase, 'over');
  assert.deepEqual(game.state.result, { winner: null });
  assert.match(applyMove(game, { type: 'pass', player: 1 }).reason, /over/);
});

test('the game checks for its end only at a change of turn', () => {
  const game = makeGame();
  destroyUnit(game, citadelOf(game.state, 1), 0);
  assert.equal(game.state.phase, 'turn');
  pass(game);
  assert.equal(game.state.phase, 'over');
  assert.deepEqual(game.state.result, { winner: 0 });
});

test('an effect started during back-to-back turns lasts through the next one, and is gone by the one after', () => {
  const game = makeGame();
  pass(game); // P1 passes; P2 plays back to back
  shell(game);
  const own = citadelOf(game.state, 1);
  own.disabledUntil = cycleEnd(game.state); // as if disabled during this turn
  // (the launch already played out; mark the effect, then end the turn)
  timeout(game);
  assert.equal(whoseTurn(game), 1);
  assert.equal(isWorking(game.state, own), false);
  timeout(game);
  assert.equal(isWorking(game.state, own), true);
});

test('income is paid before effects wear off at the round\'s end', () => {
  const game = makeGame();
  pass(game);
  // P2's own Extractor, disabled during P2's turn: it wears off as play
  // leaves P2's seat after a full lap.
  const ex = addUnit(game.state, { kind: 'extractor', owner: 1, x: 0, y: 0, base: 0 });
  ex.onVent = true;
  ex.disabledUntil = cycleEnd(game.state);
  timeout(game); // back to back: P2 again
  game.state.players[1].energy = 50;
  pass(game); // P2's turn ends the round; the effect is due now
  assert.equal(isWorking(game.state, ex), true);
  assert.equal(energy(game, 1), 50 + 70); // but it earned nothing
});
