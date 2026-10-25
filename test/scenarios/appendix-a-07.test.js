// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 07 — Rovers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/rules/game.js';
import { sketchMapData } from '../../src/rules/terrain/map.js';
import { citadelOf, findUnit } from '../../src/rules/units.js';
import { ROVER_UNIT_PAUSE } from '../../src/rules/constants.js';
import { makeGame, makeSetup, pass } from '../helpers/setups.js';
import { place, launchAt, builtUnit, pos } from '../helpers/build.js';

const rover = (game, owner, x, y, heading = 0) => place(game, 'rover', owner, x, y, { heading, triggered: false });

// Both players pass, so the round ends and the Rovers drive. Returns the
// events from then on.
function endRound(game) {
  const before = game.events.length;
  pass(game);
  if (game.state.round === game.events[before]?.round) pass(game);
  return game.events.slice(before);
}

function withStarts(starts, options = {}) {
  const setup = makeSetup(options);
  setup.starts = starts;
  return createGame(setup);
}

test('the drive: a Rover launched east drives about 300 px east at the end of each round', () => {
  const game = makeGame();
  const r = rover(game, 0, 500, 700);
  endRound(game);
  assert.deepEqual(pos(r), { x: 800, y: 700 });
  endRound(game);
  assert.deepEqual(pos(r), { x: 1100, y: 700 });
});

test('a Rover launched with a heading keeps exactly to it, whatever the wind did to its flight', () => {
  const game = makeGame({ wind: { level: 3, dir: 90, variation: 0 } });
  const { events } = launchAt(game, 'rover', 0, 0, { aim: { heading: 0, power: 400 } });
  const r = builtUnit(game, events);
  assert.equal(r.heading, 0);
  const start = pos(r);
  assert.ok(start.y > 310, 'the wind bent its flight');
  endRound(game);
  assert.ok(Math.abs(pos(r).y - start.y) < 0.01);
  assert.ok(Math.abs(pos(r).x - start.x - 300) < 0.01);
});

test('an enemy Outpost in its path: it stops beside it, waits about a second, explodes; the Outpost is left with 1, and Barriers within about 180 px are destroyed', () => {
  const game = makeGame();
  const r = rover(game, 0, 500, 700);
  const outpost = place(game, 'outpost', 1, 700, 700);
  const barrier = place(game, 'barrier', 1, 650, 840, { up: true });
  const events = endRound(game);
  const triggered = events.find((e) => e.type === 'roverTriggered');
  const blast = events.find((e) => e.type === 'blast');
  assert.equal(blast.tick - triggered.tick, ROVER_UNIT_PAUSE);
  assert.ok(Math.abs(blast.x / 1024 - (700 - 15 - 20)) <= 2, 'where it first came within reach');
  assert.equal(findUnit(game.state, r.id), null);
  assert.equal(outpost.armor, 10);
  assert.equal(findUnit(game.state, barrier.id), null);
});

test('an enemy conduit in its path: it explodes where it reaches the conduit', () => {
  const game = withStarts([{ x: 300, y: 300 }, { x: 700, y: 400 }]);
  pass(game);
  builtUnit(game, launchAt(game, 'spire', 700, 800).events);
  const r = rover(game, 0, 500, 600);
  const events = endRound(game);
  const blast = events.find((e) => e.type === 'blast');
  assert.ok(blast, 'it explodes');
  assert.ok(Math.abs(blast.x / 1024 - (700 - 12)) <= 2);
  assert.equal(findUnit(game.state, r.id), null);
});

test('its own conduit in its path: it stops there, and stays stopped in later rounds', () => {
  const game = withStarts([{ x: 700, y: 400 }, { x: 1300, y: 1300 }]);
  builtUnit(game, launchAt(game, 'spire', 700, 800).events);
  const r = rover(game, 0, 500, 600);
  endRound(game);
  const at = pos(r);
  assert.ok(at.x < 700 - 12 && at.x > 700 - 12 - 3, `stopped at ${at.x}`);
  endRound(game);
  assert.deepEqual(pos(r), at);
  assert.ok(findUnit(game.state, r.id));
});

test('an armed Charge near its path goes off; the Rover is destroyed, and explodes too', () => {
  const game = makeGame();
  const r = rover(game, 0, 500, 700);
  place(game, 'charge', 1, 650, 770, { armed: true });
  const events = endRound(game);
  assert.ok(events.some((e) => e.type === 'chargeSetOff'));
  assert.equal(findUnit(game.state, r.id), null);
  assert.equal(events.filter((e) => e.type === 'blast').length, 2);
});

test('a lake in its path: it drives into the water, along the bottom, and out the other side', () => {
  // Water from x = 600 to 720 px.
  const map = sketchMapData({ rows: Array(32).fill('~~'), at: [10, 0] });
  const game = makeGame({ map });
  const r = rover(game, 0, 500, 700);
  const events = endRound(game);
  assert.equal(events.filter((e) => e.type === 'splash' && e.unit === r.id).length, 2);
  assert.deepEqual(pos(r), { x: 800, y: 700 });
  assert.equal(r.base, 0);
});

test('credit: at the end of a round, a Rover that destroys an enemy Citadel earns its owner the 7', () => {
  const game = makeGame({ players: 3 });
  const p2 = citadelOf(game.state, 1);
  p2.armor = 30;
  rover(game, 0, 1100, 300);
  const before = game.events.length;
  for (let k = 0; k < 3; k++) pass(game);
  const events = game.events.slice(before);
  assert.equal(findUnit(game.state, p2.id), null);
  assert.equal(events.find((e) => e.type === 'citadelBonus')?.player, 0);
});

test('Rovers drive one at a time, oldest first, each waiting for what the last one set off', () => {
  const game = makeGame();
  const first = rover(game, 1, 500, 700);
  const second = rover(game, 0, 500, 1000);
  place(game, 'outpost', 0, 700, 700);
  const events = endRound(game);
  const starts = events.filter((e) => e.type === 'roverDrives').map((e) => e.unit);
  assert.deepEqual(starts, [first.id, second.id]);
  const blast = events.find((e) => e.type === 'blast');
  const secondStarts = events.find((e) => e.type === 'roverDrives' && e.unit === second.id);
  assert.ok(secondStarts.tick > blast.tick, 'the second waits for the first one\'s blast');
  assert.deepEqual(pos(second), { x: 800, y: 1000 });
  assert.equal(findUnit(game.state, first.id), null);
});
