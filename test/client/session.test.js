// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// A game played on one machine: real time, the shot clock, the hot seat,
// computers' turns, pausing, replays and the summary (spec 03, The shot
// clock; spec 10, Hot seat, The game menu, The end of the game; spec 12,
// Replays; decision D28).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session, TICK_MS, ROUND_ANNOUNCE_MS, COMPUTER_MIN_MS } from '../../src/client/core/session.js';
import { gameStats } from '../../src/client/core/stats.js';
import { playReplay } from '../../src/rules/replay.js';
import { hashState } from '../../src/rules/hash.js';
import { citadelOf } from '../../src/rules/units.js';
import { CLOCK_START_DELAY } from '../../src/rules/constants.js';
import { makeSetup } from '../helpers/setups.js';
import { place } from '../helpers/build.js';

function run(session, ms, step = 50) {
  for (let t = 0; t < ms; t += step) session.advance(step);
}

function listen(session) {
  const seen = [];
  session.on((e) => seen.push(e));
  return seen;
}

const citadel = (session, player) => citadelOf(session.state, player).id;

test('the shot clock starts about 1.5 s into the turn, warns once at three quarters, and times the turn out', () => {
  const session = new Session(makeSetup({ clock: 15 }));
  const seen = listen(session);
  run(session, CLOCK_START_DELAY);
  assert.equal(session.clock().gone, 0);
  run(session, 16500 * 0.74);
  assert.ok(!seen.some((e) => e.type === 'clockWarning'));
  run(session, 16500 * 0.02);
  assert.equal(seen.filter((e) => e.type === 'clockWarning').length, 1);
  run(session, 16500 * 0.25);
  assert.ok(seen.some((e) => e.type === 'timeUp'));
  assert.deepEqual(session.moves, [{ type: 'timeout', player: 0 }]);
  assert.equal(session.state.turn.player, 1);
  assert.equal(session.clock().gone, 0, 'the next turn has its own clock');
});

test('pressing Launch stops the clock', () => {
  const session = new Session(makeSetup({ clock: 15 }));
  run(session, 5000);
  session.pressLaunch(0);
  run(session, 30000);
  assert.equal(session.moves.length, 0);
  session.releaseWithoutLaunch(0);
  run(session, 20000);
  assert.equal(session.moves[0].type, 'timeout');
});

test('with the clock off, there is no limit, and a reminder comes about every 30 s', () => {
  const session = new Session(makeSetup({ clock: 0 }));
  const seen = listen(session);
  run(session, CLOCK_START_DELAY + 61000, 500);
  assert.equal(seen.filter((e) => e.type === 'clockReminder').length, 2);
  assert.equal(session.moves.length, 0);
});

test('a shot flies in real time, a tick every 1/30 s', () => {
  const session = new Session(makeSetup());
  const r = session.launch({ player: 0, launcher: citadel(session, 0), item: 'shell', heading: 0, power: 500 });
  assert.ok(r.ok);
  assert.equal(session.state.phase, 'flight');
  session.advance(TICK_MS * 3 + 1);
  assert.equal(session.state.tick, 3);
  run(session, 10000, TICK_MS);
  assert.equal(session.state.phase, 'turn');
  assert.equal(session.state.turn.player, 1);
});

test('at the end of the round, Rovers wait for the announcement before they drive', () => {
  const session = new Session(makeSetup());
  place(session.game, 'rover', 0, 500, 700, { heading: 0, triggered: false });
  session.pass(0);
  const seen = listen(session);
  session.pass(1);
  assert.equal(session.state.phase, 'rovers');
  run(session, ROUND_ANNOUNCE_MS - 100);
  assert.equal(session.state.tick, 0);
  run(session, 200);
  run(session, 3000);
  assert.ok(seen.some((e) => e.type === 'roverDrives'));
  assert.equal(session.state.phase, 'turn');
});

