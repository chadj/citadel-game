// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// A game's setup, and its checks (spec 00, Players and setup; spec 12,
// Setting up a game, When the game starts, What a replay records). The
// setup holds everything chosen before play, including what was rolled
// at random when the game started:
//
//   {
//     map: { ...map data },               // see terrain/map.js
//     players: [{ name, faction, color, team, computer }],
//     order: [2, 0, 1],                   // seats: player indexes in order of play
//     starts: [{ x, y }, ...],            // each player's start, in pixels
//     clock: 60,                          // seconds, or 0 for off
//     wind: { level, dir, variation },    // as rolled
//     fog: true,
//   }
//
// `team` is a name, or null for no team. docs/formats.md (Setup)
// describes every field.

import {
  MIN_PLAYERS, MAX_PLAYERS, MAX_COMPUTERS, FACTIONS, COLORS, CLOCK_SETTINGS,
  WIND_NONE, WIND_STRONG, MEDIUM_VARIATION, WIND_MEDIUM,
} from './constants.js';

// Checks a setup. Throws an Error listing every problem found. Returns
// each player's side: players on the same team share one; a player on
// no team, or alone on a team, is a side of one (spec 12, Teams).
export function checkSetup(setup) {
  const problems = [];
  const players = Array.isArray(setup?.players) ? setup.players : [];
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) problems.push(`a game has ${MIN_PLAYERS} to ${MAX_PLAYERS} players, not ${n}`);

  const computers = players.filter((p) => p?.computer === true).length;
  if (computers > MAX_COMPUTERS) problems.push(`at most ${MAX_COMPUTERS} players can be computers`);
  if (n > 0 && computers === n) problems.push('at least one player must be human');

  const colors = new Set();
  players.forEach((p, i) => {
    if (typeof p?.name !== 'string' || p.name === '') problems.push(`player ${i} has no name`);
    if (!Number.isInteger(p?.faction) || p.faction < 0 || p.faction >= FACTIONS) problems.push(`player ${i} has no faction`);
    if (!Number.isInteger(p?.color) || p.color < 0 || p.color >= COLORS) problems.push(`player ${i} has no color`);
    else if (colors.has(p.color)) problems.push(`player ${i}'s color is already taken`);
    else colors.add(p.color);
    if (typeof p?.computer !== 'boolean') problems.push(`player ${i} must be marked human or computer`);
    if (p?.team !== null && (typeof p?.team !== 'string' || p.team === '')) problems.push(`player ${i}'s team must be a name or null`);
  });

  // Sides, and the team layouts the game supports (spec 12, Teams).
  const members = new Map();
  players.forEach((p, i) => {
    if (typeof p?.team === 'string') members.set(p.team, [...(members.get(p.team) ?? []), i]);
  });
  const side = players.map((_, i) => i);
  const teamSizes = [];
  for (const list of members.values()) {
    if (list.length < 2) continue;
    for (const i of list) side[i] = list[0];
    teamSizes.push(list.length);
  }
  teamSizes.sort((a, b) => a - b);
  const layout = teamSizes.join('+');
  const allowed = { 2: [''], 3: ['', '2'], 4: ['', '2+2', '3'] }[n] ?? [''];
  if (!allowed.includes(layout)) problems.push(`teams of ${layout} aren't a layout the game supports with ${n} players`);

  // The order of play.
  const order = Array.isArray(setup?.order) ? setup.order : [];
  const isPermutation = order.length === n && [...order].sort((a, b) => a - b).every((v, k) => v === k);
  if (!isPermutation) problems.push('the order of play must list every player once');
  else if (layout === '2+2' && order.some((p, k) => side[p] === side[order[(k + 1) % n]])) {
    // Two teams of two alternate (spec 03, The order of play).
    problems.push('in two teams of two, the order of play must alternate between the teams');
  }

  const starts = Array.isArray(setup?.starts) ? setup.starts : [];
  if (starts.length !== n || !starts.every((s) => Number.isInteger(s?.x) && Number.isInteger(s?.y))) {
    problems.push('every player needs a start position in whole pixels');
  }

  if (!CLOCK_SETTINGS.includes(setup?.clock)) problems.push(`the shot clock must be one of ${CLOCK_SETTINGS.join(', ')}`);
  const wind = setup?.wind;
  if (!Number.isInteger(wind?.level) || wind.level < WIND_NONE || wind.level > WIND_STRONG) problems.push('the wind needs a level');
  if (!Number.isInteger(wind?.dir)) problems.push('the wind needs a direction in whole degrees');
  const variationOk = Number.isInteger(wind?.variation) && Math.abs(wind.variation) <= MEDIUM_VARIATION;
  if (!variationOk || (wind?.level !== WIND_MEDIUM && wind?.variation !== 0)) {
    problems.push('only a Medium wind varies, and by no more than its limit');
  }
  if (typeof setup?.fog !== 'boolean') problems.push('fog of war must be on or off');

  if (problems.length > 0) throw new Error(`The setup is invalid:\n- ${problems.join('\n- ')}`);
  return side;
}
