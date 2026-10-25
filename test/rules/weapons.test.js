// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Weapons, tools and the free-standing units' flights (spec 04, spec 06;
// decisions D32–D35).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, step } from '../../src/rules/game.js';
import { citadelOf, findUnit, isWorking } from '../../src/rules/units.js';
import { cycleEnd } from '../../src/rules/effects.js';
import { makeGame, pass, timeout } from '../helpers/setups.js';
import { place, launchAt, builtUnit, destroyAndSettle, richPlayers, landingPx } from '../helpers/build.js';
import { fly } from '../helpers/flight-cases.js';

const fire = (game, item, aim = { heading: 0, power: 1000 }, launcher) => launchAt(game, item, 0, 0, { aim, launcher });
const count = (events, type) => events.filter((e) => e.type === type).length;

test('a Scatter Shell splits into three as it starts to fall, landing in a fan; a fragment does 1.5 close in, 0.7 further out', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  const close = place(game, 'outpost', 1, x, y + 22); // edge 7 px away
  const out = place(game, 'outpost', 1, x, y - 30); // edge 15 px away
  const { events } = fire(game, 'scatter');
  const craters = events.filter((e) => e.type === 'crater').map((e) => e.y / 1024 - 300);
  assert.equal(craters.length, 3);
  assert.ok(craters.some((d) => d > 60) && craters.some((d) => d < -60) && craters.some((d) => Math.abs(d) < 1));
  assert.equal(close.armor, 35);
  assert.equal(out.armor, 43);
});

test('a Seeker locks on to an enemy unit ahead of it, and homes in for a direct hit', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  // Well beside where a Shell would land.
  const target = place(game, 'outpost', 1, x - 80, y + 70);
  place(game, 'outpost', 0, x - 60, y - 100); // the Seeker's own side is never a target
  const { events } = fire(game, 'seeker');
  const hit = events.find((e) => e.type === 'hit');
  assert.equal(hit?.unit, target.id);
  assert.equal(target.armor, 20);
});

test('a Seeker with no target lands like a Shell', () => {
  const game = makeGame();
  const { x } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  const shell = fire(game, 'seeker').events.find((e) => e.type === 'crater');
  assert.ok(Math.abs(shell.x / 1024 - x) < 1);
});

test('a Sky Probe stops about 420 px away at about 200 high at full power; at the lowest power it goes further than a Shell', () => {
  const game = makeGame();
  richPlayers(game);
  const full = builtUnit(game, fire(game, 'skyProbe').events);
  assert.ok(Math.abs(full.x / 1024 - 300 - 420) <= 20 && Math.abs(full.base / 1024 - 200) <= 15);
  pass(game);
  const low = builtUnit(game, fire(game, 'skyProbe', { heading: 90, power: 0 }).events);
  assert.ok(low.y / 1024 - 300 > fly({ power: 0 }).distance);
});

test('a Sky Probe is destroyed by an enemy shot that touches it, which ends there; friendly shots fly through', () => {
  const game = makeGame();
  const citadel = citadelOf(game.state, 0);
  // The Shell's track, to float a probe of each side on it.
  applyMove(game, { type: 'launch', player: 0, launcher: citadel.id, item: 'shell', heading: 0, power: 1000 });
  const track = [];
  while (game.state.phase === 'flight') {
    const s = game.state.shots[0];
    if (s) track.push({ x: s.x, y: s.y, z: s.z });
    step(game);
  }
  const at = (k) => track[k];
  const g2 = makeGame();
  const friendly = place(g2, 'skyProbe', 0, at(20).x / 1024, at(20).y / 1024, { base: at(20).z / 1024 - 25 });
  const enemy = place(g2, 'skyProbe', 1, at(50).x / 1024, at(50).y / 1024, { base: at(50).z / 1024 - 25 });
  const { events } = fire(g2, 'shell');
  assert.ok(findUnit(g2.state, friendly.id), 'the friendly probe is flown through');
  assert.equal(findUnit(g2.state, enemy.id), null);
  assert.equal(events.find((e) => e.type === 'hit')?.unit, enemy.id);
  assert.equal(count(events, 'crater'), 0, 'the shot ended there');
});

