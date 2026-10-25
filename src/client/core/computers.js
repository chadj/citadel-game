// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Computer players as the client sees them: the personalities the setup
// screen offers, and a brain for each computer in a game (spec 09). A
// brain is { think(game, player) → move }.
//
// Until the computer players are written, a computer passes.

export const PERSONALITIES = Object.freeze([{ id: 'random', name: 'Random' }]);

export function makeBrain() {
  return { think: (game, player) => ({ type: 'pass', player }) };
}

// Each computer player's brain, for a game's setup.
export function brainsFor(setup) {
  const brains = {};
  setup.players.forEach((p, i) => {
    if (p.computer) brains[i] = makeBrain(p.personality, i, setup);
  });
  return brains;
}
