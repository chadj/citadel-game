// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What's chosen at random when a game starts (spec 12, When the game
// starts): the order of play, each player's start position, and the
// wind. They're chosen once, here, and go into the setup, so every
// machine and every replay gets the same result. `random` returns
// values in [0, 1).

import { MEDIUM_VARIATION, WIND_MEDIUM, FACTIONS, COLORS } from '../../rules/constants.js';
import { mapData } from './maps.js';

// The team layout: sizes of the teams of two or more, smallest first.
export function teamLayout(players) {
  const sizes = new Map();
  for (const p of players) if (p.team !== null) sizes.set(p.team, (sizes.get(p.team) ?? 0) + 1);
  return [...sizes.values()].filter((k) => k >= 2).sort((a, b) => a - b).join('+');
}

// Each team as a list of player indexes; a player on no team, or alone
// on a team, is a team of one.
export function teamsOf(players) {
  const byName = new Map();
  const teams = [];
  players.forEach((p, i) => {
    if (p.team !== null && players.filter((q) => q.team === p.team).length >= 2) {
      if (!byName.has(p.team)) {
        byName.set(p.team, []);
        teams.push(byName.get(p.team));
      }
      byName.get(p.team).push(i);
    } else {
      teams.push([i]);
    }
  });
  return teams;
}

export function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Start positions (decision D16): teams get the map's groups at random,
// among groups of their size, and players get their group's positions
// at random.
export function rollStarts(map, players, random) {
  const groups = map.starts[players.length]?.[teamLayout(players)];
  if (!groups) throw new Error(`${map.name} has no start positions for this many players and these teams`);
  const starts = new Array(players.length);
  const teams = teamsOf(players);
  const sizes = [...new Set(teams.map((t) => t.length))];
  for (const size of sizes) {
    const ts = shuffle(teams.filter((t) => t.length === size), random);
    const gs = shuffle(groups.filter((g) => g.length === size), random);
    ts.forEach((team, k) => {
      const spots = shuffle(gs[k], random);
      team.forEach((player, m) => {
        starts[player] = { ...spots[m] };
      });
    });
  }
  return starts;
}

// The order of play: random, with two teams of two alternating
// (spec 03, The order of play).
export function rollOrder(players, random) {
  if (teamLayout(players) === '2+2') {
    const [t1, t2] = shuffle(teamsOf(players), random).map((t) => shuffle(t, random));
    return [t1[0], t2[0], t1[1], t2[1]];
  }
  return shuffle(players.map((_, i) => i), random);
}

// The wind for a level (spec 01, Wind): a random direction, and for
// Medium a little variation.
export function rollWind(level, random) {
  const dir = Math.floor(random() * 360);
  const variation = level === WIND_MEDIUM ? Math.round((random() * 2 - 1) * MEDIUM_VARIATION) : 0;
  return { level, dir, variation };
}

// The setup for a game from the choices made on the setup screen.
export function rollSetup({ map, players, clock, wind, fog }, random = Math.random) {
  return {
    map: mapData(map),
    players: players.map((p) => ({
      name: p.name,
      faction: p.faction,
      color: p.color,
      team: p.team,
      computer: p.computer,
      ...(p.computer ? { personality: p.personality } : {}),
    })),
    order: rollOrder(players, random),
    starts: rollStarts(map, players, random),
    clock,
    wind: rollWind(wind, random),
    fog,
  };
}

// A new computer's faction and color (spec 12, Computer players): a
// faction no other player has, if one is free, and a free color.
export function computerLooks(players, random) {
  const freeFactions = [...Array(FACTIONS).keys()].filter((f) => !players.some((p) => p.faction === f));
  const factions = freeFactions.length > 0 ? freeFactions : [...Array(FACTIONS).keys()];
  const colors = [...Array(COLORS).keys()].filter((c) => !players.some((p) => p.color === c));
  return {
    faction: factions[Math.floor(random() * factions.length)],
    color: colors[Math.floor(random() * colors.length)],
  };
}

// A color for a player who asks for one: theirs if it's free, or else a
// random free one (spec 12, What each player chooses).
export function claimColor(players, me, wanted, random) {
  if (!players.some((p, i) => i !== me && p.color === wanted)) return wanted;
  const free = [...Array(COLORS).keys()].filter((c) => !players.some((p, i) => i !== me && p.color === c));
  return free[Math.floor(random() * free.length)];
}
