// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Plays two computers against each other on a map that comes with the
// game, with no browser, and prints what they did: their launches,
// failed landings and lost items, where their Pontoons went, hits on
// their Citadels, the units left at the end, and the slowest think.
// Both computers watch every flight and every move, as in a real game. For checking how computer
// players behave after a change (spec 09).
//
//   node tools/ai-match.js "Long Meadow"
//   node tools/ai-match.js "Twin Ridges" --rounds 7 --seed 3 --map
//   node tools/ai-match.js "Ice Shelf" --players warden,drifter
//
//   --rounds n      stop after round n (12)
//   --seed n        the computers' random seed (1)
//   --players a,b   the two personalities (warden,drifter)
//   --fog off       play without fog of war
//   --map           also draw the map at the end, a tile to a letter

import { createGame, applyMove, step } from '../src/rules/game.js';
import { WIND_NONE, WET } from '../src/rules/constants.js';
import { sampleTerrain, tileIndex } from '../src/rules/terrain/terrain.js';
import { Brain, seeded } from '../src/ai/brain.js';
import { landAt } from '../src/ai/land.js';
import { MAPS, mapData } from '../src/maps/index.js';
import { PX } from '../src/rules/math/fixed.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 ? args[k + 1] : fallback;
};
const name = args[0];
const rounds = Number(option('rounds', 12));
const seed = Number(option('seed', 1));
const personalities = option('players', 'warden,drifter').split(',');
const map = MAPS.find((m) => m.name === name);
if (!map) {
  console.error(`No map "${name}". The maps: ${MAPS.map((m) => m.name).join(', ')}`);
  process.exit(1);
}

// Both seats are human to the rules, so the game goes on; the computers
// play them here.
const setup = {
  map: mapData(map),
  players: personalities.map((_, i) => ({ name: `P${i}`, faction: i, color: i, team: null, computer: false })),
  order: [0, 1],
  starts: map.starts[2][''].map(([p]) => p),
  clock: 0,
  wind: { level: WIND_NONE, dir: 0, variation: 0 },
  fog: option('fog', 'on') !== 'off',
};
const game = createGame(setup);
const brains = personalities.map((p, i) => new Brain(p, i, { starts: setup.starts, random: seeded(seed + i) }));

// Whether a Pontoon has dry land of two different stretches around it:
// it joins land that water parts (decision D58).
const joinsLand = (u) => {
  const stretches = new Set();
  for (let a = 0; a < 16; a++) {
    const l = landAt(game.map, u.x + Math.cos((a * Math.PI) / 8) * 50 * PX, u.y + Math.sin((a * Math.PI) / 8) * 50 * PX);
    if (l >= 0) stretches.add(l);
  }
  return stretches.size >= 2;
};

const tally = {};
let gone = []; // units destroyed during the last move, to look up
const add = (key) => {
  tally[key] = (tally[key] ?? 0) + 1;
};
let slowest = 0;
for (let turns = 0; game.state.phase !== 'over' && game.state.round <= rounds && turns < 400; turns++) {
  const p = game.state.turn.player;
  gone = game.state.units.map((u) => ({ ...u }));
  const started = performance.now();
  const move = brains[p].think(game, p);
  slowest = Math.max(slowest, performance.now() - started);
  if (move.type === 'launch') add(`P${p} launch ${move.item}`);
  else add(`P${p} ${move.type}`);
  const before = game.events.length;
  const result = applyMove(game, move);
  if (!result.ok) {
    add(`P${p} REFUSED ${result.reason}`);
    applyMove(game, { type: 'pass', player: p });
  }
  while (game.state.phase === 'flight' || game.state.phase === 'rovers') {
    step(game);
    for (const b of brains) b.watch(game);
  }
  for (const b of brains) b.observe(game);
  for (const e of game.events.slice(before)) {
    if (e.type === 'damage' && game.state.units.concat(gone).find((u) => u.id === e.unit)?.citadel) add(`P${e.owner} Citadel hit`);
    if (e.type === 'buildingFailed') add(`P${p} failed ${e.kind} (${e.reason})`);
    if (e.type === 'pontoonLost') add(`P${p} Pontoon lost`);
    if (e.type === 'built' && e.kind === 'pontoon') {
      const u = game.state.units.find((x) => x.id === e.unit);
      if (u) add(`P${p} Pontoon ${joinsLand(u) ? 'joins parted land' : 'on water land goes round'}`);
    }
  }
}

for (const [i, b] of brains.entries()) {
  tally[`P${i} leads to the enemy at the end`] = b.memory.leads.length;
}
const units = {};
for (const u of game.state.units) units[`P${u.owner} ${u.kind}`] = (units[`P${u.owner} ${u.kind}`] ?? 0) + 1;
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
console.log(`${name}: ${personalities.join(' v ')}, seed ${seed}; ended in round ${game.state.round}` +
  `${game.state.phase === 'over' ? ` (won by P${game.events.find((e) => e.type === 'gameOver')?.winner})` : ''}; slowest think ${Math.round(slowest)} ms`);
console.log('Moves and events:', sorted(tally));
console.log('Units at the end:', sorted(units));

// The map: ~ water, . land, a digit for land apart from the main
// stretch, V a free vent, C a Citadel, O/o Outposts, P/p Pontoons (the
// capital for player 0).
if (args.includes('--map')) {
  const m = game.map;
  const tile = m.size / m.tiles;
  const rows = [];
  for (let ty = 0; ty < m.tiles; ty++) {
    let row = '';
    for (let tx = 0; tx < m.tiles; tx++) {
      const x = tx * tile + tile / 2;
      const y = ty * tile + tile / 2;
      const here = game.state.units.filter((u) => tileIndex(m, u.x, u.y) === tileIndex(m, x, y));
      const mark = (kind, ch) => {
        const u = here.find((v) => v.kind === kind);
        return u && (u.owner === 0 ? ch : ch.toLowerCase());
      };
      row += (here.some((u) => u.citadel) && 'C') || mark('pontoon', 'P') || mark('outpost', 'O')
        || (m.vents.some((v) => tileIndex(m, v.x, v.y) === tileIndex(m, x, y)) && 'V')
        || (sampleTerrain(m, x, y).type === WET ? '~' : landAt(m, x, y) > 0 ? String(landAt(m, x, y) % 10) : '.');
    }
    rows.push(row);
  }
  console.log(rows.join('\n'));
}
