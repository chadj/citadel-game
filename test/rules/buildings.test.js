// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Buildings, conduits and Pontoons (spec 05; spec 02, Pontoons; spec 06,
// Pontoon; decisions D5, D6, D31).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyMove, step, settle, destroyUnit } from '../../src/rules/game.js';
import { conduitStart, conduitWarning } from '../../src/rules/conduits.js';
import { hashState } from '../../src/rules/hash.js';
import { citadelOf, findUnit } from '../../src/rules/units.js';
import { sketchMapData } from '../../src/rules/terrain/map.js';
import { px } from '../../src/rules/math/fixed.js';
import { dist2 } from '../../src/rules/math/wrap.js';
import { NODE_SPACING, WIND_STRONG, PX } from '../../src/rules/constants.js';
import { makeGame, makeSetup, pass } from '../helpers/setups.js';
import { aimAt, launchAt, builtUnit, richPlayers, pos } from '../helpers/build.js';

const dist = (a, b, size) => Math.sqrt(dist2(a.x, a.y, b.x, b.y, size)) / PX;

test('a conduit\'s first node lies on the launch heading, and the rest about 15 px apart up to the building\'s footprint', () => {
  const game = makeGame();
  const citadel = citadelOf(game.state, 0);
  const spire = builtUnit(game, launchAt(game, 'spire', 300, 560).events);
  const { nodes } = game.state.conduits[0];
  const size = game.map.size;
  assert.deepEqual(pos(nodes[0]), { x: 300, y: 300 + conduitStart(citadel) / PX });
  for (let k = 1; k < nodes.length; k++) {
    assert.ok(Math.abs(dist(nodes[k - 1], nodes[k], size) - NODE_SPACING / PX) < 0.5);
  }
  const last = dist(nodes.at(-1), spire, size);
  assert.ok(last >= 15 && last < 15 + NODE_SPACING / PX, `the last node is ${last} px from the center`);
  assert.ok(nodes.every((n) => n.resting && n.z === 0), 'every node has come down to the ground');
});

test('the wind acts on a building only once its conduit has started: the first node stays on the heading', () => {
  const game = makeGame({ wind: { level: WIND_STRONG, dir: 0, variation: 0 } });
  const citadel = citadelOf(game.state, 0);
  // Launched north across an east wind.
  const { events } = launchAt(game, 'spire', 0, 0, { aim: { heading: 270, power: 600 } });
  const spire = builtUnit(game, events);
  const { nodes } = game.state.conduits[0];
  assert.deepEqual(pos(nodes[0]), { x: 300, y: 300 - conduitStart(citadel) / PX });
  assert.ok(pos(spire).x > 300 + 20, 'the building drifts with the wind after that');
  assert.ok(nodes.at(-1).x > nodes[1].x, 'and its conduit follows it');
});

test('a building that comes down onto a unit is hit, and fails', () => {
  const game = makeGame();
  richPlayers(game);
  const spire = builtUnit(game, launchAt(game, 'spire', 300, 560).events);
  pass(game);
  const { events } = launchAt(game, 'spire', 0, 0, {
    aim: aimAt(game, citadelOf(game.state, 0), 300, 560), override: true, // along the first one's conduit
  });
  assert.equal(events.find((e) => e.type === 'hit')?.unit, spire.id);
  assert.equal(events.find((e) => e.type === 'buildingFailed')?.reason, 'hit');
  assert.ok(findUnit(game.state, spire.id), 'the building it hit is still there');
});

test('a building fails if another conduit\'s node is within a few pixels of its footprint', () => {
  const setup = makeSetup();
  setup.starts = [{ x: 300, y: 300 }, { x: 420, y: 520 }];
  const game = createGame(setup);
  builtUnit(game, launchAt(game, 'spire', 560, 300).events);
  // P2 builds north, ending just below P1's conduit.
  const { events } = launchAt(game, 'spire', 420, 316);
  assert.equal(events.find((e) => e.type === 'buildingFailed')?.reason, 'nearConduit');
  assert.ok(!events.some((e) => e.type === 'nodeSettled' && e.broke), 'its own nodes were fine');
});

test('a Pontoon that comes down on land, or in a tile that has one, is lost', () => {
  const map = sketchMapData({ rows: Array(32).fill('~~~'), at: [8, 0] });
  const game = makeGame({ map });
  richPlayers(game);
  const onLand = launchAt(game, 'pontoon', 300, 450);
  assert.ok(onLand.events.some((e) => e.type === 'pontoonLost'));
  pass(game);
  assert.ok(builtUnit(game, launchAt(game, 'pontoon', 520, 330).events));
  const taken = launchAt(game, 'pontoon', 530, 320);
  assert.ok(taken.events.some((e) => e.type === 'pontoonLost'));
  assert.equal(game.state.units.filter((u) => u.kind === 'pontoon').length, 1);
});

test('a building whose launcher is destroyed while it flies fails when it comes down (D5)', () => {
  const game = makeGame();
  richPlayers(game);
  const outpost = builtUnit(game, launchAt(game, 'outpost', 550, 300).events);
  pass(game);
  const { heading, power } = aimAt(game, outpost, 800, 300);
  assert.ok(applyMove(game, { type: 'launch', player: 0, launcher: outpost.id, item: 'spire', heading, power }).ok);
  const conduit = game.state.conduits.find((c) => c.from === outpost.id);
  while (conduit.nodes.length < 3) step(game);
  destroyUnit(game, outpost, 1);
  const before = game.events.length;
  settle(game);
  const failed = game.events.slice(before).find((e) => e.type === 'buildingFailed');
  assert.equal(failed?.reason, 'conduit');
  assert.equal(game.state.conduits.length, 0);
  assert.equal(game.state.units.length, 2, 'just the two Citadels');
});

test('the warning also covers the conduit leading into a launcher', () => {
  const game = makeGame();
  richPlayers(game);
  const outpost = builtUnit(game, launchAt(game, 'outpost', 550, 300).events);
  assert.equal(conduitWarning(game.state, outpost, 180, game.map.size).length, 1);
  assert.equal(conduitWarning(game.state, outpost, 0, game.map.size).length, 0);
});

test('a game with conduits in it hashes', () => {
  const game = makeGame();
  launchAt(game, 'spire', 300, 560);
  assert.match(hashState(game.state), /^[0-9a-f]{16}$/);
});
