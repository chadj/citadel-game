// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Game setups for tests, and small helpers for driving a game.

import { sketchMapData } from '../../src/rules/terrain/map.js';
import { createGame, applyMove, settle } from '../../src/rules/game.js';
import { citadelOf } from '../../src/rules/units.js';
import { WIND_NONE } from '../../src/rules/constants.js';

const STARTS = [{ x: 300, y: 300 }, { x: 1300, y: 300 }, { x: 300, y: 1300 }, { x: 1300, y: 1300 }];

// A setup on flat Ground. `players` is a count, or a list of partial
// player entries. The order of play is the players' own order unless
// `order` says otherwise.
export function makeSetup({ players = 2, order, clock = 60, wind, fog = true, map } = {}) {
  const list = typeof players === 'number' ? Array.from({ length: players }, () => ({})) : players;
  const entries = list.map((p, i) => ({
    name: `P${i + 1}`,
    faction: i % 4,
    color: i,
    team: null,
    computer: false,
    ...p,
  }));
  return {
    map: map ?? sketchMapData(),
    players: entries,
    order: order ?? entries.map((_, i) => i),
    starts: STARTS.slice(0, entries.length),
    clock,
    wind: wind ?? { level: WIND_NONE, dir: 0, variation: 0 },
    fog,
  };
}

export function makeGame(options) {
  return createGame(makeSetup(options));
}

// Plays a move that must count, and lets the game settle.
export function play(game, move) {
  const result = applyMove(game, move);
  if (!result.ok) throw new Error(`move refused: ${result.reason} (${JSON.stringify(move)})`);
  settle(game);
}

export function whoseTurn(game) {
  return game.state.turn.player;
}

export const pass = (game) => play(game, { type: 'pass', player: whoseTurn(game) });
export const timeout = (game) => play(game, { type: 'timeout', player: whoseTurn(game) });

// Launches a Shell from the current player's Citadel, a short way north.
export function shell(game, item = 'shell') {
  const player = whoseTurn(game);
  play(game, { type: 'launch', player, launcher: citadelOf(game.state, player).id, item, heading: 270, power: 0 });
}

// A small seeded random number generator for tests: values in [0, 1).
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
