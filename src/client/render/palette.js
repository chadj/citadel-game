// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Colors: the six player colors, and each planet's ground and water
// (spec 02, Planets, What players see; spec 04, Owner). All our own.

// Player colors, as 0xRRGGBB.
export const PLAYER_COLORS = Object.freeze([
  0xe8483b, // red
  0x3b8be8, // blue
  0x3fc463, // green
  0xf0c419, // yellow
  0xb05be8, // violet
  0xf08a24, // orange
]);

export const PLAYER_COLOR_NAMES = Object.freeze(['Red', 'Blue', 'Green', 'Yellow', 'Violet', 'Orange']);

export const FACTION_NAMES = Object.freeze(['Ion Mercantile', 'Rivet & Ash', 'Toroid Drift', 'Crater Born']);

// Per planet: the levels' colors (Ground, Plateau, Mountain), the slope
// tint, and the water: deep and shallow. Splashes use the water colors.
export const PLANET_COLORS = Object.freeze({
  tundra: { levels: [0x8e9aa3, 0xa9b4bb, 0xd2d9dd], water: [0x2b4f6e, 0x4f7f9f] },
  canyon: { levels: [0xa65a35, 0xc27548, 0xdc9a6a], water: [0x3a4f5c, 0x5f7f86] },
  toxic: { levels: [0x6c7a33, 0x8a9a43, 0xb3bf6a], water: [0x3f5b1d, 0x7d9b2a] },
  glacier: { levels: [0xbfd3df, 0xd6e4ec, 0xf4f8fb], water: [0x1f4f7a, 0x4d86b3] },
  plains: { levels: [0x5f8f45, 0x7aa655, 0xa0be7a], water: [0x245a7a, 0x3f86a8] },
  desert: { levels: [0xc8a76a, 0xd7ba80, 0xe8d3a3], water: [0x2f6b78, 0x56a0a8] },
});

export const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

// A color scaled toward black (k < 1) or white (k > 1).
export function shade(c, k) {
  const [r, g, b] = rgb(c);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

export const css = (c) => `#${c.toString(16).padStart(6, '0')}`;
