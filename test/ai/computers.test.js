// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Computer players (spec 09): fair play, personalities, getting its eye
// in, making a shot, and whole games between computers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, applyMove, settle } from '../../src/rules/game.js';
import { updateFog } from '../../src/rules/fog.js';
import { citadelOf } from '../../src/rules/units.js';
import { hashState } from '../../src/rules/hash.js';
import { MIN_TO_PLAY } from '../../src/rules/constants.js';
import { listJsFiles } from '../../tools/walk.js';
import { Brain, seeded } from '../../src/ai/brain.js';
import { PERSONALITIES, STYLE_WEIGHTS } from '../../src/ai/personalities.js';
import { PERSONALITIES as OFFERED, mapStarts, brainsFor } from '../../src/client/core/computers.js';
import { MAPS, mapData } from '../../src/client/core/maps.js';
import { Session, COMPUTER_MIN_MS } from '../../src/client/core/session.js';
import { makeSetup, makeGame, whoseTurn } from '../helpers/setups.js';
import { place, launchAt, builtUnit, richPlayers } from '../helpers/build.js';

const brain = (personality, player, seed = 1, starts = []) => new Brain(personality, player, { starts, random: seeded(seed) });

test('personalities: five to ten, each named, hardest to easiest, with every style', () => {
  assert.ok(PERSONALITIES.length >= 5 && PERSONALITIES.length <= 10);
  assert.equal(new Set(PERSONALITIES.map((p) => p.name)).size, PERSONALITIES.length);
  for (let k = 1; k < PERSONALITIES.length; k++) {
    const [a, b] = [PERSONALITIES[k - 1], PERSONALITIES[k]];
    assert.ok(b.aim >= a.aim && b.power >= a.power && b.judgment <= a.judgment && b.whim >= a.whim, `${b.name} is no easier than ${a.name}`);
  }
  const hardest = PERSONALITIES[0];
  assert.equal(hardest.aim, 0);
  assert.equal(hardest.power, 0);
  assert.ok(hardest.whim <= 0.05);
  const easiest = PERSONALITIES.at(-1);
  assert.equal(easiest.aim, 35);
  assert.equal(easiest.power, 0.25);
  assert.equal(easiest.whim, 0.5);
  assert.deepEqual(new Set(PERSONALITIES.map((p) => p.style)), new Set(Object.keys(STYLE_WEIGHTS)));
  // The setup screen offers them all, plus a random choice.
  assert.deepEqual(OFFERED.map((p) => p.id), ['random', ...PERSONALITIES.map((p) => p.id)]);
});

test('it sees only what its side sees, and remembers what the fog hides again', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  const enemy = place(game, 'battery', 0, 1300, 900);
  updateFog(game);
  const b = brain('warden', 1);
  b.observe(game);
  assert.ok(!b.memory.belief(game).state.units.some((u) => u.id === enemy.id), 'hidden in the fog');
  const spire = place(game, 'spire', 1, 1300, 700);
  updateFog(game);
  b.observe(game);
  assert.ok(b.memory.belief(game).state.units.some((u) => u.id === enemy.id), 'seen');
  game.state.units.splice(game.state.units.indexOf(spire), 1);
  updateFog(game);
  b.observe(game);
  assert.ok(b.memory.belief(game).state.units.some((u) => u.id === enemy.id), 'remembered');
});

test('it works out which Outpost is the Citadel: not one it saw a conduit run into', () => {
  const game = makeGame({ players: [{}, { computer: true }], fog: false });
  richPlayers(game);
  const built = builtUnit(game, launchAt(game, 'outpost', 300, 600).events);
  assert.ok(built);
  const b = brain('warden', 1, 1, [{ x: 300, y: 300 }, { x: 1300, y: 300 }]);
  b.observe(game);
  const odds = b.memory.citadelOdds(game);
  const citadel = citadelOf(game.state, 0);
  assert.equal(odds.get(built.id) ?? 0, 0);
  assert.ok(odds.get(citadel.id) > 0.5);
  // The copy it plans on doesn't take the real flag from the game.
  b.memory.notCitadel.add(citadel.id);
  const belief = b.memory.belief(game);
  assert.ok(!belief.state.units.find((u) => u.id === citadel.id).citadel);
});