test('hot seat: the view passes to the human whose turn it is, and stays with the last human during a computer\'s turn', () => {
  const setup = makeSetup({ players: [{}, {}, { computer: true }] });
  const think = (game, player) => ({ type: 'pass', player });
  const session = new Session(setup, { computers: { 2: { think } } });
  const seen = listen(session);
  assert.equal(session.viewer, 0);
  session.launch({ player: 0, launcher: citadel(session, 0), item: 'shell', heading: 0, power: 0 });
  run(session, 5000, TICK_MS);
  assert.equal(session.viewer, 1);
  assert.ok(seen.some((e) => e.type === 'viewer' && e.player === 1));
  session.pass(1);
  assert.equal(session.state.turn.player, 2);
  assert.equal(session.viewer, 1, 'the computer\'s base isn\'t given away');
  run(session, COMPUTER_MIN_MS + 100);
  assert.deepEqual(session.moves.at(-1), { type: 'pass', player: 2 });
});

test('the menu pauses the game only when every other player is a computer', () => {
  const alone = new Session(makeSetup({ players: [{}, { computer: true }], clock: 15 }));
  alone.menuOpen = true;
  run(alone, 40000);
  assert.equal(alone.moves.length, 0, 'the clock stopped');
  const two = new Session(makeSetup({ clock: 15 }));
  two.menuOpen = true;
  run(two, 40000);
  assert.ok(two.moves.length > 0, 'another human is playing: no pause');
});

test('the recorded replay plays back to the same state', () => {
  const session = new Session(makeSetup());
  session.launch({ player: 0, launcher: citadel(session, 0), item: 'outpost', heading: 0, power: 700 });
  run(session, 8000, TICK_MS);
  session.launch({ player: 1, launcher: citadel(session, 1), item: 'shell', heading: 180, power: 1000 });
  run(session, 8000, TICK_MS);
  session.pass(0);
  session.pass(1);
  run(session, 3000, TICK_MS);
  const replay = session.replay();
  const { game } = playReplay(JSON.parse(JSON.stringify(replay)));
  assert.equal(hashState(game.state), hashState(session.state));

  // And watched in real time, it plays the same moves.
  const watch = new Session(replay.setup, { replay });
  run(watch, 60000, TICK_MS);
  assert.equal(watch.moves.length, replay.moves.length);
  assert.equal(hashState(watch.state), hashState(session.state));
});

test('the summary counts units built, shots fired, hits, units destroyed and energy earned', () => {
  const session = new Session(makeSetup());
  const target = place(session.game, 'battery', 1, 500, 300);
  target.armor = 10;
  // A Shell eastward from P1's Citadel at (300, 300) that lands near
  // the Battery, and destroys it.
  let power = 0;
  for (; power <= 1000; power += 10) {
    const copy = new Session(makeSetup());
    place(copy.game, 'battery', 1, 500, 300).armor = 10;
    copy.launch({ player: 0, launcher: citadel(copy, 0), item: 'shell', heading: 0, power });
    run(copy, 6000, TICK_MS);
    if (copy.game.events.some((e) => e.type === 'destroy' && e.kind === 'battery')) break;
  }
  session.launch({ player: 0, launcher: citadel(session, 0), item: 'shell', heading: 0, power });
  run(session, 6000, TICK_MS);
  session.launch({ player: 1, launcher: citadel(session, 1), item: 'spire', heading: 90, power: 300 });
  run(session, 8000, TICK_MS);
  session.pass(0);
  session.pass(1);
  run(session, 3000, TICK_MS);
  const stats = gameStats(session.setup, session.game.sides, session.game.events);
  assert.equal(stats[0].fired, 1);
  assert.equal(stats[0].hits, 1);
  assert.equal(stats[0].accuracy, 1);
  assert.equal(stats[0].destroyed, 1);
  assert.equal(stats[1].fired, 0);
  assert.equal(stats[1].accuracy, null);
  assert.equal(stats[1].built, session.state.units.some((u) => u.kind === 'spire') ? 1 : 0);
  // Income: 7 from the Citadel each, after the round.
  assert.equal(stats[0].earned, 70);
});
