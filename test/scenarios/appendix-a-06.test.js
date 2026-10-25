// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 06 — Weapons and tools.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/rules/game.js';
import { sketchMapData } from '../../src/rules/terrain/map.js';
import { roundIncome } from '../../src/rules/energy.js';
import { citadelOf, findUnit, isWorking } from '../../src/rules/units.js';
import { PULSE_DELAY } from '../../src/rules/constants.js';
import { makeGame, makeSetup, pass, timeout } from '../helpers/setups.js';
import { place, launchAt, builtUnit, richPlayers, landingPx } from '../helpers/build.js';

const EAST = { heading: 0, power: 1000 };
const fire = (game, item, aim = EAST, launcher) => launchAt(game, item, 0, 0, { aim, launcher });
const count = (events, type) => events.filter((e) => e.type === type).length;

test('Shell zones: an Outpost\'s edge about 5 px away takes 3; about 22 px, 1.5; about 50 px, nothing', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  // Beside the landing point, across the Shell's path.
  const close = place(game, 'outpost', 1, x, y + 20);
  const middle = place(game, 'outpost', 1, x, y - 37);
  const clear = place(game, 'outpost', 1, x, y + 65);
  const { events } = fire(game, 'shell');
  assert.ok(events.some((e) => e.type === 'crater'), 'a ground hit');
  assert.equal(close.armor, 20);
  assert.equal(middle.armor, 35);
  assert.equal(clear.armor, 50);
});

test('height: a Shell landing on a Mountain about 75 px high doesn\'t touch a unit on the Ground just below', () => {
  // A Mountain in the middle of a Plateau ring, on a canyon world (80 px).
  const rows = ['+++++', '+^^^+', '+^^^+', '+^^^+', '+++++'];
  const map = sketchMapData({ planet: 'canyon', rows, at: [11, 3] });
  const game = makeGame({ map });
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  assert.ok(game.map.mountainHeight >= 75 * 1024);
  const below = place(game, 'outpost', 1, x, y + 25, { base: 0 });
  const onTop = place(game, 'outpost', 1, x, y - 25);
  fire(game, 'shell');
  assert.equal(below.armor, 50);
  assert.equal(onTop.armor, 20, 'a unit up there beside it is hit');
});

test('Barriers: an enemy shot is stopped at the dome\'s edge; a friendly one passes; one launched from under an enemy dome is stopped leaving it', () => {
  const game = makeGame();
  richPlayers(game);
  place(game, 'barrier', 1, 650, 300, { up: true });
  const enemy = fire(game, 'shell');
  const stop = enemy.events.find((e) => e.type === 'stopped');
  assert.ok(stop);
  assert.ok(Math.abs(Math.hypot(stop.x / 1024 - 650, stop.y / 1024 - 300, stop.z / 1024) - 160) < 2, 'at the edge');
  assert.equal(count(enemy.events, 'explosion'), 0);

  // P2's own shot through its own dome.
  const friendly = fire(game, 'shell', { heading: 180, power: 1000 });
  assert.equal(count(friendly.events, 'stopped'), 0);
  assert.equal(count(friendly.events, 'crater'), 1);

  // P1 again, from an Outpost under P2's dome.
  const under = place(game, 'outpost', 0, 650, 380);
  const out = fire(game, 'shell', { heading: 90, power: 1000 }, under);
  assert.equal(count(out.events, 'stopped'), 1);
  assert.equal(count(out.events, 'crater'), 0);
});

test('one Interceptor: it catches an enemy Shell passing about 100 px away, and reloads; a second Shell on the next turn isn\'t fired at', () => {
  const game = makeGame();
  const interceptor = place(game, 'interceptor', 1, 550, 400);
  const first = fire(game, 'shell');
  assert.equal(count(first.events, 'interceptorFired'), 1);
  assert.equal(count(first.events, 'caught'), 1);
  assert.equal(count(first.events, 'crater'), 0);
  assert.equal(isWorking(game.state, interceptor), false);
  pass(game);
  const second = fire(game, 'shell');
  assert.equal(count(second.events, 'interceptorFired'), 0);
  assert.equal(count(second.events, 'crater'), 1);
});

test('a Scatter Shell against one Interceptor near where the fragments come down: one is caught, the other two land', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  // Beside the right-hand fragment's path, out of reach of the split.
  place(game, 'interceptor', 1, x - 60, y + 150);
  const { events } = fire(game, 'scatter');
  assert.equal(count(events, 'interceptorFired'), 1);
  assert.equal(count(events, 'caught'), 1);
  assert.equal(count(events, 'explosion'), 2);
});

test('a shielded path: the attacker\'s Barrier between the enemy Interceptor and the shot stops the missile, and the shot lands', () => {
  const game = makeGame();
  place(game, 'barrier', 0, 550, 300, { up: true });
  place(game, 'interceptor', 1, 550, 470);
  const { events } = fire(game, 'shell');
  assert.equal(count(events, 'interceptorFired'), 1);
  assert.equal(count(events, 'missileStopped'), 1);
  assert.equal(count(events, 'caught'), 0);
  assert.equal(count(events, 'crater'), 1);
});