test('Proximity Charges split into three, each landing as a Charge; they\'re armed once everything has settled', () => {
  const game = makeGame();
  applyMove(game, { type: 'launch', player: 0, launcher: citadelOf(game.state, 0).id, item: 'charges', heading: 0, power: 800 });
  let seen = 0;
  while (game.state.phase === 'flight') {
    step(game);
    // Until the turn changes hands, the Charges just laid aren't armed.
    const charges = game.state.units.filter((u) => u.kind === 'charge');
    if (game.state.phase === 'flight') assert.ok(charges.every((c) => !c.armed));
    seen = charges.length;
  }
  assert.equal(seen, 3);
  assert.equal(count(game.events, 'chargeSetOff'), 0, 'they can\'t set each other off');
  assert.ok(game.state.units.filter((u) => u.kind === 'charge').every((c) => c.armed));
});

test('a Charge that lands near a conduit node is lost', () => {
  const game = makeGame();
  richPlayers(game);
  builtUnit(game, launchAt(game, 'spire', 700, 300).events);
  pass(game);
  const { events } = fire(game, 'charges', { heading: 0, power: 500 });
  assert.ok(events.some((e) => e.type === 'lost' && e.reason === 'conduit'));
});

test('several Interceptors in reach: the same one answers on every machine, but not always the nearest', () => {
  const picks = [];
  for (const [heading, power] of [[0, 1000], [2, 990], [358, 980], [1, 970], [359, 960], [3, 950], [357, 940], [0, 930]]) {
    const run = () => {
      const game = makeGame();
      const a = place(game, 'interceptor', 1, 550, 420);
      place(game, 'interceptor', 1, 550, 180);
      const ev = fire(game, 'shell', { heading, power }).events.find((e) => e.type === 'interceptorFired');
      return ev.unit === a.id ? 'a' : 'b';
    };
    const first = run();
    assert.equal(run(), first);
    picks.push(first);
  }
  assert.ok(picks.includes('a') && picks.includes('b'), picks.join(''));
});

test('a unit still landing while a missile is after it is destroyed without exploding', () => {
  const game = makeGame();
  const extractor = place(game, 'extractor', 1, 800, 800, { landing: true });
  const events = destroyAndSettle(game, extractor);
  assert.equal(count(events, 'blast'), 0);
});

test('a Pulse on a unit with a Worm holds both back a turn cycle; a newer Worm takes over', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  richPlayers(game);
  const unit = place(game, 'outpost', 1, x, y + 40);
  fire(game, 'worm');
  const first = unit.worm;
  assert.ok(first);
  const until = first.until;
  fire(game, 'pulse', { heading: 180, power: 1000 }, place(game, 'outpost', 1, x + 500, y + 40));
  assert.equal(unit.worm.until, until + game.state.seats.length);
  assert.equal(unit.disabledUntil, unit.worm.until);

  const before = cycleEnd(game.state);
  fire(game, 'worm');
  assert.notEqual(unit.worm.id, first.id);
  assert.equal(unit.worm.until, before, 'a full turn cycle from the takeover');
  assert.equal(unit.wormsHad.length, 2);
});

test('a Surge that finds no unit hits the nearest conduit node, and runs both ways to each end', () => {
  const game = makeGame();
  richPlayers(game);
  const spire = builtUnit(game, launchAt(game, 'spire', 300, 700).events);
  const citadel = citadelOf(game.state, 0);
  pass(game);
  const conduit = game.state.conduits[0];
  const mid = conduit.nodes[Math.floor(conduit.nodes.length / 2)];
  const { events } = launchAt(game, 'surge', mid.x / 1024, mid.y / 1024);
  const ends = events.filter((e) => e.type === 'surgeEnd').map((e) => e.unit).sort();
  assert.deepEqual(ends, [citadel.id, spire.id].sort());
  assert.ok(spire.armor < 30 && citadel.armor < 50);
});

test('a Salvager takes up to 3 from an enemy unit, 1 a second; the unit survives with the rest', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  const outpost = place(game, 'outpost', 1, x, y);
  const { events } = fire(game, 'salvager');
  const takes = events.filter((e) => e.type === 'salvage');
  assert.equal(takes.length, 3);
  assert.equal(takes[1].tick - takes[0].tick, 30);
  assert.equal(outpost.armor, 20);
  assert.equal(game.state.players[0].salvaged, 30);
});

test('a disabled Interceptor doesn\'t fire; a disabled Barrier doesn\'t stop shots', () => {
  const game = makeGame();
  place(game, 'interceptor', 1, 550, 400, { disabledUntil: 99 });
  place(game, 'barrier', 1, 900, 300, { up: true, disabledUntil: 99 });
  const { events } = fire(game, 'shell');
  assert.equal(count(events, 'interceptorFired'), 0);
  assert.equal(count(events, 'stopped'), 0);
  assert.ok(isWorking(game.state, citadelOf(game.state, 0)));
  timeout(game);
});
