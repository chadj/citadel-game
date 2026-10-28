// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Replays (spec 12, Replays): the game's setup and its moves, in order,
// with disconnects among them. Playing one back runs the game again.
//
//   { rulesVersion, setup, moves: [...] }
//
// docs/formats.md describes replay files, the setup and the moves.

import { RULES_VERSION } from './version.js';
import { createGame, applyMove, settle } from './game.js';
import { hashState } from './hash.js';

// A recorder: plays moves on a new game and keeps the ones that count.
export function startRecording(setup) {
  const game = createGame(setup);
  const replay = { rulesVersion: RULES_VERSION, setup, moves: [] };
  return {
    game,
    replay,
    // Applies a move, lets the game settle, and records the move if it
    // counted. Returns what applyMove returned.
    play(move) {
      const result = applyMove(game, move);
      if (result.ok) {
        replay.moves.push(move);
        settle(game);
      }
      return result;
    },
  };
}

// Plays a replay back. Returns the game, and the state hash after every
// move. A replay from different rules is refused (spec 12, What a
// replay records).
export function playReplay(replay) {
  if (replay.rulesVersion !== RULES_VERSION) {
    throw new Error(`this replay was made under rules version ${replay.rulesVersion}, not ${RULES_VERSION}`);
  }
  const game = createGame(replay.setup);
  const hashes = [hashState(game.state)];
  replay.moves.forEach((move, k) => {
    const result = applyMove(game, move);
    if (!result.ok) throw new Error(`move ${k} doesn't play back: ${result.reason}`);
    settle(game);
    hashes.push(hashState(game.state));
  });
  return { game, hashes };
}