test('a Pulse: about 1.5 s after landing, every unit within about 200 px is disabled; an Extractor with 2 armor left beside it is destroyed without a blast', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  const extractor = place(game, 'extractor', 1, x, y + 25, { armor: 20 });
  const enemy = place(game, 'outpost', 1, x, y - 150);
  const own = place(game, 'outpost', 0, x + 170, y);
  const beyond = place(game, 'outpost', 1, x, y + 260);
  const { events } = fire(game, 'pulse');
  const landed = events.find((e) => e.type === 'pulseLanded');
  const went = events.find((e) => e.type === 'pulse');
  assert.equal(went.tick - landed.tick, PULSE_DELAY);
  assert.equal(PULSE_DELAY, 45, 'about 1.5 s');
  assert.equal(isWorking(game.state, enemy), false);
  assert.equal(isWorking(game.state, own), false, 'the attacker\'s own units too');
  assert.equal(isWorking(game.state, beyond), true);
  assert.equal(findUnit(game.state, extractor.id), null);
  assert.equal(count(events, 'blast'), 0, 'it was already disabled');
});

test('a Surge strikes an enemy unit whose conduit runs about 20 nodes back: the unit takes 3, the launcher about 1.8', () => {
  const setup = makeSetup();
  setup.starts = [{ x: 300, y: 300 }, { x: 900, y: 300 }];
  const game = createGame(setup);
  richPlayers(game);
  pass(game);
  const outpost = builtUnit(game, launchAt(game, 'outpost', 565, 300).events);
  const conduit = game.state.conduits.find((c) => c.to === outpost.id);
  const nodes = conduit.nodes.length;
  assert.ok(Math.abs(nodes - 20) <= 1, `${nodes} nodes`);
  pass(game);
  pass(game); // the next round starts with P2, who passes
  const p2 = citadelOf(game.state, 1);
  const { events } = launchAt(game, 'surge', 565, 300);
  assert.equal(outpost.armor, 20, 'the unit it strikes takes 3');
  const expected = Math.floor((30 * (50 - nodes)) / 50);
  assert.equal(p2.armor, 50 - expected, `the launcher takes ${expected / 10}`);
  assert.ok(Math.abs(expected - 18) <= 1);
  assert.ok(count(events, 'surgeNode') >= nodes);
});

test('a Worm spreads one conduit further each turn cycle; enemy units lose 1 as it wears off, never below 0.1; the attacker\'s own are only disabled', () => {
  const setup = makeSetup();
  setup.starts = [{ x: 300, y: 650 }, { x: 300, y: 900 }];
  const game = createGame(setup);
  richPlayers(game);
  pass(game);
  // P2: Citadel → Outpost → Spire, heading east.
  const outpost = builtUnit(game, launchAt(game, 'outpost', 550, 900).events);
  const spire = builtUnit(game, launchAt(game, 'spire', 800, 900, { launcher: outpost }).events);
  const citadel = citadelOf(game.state, 1);
  spire.armor = 5; // 0.5 left
  pass(game);
  pass(game); // the next round starts with P2, who passes: P1 plays on alone
  const mine = place(game, 'outpost', 0, 550, 940);

  const { x, y } = { x: outpost.x / 1024, y: outpost.y / 1024 };
  launchAt(game, 'worm', x, y + 20);
  assert.ok(outpost.worm && mine.worm, 'it infects units near where it lands');
  assert.equal(citadel.worm, null);
  assert.equal(spire.worm, null);

  // P1 plays on alone, so play goes all the way around between turns
  // (decision D2): the infection lasts through P1's next turn, which is
  // now, and wears off as that one ends.
  assert.ok(outpost.worm, 'still infected through P1\'s next turn');
  timeout(game);
  assert.equal(outpost.worm, null);
  assert.equal(outpost.armor, 40);
  assert.equal(mine.armor, 50, 'the attacker\'s own unit isn\'t damaged');
  assert.ok(citadel.worm && spire.worm, 'it spreads both ways along the conduits');
  assert.equal(outpost.wormsHad.length, 1);

  timeout(game);
  assert.equal(spire.armor, 1, 'never below 0.1');
  assert.equal(citadel.armor, 40);
  assert.equal(outpost.worm, null, 'it never goes back');
  assert.ok(game.state.units.every((u) => u.worm === null), 'it has run out of conduits');
});

test('a Salvager on the player\'s own Extractor removes it with no blast, for 5 at the end of the round; on an enemy Battery, 3', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  const extractor = place(game, 'extractor', 0, x, y);
  const own = fire(game, 'salvager');
  assert.equal(findUnit(game.state, extractor.id), null);
  assert.equal(count(own.events, 'blast'), 0);
  assert.equal(game.state.players[0].salvaged, 50);
  pass(game);

  const battery = place(game, 'battery', 1, x, y);
  const enemy = fire(game, 'salvager');
  assert.equal(findUnit(game.state, battery.id), null);
  assert.equal(count(enemy.events, 'blast'), 0);
  assert.equal(game.state.players[0].salvaged, 80);
  assert.equal(roundIncome(game.state, 0), 70 + 80);
});

test('a Repair Pod that lands next to a damaged unit restores 1 armor', () => {
  const game = makeGame();
  const { x, y } = landingPx(game, citadelOf(game.state, 0), 0, 1000);
  const damaged = place(game, 'outpost', 1, x, y + 30, { armor: 22 });
  fire(game, 'repair');
  assert.equal(damaged.armor, 32);
});
