// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What a position is worth to a computer (spec 09, Reading the game,
// What things are worth). Everything is counted in tenths of energy, as
// energy is, so a move that spends energy has to buy more than it
// costs. The parts:
//   - energy: what it will have next round, up to the cap; what's lost
//     over the cap is worth nothing;
//   - units: each of its own adds its worth, each enemy one takes its
//     worth away. A conduit's burn takes out a whole tree in the copy of
//     the game, so what burns after a unit counts by itself;
//   - reach: vents, enemy units and likely enemy starts its launchers
//     reach;
//   - threats: its units in enemy reach, less what its Barriers,
//     Interceptors and Charges cover; Rovers' lines; Worms; its own
//     Extractors beside its precious buildings;
//   - sight: with fog on, how much of the map its side sees.

import { PX, WET, NODE_SPACING, ENERGY_CAP, VENT_EXTRACTOR_INCOME, EXTRACTOR_INCOME, INTERCEPTOR_RANGE, DOME_RADIUS, ROVER_DRIVE, ROVER_BLAST, EXTRACTOR_BLAST, CHARGE_BLAST } from '../rules/constants.js';
import { UNIT_KINDS, isWorking } from '../rules/units.js';
import { roundIncome } from '../rules/energy.js';
import { isGone } from '../rules/conduits.js';
import { delta } from '../rules/math/wrap.js';
import { sampleTerrain, tileIndex } from '../rules/terrain/terrain.js';
import { landDistance } from './land.js';

const BASE = Object.freeze({
  outpost: 60, battery: 55, extractor: 25, barrier: 35, interceptor: 14, spire: 2,
  pontoon: 8, skyProbe: 4, charge: 6, rover: 20,
});
const OWN_CITADEL = 700;
const ENEMY_CITADEL = 600;
const REACH = Object.freeze({ outpost: 500 * PX, battery: 900 * PX });
const SIGHT_CELL = 0.02;

const d2 = (size, a, b) => {
  const dx = delta(a.x, b.x, size);
  const dy = delta(a.y, b.y, size);
  return dx * dx + dy * dy;
};

// How much a place `d` away counts, for a launcher reaching `r`: in
// reach, in full; out of reach, much less, and less the further it is,
// so getting closer still counts for something.
const within = (d, r) => (d <= 0.85 * r ? 1 : Math.max(0, 0.6 * (1 - (d - 0.85 * r) / (2 * r))));

// How far a launcher reaches, about: more from high ground.
export function reachOf(u) {
  return REACH[u.kind] + Math.max(0, u.base);
}

// Things a computer works out once a turn, before it weighs its moves.
export function planFor(game, player, personality, weights, memory) {
  const j = personality.judgment;
  const round = game.state.round;
  return {
    player,
    side: game.sides[player],
    weights,
    // How many rounds ahead income counts: further for good judgment,
    // and less as the game goes on (spec 09, An Extractor).
    horizon: (3 + 5 * j) * Math.max(0.45, 1 - round / 25),
    odds: memory.citadelOdds(game),
    unseenStarts: memory.unseenStarts(),
    fog: !!game.state.fog,
    knownEnemies: memory.units.size,
    round0: round,
    knockedOut0: game.state.players.map((p, i) => [i, p.knockedOut]),
  };
}

// A unit's worth to its owner.
export function unitWorth(plan, u, ownSide) {
  const spec = UNIT_KINDS[u.kind];
  let v = BASE[u.kind];
  if (u.kind === 'extractor') {
    const income = u.onVent ? VENT_EXTRACTOR_INCOME : EXTRACTOR_INCOME;
    v += income * (ownSide ? plan.horizon : Math.min(plan.horizon, 4)) * plan.weights.economy;
  }
  if (u.kind === 'outpost') {
    if (ownSide && u.citadel) v = OWN_CITADEL;
    else if (!ownSide) v += (plan.odds.get(u.id) ?? 0) * ENEMY_CITADEL;
  }
  return v * (0.55 + (0.45 * u.armor) / spec.armor);
}

