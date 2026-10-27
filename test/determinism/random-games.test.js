// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Spec 12, Determinism checks 1 (the same game twice) and 3 (saved and
// played back), on games of random legal moves; and a game's end on a
// machine that keeps the fog up during flights and one that doesn't.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRecording, playReplay } from '../../src/rules/replay.js';
import { hashState } from '../../src/rules/hash.js';
import { ITEMS, canLaunch, itemCost } from '../../src/rules/items.js';
import { isLauncher, isWorking, citadelOf } from '../../src/rules/units.js';
import { WIND_MEDIUM, POWER_MAX } from '../../src/rules/constants.js';
import { createGame, applyMove, settle } from '../../src/rules/game.js';
import { makeSetup, seededRandom } from '../helpers/setups.js';
import { aimAt } from '../helpers/build.js';

const ITEM_IDS = Object.keys(ITEMS);

// Plays a game of random moves. Returns the replay and the state hash
// after every move.
function randomGame(seed, players) {
  const random = seededRandom(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const setup = makeSetup({
    players: Array.from({ length: players }, (_, i) => ({ computer: i > 0 && random() < 0.4 })),
    clock: pick([0, 15, 30, 60]),
    wind: { level: WIND_MEDIUM, dir: Math.floor(random() * 360), variation: Math.floor(random() * 19661) - 9830 },
  });
  const recording = startRecording(setup);
  const { game } = recording;
  const hashes = [hashState(game.state)];
  for (let k = 0; k < 150 && game.state.phase !== 'over'; k++) {
    const s = game.state;
    const player = s.turn.player;
    let move;
    const roll = random();
    if (roll < 0.01) {
      move = { type: 'disconnect', player: Math.floor(random() * players) };
    } else if (roll < 0.15) {
      move = { type: 'pass', player };
    } else if (roll < 0.22) {
      move = { type: 'timeout', player };
    } else {
      const launchers = s.units.filter((u) => u.owner === player && isLauncher(u) && isWorking(s, u));
      const launcher = launchers.length ? pick(launchers) : null;
      const items = launcher
        ? ITEM_IDS.filter((id) => canLaunch(launcher.kind, id) && itemCost(id) <= s.players[player].energy)
        : [];
      move = items.length
        ? {
            type: 'launch', player, launcher: launcher.id, item: pick(items),
            heading: Math.floor(random() * 360), power: Math.floor(random() * (POWER_MAX + 1)),
          }
        : { type: 'pass', player };
    }
    if (recording.play(move).ok) hashes.push(hashState(game.state));
  }
  return { replay: recording.replay, hashes, game };
}

test('the same setup and moves give the same game, after every move', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const players = 2 + (seed % 3);
    const live = randomGame(seed, players);
    const again = playReplay(live.replay);
    const third = playReplay(live.replay);
    assert.deepEqual(again.hashes, live.hashes, `seed ${seed}`);
    assert.deepEqual(third.hashes, live.hashes, `seed ${seed}`);
    assert.ok(live.replay.moves.length > 10, `seed ${seed} played too few moves`);
  }
});

test('a replay saved as a file plays back the same', () => {
  const live = randomGame(99, 4);
  const file = JSON.stringify(live.replay);
  const back = playReplay(JSON.parse(file));
  assert.deepEqual(back.hashes, live.hashes);
});

test('the games cover rounds, disconnects, the game ending, and the systems that interact', () => {
  let rounds = 0;
  let disconnects = 0;
  let over = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const { game } = randomGame(seed, 2 + (seed % 3));
    rounds += game.state.round - 1;
    disconnects += game.state.players.filter((p) => p.disconnected).length;
    if (game.state.phase === 'over') over++;
    for (const e of game.events) seen.add(e.type);
  }
  assert.ok(rounds > 20, `only ${rounds} rounds`);
  for (const type of ['built', 'nodeBurnt', 'blast', 'interceptorFired', 'infected', 'roverDrives', 'stopped']) {
    assert.ok(seen.has(type), `no ${type} events`);
  }
  assert.ok(disconnects > 0, 'no disconnects');
  assert.ok(over > 0, 'no game ended');
});

test('a replay from different rules is refused', () => {
  const { replay } = randomGame(5, 2);
  assert.throws(() => playReplay({ ...replay, rulesVersion: replay.rulesVersion + 1 }), /rules version/);
});

test('a replay with a move that doesn\'t count is refused', () => {
  const { replay } = randomGame(6, 2);
  const broken = { ...replay, moves: [{ type: 'pass', player: 1 }, ...replay.moves] };
  assert.throws(() => playReplay(broken), /move 0 doesn't play back/);
});

test('a game that ends with a shot ends the same with the fog kept up during the flight or not', () => {
  // The screen keeps the fog up as shots fly; the server doesn't. The
  // winning shot leaves no next turn to bring them back together.
  const setup = makeSetup();
  const games = [createGame(setup), createGame(setup)];
  games[0].liveFog = true;
  for (const game of games) {
    const from = citadelOf(game.state, 0);
    const target = citadelOf(game.state, 1);
    target.armor = 1;
    target.x = from.x + 400 * 1024; // in reach
    const { heading, power } = aimAt(game, from, target.x / 1024, target.y / 1024);
    assert.ok(applyMove(game, { type: 'launch', player: 0, launcher: from.id, item: 'shell', heading, power }).ok);
    settle(game);
    assert.equal(game.state.phase, 'over');
  }
  assert.equal(hashState(games[0].state), hashState(games[1].state));
});
