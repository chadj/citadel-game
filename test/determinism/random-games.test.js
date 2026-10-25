// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Spec 12, Determinism checks 1 (the same game twice) and 3 (saved and
// played back), on games of random legal moves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRecording, playReplay } from '../../src/rules/replay.js';
import { hashState } from '../../src/rules/hash.js';
import { ITEMS, canLaunch, itemCost } from '../../src/rules/items.js';
import { isLauncher, isWorking } from '../../src/rules/units.js';
import { WIND_MEDIUM, POWER_MAX } from '../../src/rules/constants.js';
import { makeSetup, seededRandom } from '../helpers/setups.js';

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

test('the games cover rounds, disconnects and the game ending', () => {
  let rounds = 0;
  let disconnects = 0;
  let over = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { game } = randomGame(seed, 2 + (seed % 3));
    rounds += game.state.round - 1;
    disconnects += game.state.players.filter((p) => p.disconnected).length;
    if (game.state.phase === 'over') over++;
  }
  assert.ok(rounds > 20, `only ${rounds} rounds`);
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