export function evaluate(game, plan) {
  const s = game.state;
  const size = game.map.size;
  const me = s.players[plan.player];
  const mine = [];
  const theirs = [];
  for (const u of s.units) (game.sides[u.owner] === plan.side ? mine : theirs).push(u);
  const w = plan.weights;
  let value = 0;

  // Energy next round.
  const roundEnded = s.round > plan.round0;
  const next = roundEnded ? me.energy : me.energy + roundIncome(s, plan.player);
  value += Math.min(ENERGY_CAP, next);
  // Enough for a level 7 launch is worth a little more (spec 09, Save
  // for big moves).
  value += 8 * Math.floor(Math.min(ENERGY_CAP, next) / 70);
  // The bonus the copy pays for its stand-in Citadel isn't real.
  for (const [i, was] of plan.knockedOut0) if (!was && s.players[i].knockedOut) value -= 70;

  // Units.
  const worth = new Map();
  for (const u of mine) {
    const v = unitWorth(plan, u, true);
    worth.set(u.id, v);
    value += v;
  }
  for (const u of theirs) {
    let v = unitWorth(plan, u, false);
    if (!isWorking(s, u) && (u.kind === 'interceptor' || u.kind === 'barrier' || u.kind === 'outpost' || u.kind === 'battery')) v *= 0.85;
    value -= v * w.attack;
  }

  // Reach: what its launchers can get at.
  const launchers = mine.filter((u) => u.kind === 'outpost' || u.kind === 'battery');
  const outposts = launchers.filter((u) => u.kind === 'outpost');
  // `dry`: a building's conduit can't cross water without Pontoons (spec
  // 02, Water). So a place over the water counts as far away as the way
  // round by land; and if land doesn't get there, for little (decision
  // D58).
  const bridges = s.units.filter((u) => u.kind === 'pontoon').map((u) => u.id).join(',');
  const covered = (p, list, dry = false) => {
    let best = 0;
    for (const l of list) {
      const r = reachOf(l);
      const d = Math.sqrt(d2(size, l, p));
      let f = within(d, r);
      if (f > best && dry && wetBetween(game, plan, l, p, Math.min(d, 0.85 * r), bridges)) {
        f = Math.max(0.2 * f, within(landDistance(game.map, p, l), r));
      }
      if (f > best) best = f;
    }
    return best;
  };
  for (const vent of game.map.vents) {
    const taken = s.units.some((u) => d2(size, u, vent) < vent.radius * vent.radius);
    if (!taken) value += 55 * w.economy * covered(vent, outposts, true);
  }
  for (const u of theirs) value += 0.15 * unitWorth(plan, u, false) * w.attack * covered(u, launchers);
  if (plan.knownEnemies < 4) {
    for (const st of plan.unseenStarts) value += 70 * w.attack * covered(st, outposts, true);
  }

  // Threats.
  const enemyLaunchers = theirs.filter((u) => (u.kind === 'outpost' || u.kind === 'battery') && !s.players[u.owner].knockedOut);
  const myInterceptors = mine.filter((u) => u.kind === 'interceptor' && isWorking(s, u));
  const myBarriers = mine.filter((u) => u.kind === 'barrier' && u.up && isWorking(s, u));
  const myCharges = mine.filter((u) => u.kind === 'charge');
  let danger = 0;
  for (const u of mine) {
    if (u.kind === 'charge' || u.kind === 'rover' || u.kind === 'skyProbe') continue;
    let threats = 0;
    for (const l of enemyLaunchers) if (d2(size, l, u) <= (reachOf(l) + 60 * PX) ** 2) threats += 1;
    if (threats === 0) continue;
    let cover = 0;
    for (const i of myInterceptors) if (i !== u && d2(size, i, u) <= INTERCEPTOR_RANGE ** 2) cover += 0.38;
    for (const b of myBarriers) if (d2(size, b, u) <= (DOME_RADIUS - 20 * PX) ** 2) cover += 0.7;
    for (const c of myCharges) if (d2(size, c, u) <= (130 * PX) ** 2) cover += 0.15;
    danger += worth.get(u.id) * 0.13 * Math.min(2, threats) * (1 - Math.min(0.85, cover));
  }
  // Worms eat into what they infect.
  for (const u of mine) if (u.worm) danger += worth.get(u.id) * 0.15;
  // Its own Extractors and Charges beside its other units: their
  // blasts hurt everyone.
  for (const e of mine) {
    const blast = e.kind === 'extractor' ? EXTRACTOR_BLAST : e.kind === 'charge' ? CHARGE_BLAST : null;
    if (!blast) continue;
    for (const u of mine) {
      if (u !== e && u.kind !== 'charge' && d2(size, e, u) <= blast.radius ** 2) danger += worth.get(u.id) * 0.06;
    }
  }
  value -= danger * w.defense;

  // Rovers: where each one's line meets something, and its blast there.
  for (const r of [...mine, ...theirs]) {
    if (r.kind !== 'rover' || r.triggered) continue;
    const ours = game.sides[r.owner] === plan.side;
    // Its facing shows its heading only to within about 20°.
    let sum = 0;
    const tries = ours ? [0] : [-20, -10, 0, 10, 20];
    for (const off of tries) {
      const hit = roverStop(game, r, r.heading + off);
      if (!hit) continue;
      let lose = 0;
      let gain = 0;
      for (const u of s.units) {
        if (u === r || d2(size, u, hit) > ROVER_BLAST.radius ** 2) continue;
        if (game.sides[u.owner] === plan.side) lose += worth.get(u.id) ?? 0;
        else gain += unitWorth(plan, u, false) * w.attack;
      }
      sum += (ours ? 0.45 * gain - 0.3 * lose : -0.5 * lose * w.defense);
    }
    value += sum / tries.length;
  }

  // Sight.
  if (plan.fog && s.fog) {
    const counts = s.fog.counts[plan.side];
    let seen = 0;
    for (let k = 0; k < counts.length; k++) if (counts[k] > 0) seen += 1;
    // Scouting starts as the networks near each other, not in the
    // opening.
    const opening = Math.min(1, plan.round0 / 4);
    value += seen * SIGHT_CELL * opening * (plan.knownEnemies < 3 ? 1 : 0.35);
  }
  return value;
}

