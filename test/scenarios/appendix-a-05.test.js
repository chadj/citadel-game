// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 05 — Buildings and conduits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sketchMapData } from '../../src/rules/terrain/map.js';
import { createGame } from '../../src/rules/game.js';
import { citadelOf, findUnit } from '../../src/rules/units.js';
import { conduitWarning } from '../../src/rules/conduits.js';
import { makeGame, makeSetup, pass } from '../helpers/setups.js';
import { launchAt, builtUnit, destroyAndSettle, richPlayers } from '../helpers/build.js';

// A point `distance` px from (x, y) along `heading`.
function toward({ x, y }, heading, distance) {
  const a = (heading * Math.PI) / 180;
  return { x: Math.round(x + distance * Math.cos(a)), y: Math.round(y + distance * Math.sin(a)) };
}

const P1 = { x: 300, y: 300 };

// P1's Citadel with one conduit leaving it heading east, and P1 to play.
function withEastConduit() {
  const game = makeGame();
  richPlayers(game);
  const east = launchAt(game, 'spire', 550, 300);
  assert.ok(builtUnit(game, east.events), 'the first building stands');
  assert.equal(east.heading, 0);
  pass(game); // P2 is out for the round, so P1 plays on
  return game;
}

function launchOnHeading(game, heading, options = {}) {
  const { x, y } = toward(P1, heading, 250);
  return launchAt(game, 'spire', x, y, options);
}

test('conduits from one Outpost: about 45° from another, a building lands with no warning', () => {
  const game = withEastConduit();
  const citadel = citadelOf(game.state, 0);
  assert.deepEqual(conduitWarning(game.state, citadel, 45, game.map.size), []);
  const { result, heading, events } = launchOnHeading(game, 45);
  assert.equal(heading, 45);
  assert.ok(result.ok);
  assert.ok(builtUnit(game, events));
  assert.equal(game.state.conduits.length, 2);
});

test('conduits from one Outpost: at about 25°, the warning shows and Launch is refused; with the override, the conduit stands', () => {
  const game = withEastConduit();
  const citadel = citadelOf(game.state, 0);
  assert.equal(conduitWarning(game.state, citadel, 25, game.map.size).length, 1);
  const energy = game.state.players[0].energy;
  const refused = launchOnHeading(game, 25);
  assert.equal(refused.result.ok, false);
  assert.equal(game.state.players[0].energy, energy, 'a refused launch costs nothing');

  const { result, heading, events } = launchOnHeading(game, 25, { override: true });
  assert.equal(heading, 25);
  assert.ok(result.ok);
  assert.ok(builtUnit(game, events), 'the building lands');
  assert.ok(!events.some((e) => e.type === 'nodeSettled' && e.broke), 'no node breaks');
  assert.equal(game.state.conduits.length, 2);
  assert.ok(game.state.conduits.every((c) => !c.broken));
});

test('conduits from one Outpost: at about 10°, with the override, the new conduit breaks and burns back; the Outpost isn\'t harmed', () => {
  const game = withEastConduit();
  const before = game.state.units.length;
  const { result, heading, events } = launchOnHeading(game, 10, { override: true });
  assert.equal(heading, 10);
  assert.ok(result.ok);
  const breaks = events.filter((e) => e.type === 'nodeSettled' && e.broke);
  assert.equal(breaks[0]?.broke, 'conduit');
  assert.ok(events.some((e) => e.type === 'nodeBurnt'), 'it burns');
  assert.ok(events.some((e) => e.type === 'buildingFailed'), 'the building is destroyed');
  assert.equal(builtUnit(game, events), undefined);
  assert.equal(game.state.units.length, before);
  const citadel = citadelOf(game.state, 0);
  assert.equal(citadel.armor, 50);
  // Only the first conduit is left, whole.
  assert.equal(game.state.conduits.length, 1);
  assert.equal(game.state.conduits[0].broken, false);
});

test('a conduit across another: a node settles too close to the enemy conduit, and the building is destroyed', () => {
  const setup = makeSetup();
  setup.starts = [P1, { x: 500, y: 100 }];
  const game = createGame(setup);
  richPlayers(game);
  pass(game); // P1 lets P2 build first
  // P2's conduit runs south, across P1's line east.
  const south = launchAt(game, 'spire', 500, 500);
  assert.equal(south.heading, 90);
  assert.ok(builtUnit(game, south.events));
  pass(game);
  // The next round starts with P2, who passes; then P1 plays.
  pass(game);
  assert.equal(game.state.turn.player, 0);
  const { events } = launchAt(game, 'spire', 700, 300);
  const breaks = events.filter((e) => e.type === 'nodeSettled' && e.broke);
  assert.equal(breaks[0]?.broke, 'conduit');
  assert.ok(events.some((e) => e.type === 'buildingFailed'));
  assert.equal(builtUnit(game, events), undefined);
  // P2's conduit isn't harmed.
  const p2 = game.state.conduits.filter((c) => c.owner === 1);
  assert.equal(p2.length, 1);
  assert.equal(p2[0].broken, false);
});

test('a node on water: a building lands beyond a lake, and the conduit breaks in the water', () => {
  // A lake two tiles wide, from x = 420 to 540 px.
  const map = sketchMapData({ rows: Array(32).fill('~~'), at: [7, 0] });
  const game = makeGame({ map });
  richPlayers(game);
  const { events } = launchAt(game, 'spire', 650, 300);
  const breaks = events.filter((e) => e.type === 'nodeSettled' && e.broke);
  assert.equal(breaks[0]?.broke, 'water');
  assert.ok(events.some((e) => e.type === 'buildingFailed'));
  assert.equal(builtUnit(game, events), undefined);
  assert.equal(game.state.conduits.length, 0, 'the conduit burns away');
});

test('the burn: when an Outpost is destroyed, the nearer building after it goes first, then the further one', () => {
  const game = makeGame();
  richPlayers(game);
  const first = builtUnit(game, launchAt(game, 'outpost', 550, 300).events);
  pass(game);
  const second = builtUnit(game, launchAt(game, 'outpost', 800, 300, { launcher: first }).events);
  const third = builtUnit(game, launchAt(game, 'spire', 1050, 300, { launcher: second }).events);
  assert.ok(first && second && third);

  const events = destroyAndSettle(game, first);
  const order = events.filter((e) => e.type === 'destroy').map((e) => e.unit);
  assert.deepEqual(order, [first.id, second.id, third.id]);
  const time = (id) => events.findIndex((e) => e.type === 'destroy' && e.unit === id);
  assert.ok(events.slice(time(second.id), time(third.id)).some((e) => e.type === 'nodeBurnt'),
    'the further one goes only once the burn reaches it');
  // The Citadel the first Outpost was built from isn't harmed.
  assert.ok(findUnit(game.state, citadelOf(game.state, 0).id));
  assert.equal(game.state.conduits.length, 0);
});
