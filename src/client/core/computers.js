// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Computer players as the client sees them: the personalities the setup
// screen offers, hardest first, plus a random choice; and a brain for
// each computer in a game (spec 09; src/ai).

import { Brain } from '../../ai/brain.js';
import { PERSONALITIES as LIST, RANDOM } from '../../ai/personalities.js';
import { findMap, startPositions } from './maps.js';

export const PERSONALITIES = Object.freeze([
  { id: RANDOM, name: 'Random' },
  ...LIST.map(({ id, name }) => ({ id, name })),
]);

// The start positions the game's map offers, in every layout: the
// Citadels stand on some of them (spec 09, Finding the enemy's Citadel).
export function mapStarts(mapData) {
  if (mapData.positions) return mapData.positions;
  const map = findMap(mapData.name);
  return map ? startPositions(map) : [];
}

export function makeBrain(personality, player, setup) {
  return new Brain(personality, player, { starts: mapStarts(setup.map) });
}

// Each computer player's brain, for a game's setup.
export function brainsFor(setup) {
  const brains = {};
  setup.players.forEach((p, i) => {
    if (p.computer) brains[i] = makeBrain(p.personality, i, setup);
  });
  return brains;
}