// Whether there's water without a Pontoon on the line from a launcher
// toward a point, within `far`. Remembered for the turn.
function wetBetween(game, plan, from, to, far, bridges) {
  const key = `${from.x},${from.y},${to.x},${to.y},${Math.round(far)}|${bridges}`;
  const cache = (plan.wet ??= new Map());
  if (cache.has(key)) return cache.get(key);
  const size = game.map.size;
  const dx = delta(from.x, to.x, size);
  const dy = delta(from.y, to.y, size);
  const len = Math.hypot(dx, dy) || 1;
  const tops = new Map();
  for (const u of game.state.units) if (u.kind === 'pontoon') tops.set(tileIndex(game.map, u.x, u.y), u.base + UNIT_KINDS.pontoon.height);
  let wet = false;
  // As closely as conduit nodes settle, so a pond or a channel half a
  // tile wide isn't stepped over (spec 02, Landforms).
  for (let d = NODE_SPACING; d <= far && !wet; d += NODE_SPACING) {
    if (sampleTerrain(game.map, from.x + (dx * d) / len, from.y + (dy * d) / len, tops).type === WET) wet = true;
  }
  cache.set(key, wet);
  return wet;
}

// Where a Rover driving on along a heading first meets another unit or
// a conduit, within about two rounds' drive; or null.
function roverStop(game, rover, heading) {
  const s = game.state;
  const size = game.map.size;
  const a = (heading * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const step = 15 * PX;
  const reachUnit = 20 * PX;
  for (let d = step; d <= 2 * ROVER_DRIVE; d += step) {
    const p = { x: rover.x + cos * d, y: rover.y + sin * d };
    for (const u of s.units) {
      if (u === rover) continue;
      const r = UNIT_KINDS[u.kind].radius + reachUnit;
      if (d2(size, u, p) <= r * r) return p;
    }
    for (const c of s.conduits) {
      for (const n of c.nodes) if (!isGone(s, n) && d2(size, n, p) <= (12 * PX) ** 2) return p;
    }
  }
  return null;
}
