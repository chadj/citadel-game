// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The computer players' personalities, hardest first (spec 09,
// Personalities). Each has:
//   aim       how far its heading strays, up to, in degrees
//   power     how far its power strays, up to, as a share of the
//             launcher's range (the power runs evenly across the range)
//   judgment  0 to 1: how well it reads the game and plans; poorer
//             judgment looks at fewer moves and weighs them less surely
//   whim      how often it ignores its best plan
//   style     what it leans toward when choices are close

export const PERSONALITIES = Object.freeze([
  { id: 'warden', name: 'Warden', aim: 0, power: 0, judgment: 1, whim: 0.03, style: 'defender' },
  { id: 'forge', name: 'Forge', aim: 3, power: 0.03, judgment: 0.9, whim: 0.07, style: 'builder' },
  { id: 'lancer', name: 'Lancer', aim: 6, power: 0.06, judgment: 0.8, whim: 0.12, style: 'aggressor' },
  { id: 'mason', name: 'Mason', aim: 11, power: 0.1, judgment: 0.65, whim: 0.2, style: 'builder' },
  { id: 'sentry', name: 'Sentry', aim: 17, power: 0.14, judgment: 0.5, whim: 0.28, style: 'defender' },
  { id: 'raider', name: 'Raider', aim: 25, power: 0.19, judgment: 0.35, whim: 0.38, style: 'aggressor' },
  { id: 'drifter', name: 'Drifter', aim: 35, power: 0.25, judgment: 0.2, whim: 0.5, style: 'builder' },
].map(Object.freeze));

export const RANDOM = 'random';

// A personality by id; 'random' (or anything unknown) picks one.
export function personality(id, random = Math.random) {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[Math.floor(random() * PERSONALITIES.length)];
}

// How much each style weighs the parts of the game (spec 09, Style).
export const STYLE_WEIGHTS = Object.freeze({
  builder: { economy: 1.35, attack: 1, defense: 1 },
  aggressor: { economy: 0.9, attack: 1.35, defense: 0.9 },
  defender: { economy: 1, attack: 0.95, defense: 1.4 },
});