test('thinking doesn\'t touch the real game, and a move is an ordinary, legal move', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  applyMove(game, { type: 'pass', player: 0 });
  settle(game);
  const before = hashState(game.state);
  const move = brain('lancer', 1).think(game, 1);
  assert.equal(hashState(game.state), before);
  assert.ok(applyMove(game, move).ok);
});

test('with too little to launch anything, it passes', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  applyMove(game, { type: 'pass', player: 0 });
  settle(game);
  game.state.players[1].energy = MIN_TO_PLAY - 1;
  assert.deepEqual(brain('warden', 1).think(game, 1), { type: 'pass', player: 1 });
});

test('getting its eye in: the same shot again strays less each time, down to none', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  const b = brain('drifter', 1, 5);
  b.game = game;
  const launcher = citadelOf(game.state, 1).id;
  const move = { type: 'launch', player: 1, launcher, item: 'shell', heading: 90, power: 500 };
  const c = { launcher, item: 'shell', heading: 90, power: 500, target: null };
  const offs = [];
  for (let k = 0; k < 6; k++) {
    const m = b.finish({ passValue: 0, scored: [{ c, move, v: 100 }] }, 1);
    offs.push(Math.abs(m.heading - 90) + Math.abs(m.power - 500) / 10);
  }
  assert.ok(offs[0] > 0, 'it strays at first');
  assert.equal(offs[4], 0);
  assert.equal(offs[5], 0);
});

test('the hardest computer destroys an exposed enemy Battery in reach', () => {
  const game = makeGame({ players: [{}, { computer: true }], fog: false });
  applyMove(game, { type: 'pass', player: 0 });
  settle(game);
  const battery = place(game, 'battery', 0, 1300, 680);
  const move = brain('warden', 1).think(game, 1);
  assert.equal(move.type, 'launch');
  assert.ok(applyMove(game, move).ok);
  settle(game);
  assert.ok(!game.state.units.includes(battery), `it launched ${move.item} and missed`);
});

test('it thinks in slices; the session waits about 1.5 s before its move', () => {
  const setup = makeSetup({ players: [{}, { computer: true, personality: 'mason' }] });
  const session = new Session(setup, { computers: brainsFor(setup) });
  session.pass(0);
  assert.equal(session.state.turn.player, 1);
  for (let t = 0; t < COMPUTER_MIN_MS - 100; t += 50) session.advance(50);
  assert.equal(session.moves.length, 1, 'still waiting');
  for (let t = 0; t < 30000 && session.moves.length === 1; t += 50) session.advance(50);
  assert.equal(session.moves.length, 2);
  assert.ok(['launch', 'pass'].includes(session.moves[1].type));
});

test('a game between computers on a real map: every move is accepted, and none times out', () => {
  const map = MAPS[0];
  const setup = makeSetup({ players: 2, fog: true });
  setup.map = mapData(map);
  setup.starts = map.starts[2][''].map((g) => g[0]);
  // The rules see both seats as human, so the game goes on.
  const game = createGame(setup);
  const starts = mapStarts(map.name);
  assert.ok(starts.length >= 2);
  const brains = [brain('warden', 0, 2, starts), brain('drifter', 1, 3, starts)];
  let launched = 0;
  for (let turns = 0; game.state.phase !== 'over' && game.state.round <= 6 && turns < 200; turns++) {
    const p = whoseTurn(game);
    const move = brains[p].think(game, p);
    assert.notEqual(move.type, 'timeout');
    const result = applyMove(game, move);
    assert.ok(result.ok, result.reason);
    if (move.type === 'launch') launched += 1;
    settle(game);
  }
  assert.ok(launched >= 6, 'they played');
});

test('computer players are plain JavaScript, with no Phaser or browser', () => {
  for (const file of listJsFiles('src/ai')) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from 'phaser'|\bwindow\.|\bdocument\.|\/client\//, file);
  }
});
