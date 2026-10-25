// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The maps that come with the game (spec 02, Maps that come with the
// game; decisions D41, D47), smallest first. Each is map data
// (rules/terrain/map.js) plus its start positions, in pixels, in groups
// for each number of players and team layout (decision D16): the
// layout is the sizes of the teams of two or more, smallest first,
// joined with '+' ('' for no teams). Each group is one team's
// positions; a player on no team gets a group of one.

import { HANDMADE } from './handmade.js';
import { GENERATED } from './generated.js';

export const MAPS = Object.freeze([...HANDMADE, ...GENERATED]
  .map((m, k) => [m, k])
  .sort(([a, i], [b, j]) => a.rows.length - b.rows.length || i - j)
  .map(([m]) => m));

export function findMap(name) {
  return MAPS.find((m) => m.name === name) ?? null;
}

// Every start position a map offers, in any layout.
export function startPositions(map) {
  const all = new Map();
  for (const layouts of Object.values(map.starts)) {
    for (const groups of Object.values(layouts)) {
      for (const p of groups.flat()) all.set(`${p.x},${p.y}`, { x: p.x, y: p.y });
    }
  }
  return [...all.values()];
}

// The map data for a game's setup. It keeps the map's start positions,
// which everyone can know, without which went to whom.
export function mapData(map) {
  const { starts, settings, seed, ...data } = map;
  return { ...data, positions: startPositions(map) };
}
