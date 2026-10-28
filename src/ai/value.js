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
//     Interceptors and Charges cover, and far more for those under
//     attack, and its Citadel; Rovers' lines; Worms; its own Extractors
//     beside its precious buildings (decision D59);
//   - sight: with fog on, how much of the map its side sees, and the
//     leads to the enemy it can see the place of.

import { PX, FOG_CELL, WET, NODE_SPACING, ENERGY_CAP, VENT_EXTRACTOR_INCOME, EXTRACTOR_INCOME, INTERCEPTOR_RANGE, DOME_RADIUS, ROVER_DRIVE, ROVER_BLAST, EXTRACTOR_BLAST, CHARGE_BLAST } from '../rules/constants.js';
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
const ALARM = 1.5; // how much more danger a building under attack is in
const EMERGENCY = 60; // its Citadel threatened with nothing covering it (spec 09)
const RETALIATE = 100; // harm to a launcher attacking it, all its armor gone
const BLOCKED = 25; // its own Charges in the way of its fire at an enemy launcher
const MORE_LAUNCHERS = 0.6; // what each enemy launcher in reach past the first adds

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
    // Its own units under attack, as id → heat (decision D59); and the
    // places it has a lead to the enemy, other than launchers it guessed.
    attacked: memory.attacked(game.state),
    leads: memory.leads.filter((l) => l.kind !== 'shooter'),
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
    // The game rides on its own Citadel, however hurt it is.
    if (ownSide && u.citadel) return OWN_CITADEL;
    if (!ownSide) v += (plan.odds.get(u.id) ?? 0) * ENEMY_CITADEL;
  }
  // A launcher guessed from where a shot came from may not be there.
  if (u.guess !== undefined) v *= 0.6 * u.guess;
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
    for (const l of plan.leads) value += 35 * w.attack * covered(l, outposts, true);
  }

  // Threats.
  const enemyLaunchers = theirs.filter((u) => (u.kind === 'outpost' || u.kind === 'battery') && !s.players[u.owner].knockedOut);
  const myInterceptors = mine.filter((u) => u.kind === 'interceptor' && isWorking(s, u));
  const myBarriers = mine.filter((u) => u.kind === 'barrier' && u.up && isWorking(s, u));
  const myCharges = mine.filter((u) => u.kind === 'charge');
  // Charges within each other's blast go off together: a group of them
  // stops one shot, once (spec 04, Blasts can chain).
  const chains = chargeChains(size, myCharges);
  let danger = 0;
  for (const u of mine) {
    if (u.kind === 'charge' || u.kind === 'rover' || u.kind === 'skyProbe') continue;
    // A guessed launcher counts for as much as it's trusted.
    let threats = 0;
    for (const l of enemyLaunchers) if (d2(size, l, u) <= (reachOf(l) + 60 * PX) ** 2) threats += l.guess ?? 1;
    // Under attack: something reaches it, seen or not. Knowing where
    // from counts for more, so firing back there helps.
    const heat = plan.attacked.get(u.id) ?? 0;
    if (heat > 0) threats = Math.max(0.5, threats);
    if (threats === 0) continue;
    let cover = 0;
    // An Interceptor guards it from the side it stands on: full within
    // about 45° of the nearest enemy launcher in reach, little at 90°, and
    // nothing from behind.
    let foe = null;
    for (const l of enemyLaunchers) {
      if (d2(size, l, u) <= (reachOf(l) + 60 * PX) ** 2 && (!foe || d2(size, l, u) < d2(size, foe, u))) foe = l;
    }
    for (const i of myInterceptors) if (i !== u && d2(size, i, u) <= INTERCEPTOR_RANGE ** 2) cover += 0.38 * facing(size, u, i, foe);
    for (const b of myBarriers) if (d2(size, b, u) <= (DOME_RADIUS - 20 * PX) ** 2) cover += 0.7;
    // A group whose blast reaches it does it the harm of the shot it stops.
    for (const chain of chains) {
      if (chain.some((c) => d2(size, c, u) <= (130 * PX) ** 2) && !chain.some((c) => reaches(size, c, CHARGE_BLAST, u))) cover += 0.15;
    }
    const pressure = threats <= 1 ? threats : 1 + MORE_LAUNCHERS * (threats - 1);
    let d = worth.get(u.id) * 0.13 * pressure * (1 + ALARM * heat) * (1 - Math.min(0.85, cover));
    if (u.citadel) {
      // The more it's hurt, the more urgent; and with nothing covering
      // it, an emergency.
      d *= 2 - u.armor / UNIT_KINDS.outpost.armor;
      if (cover === 0) d += EMERGENCY * (1 + heat);
    }
    danger += d;
  }
  // Firing back: harm done to an enemy launcher that reaches what's
  // under attack, seen or guessed, puts the attacker on its guard.
  let alarm = 0;
  for (const h of plan.attacked.values()) alarm = Math.max(alarm, h);
  if (alarm > 0) {
    const attacked = mine.filter((u) => plan.attacked.has(u.id));
    for (const l of enemyLaunchers) {
      if (!attacked.some((u) => d2(size, l, u) <= (reachOf(l) + 60 * PX) ** 2)) continue;
      value += RETALIATE * alarm * w.attack * (l.guess ?? 1) * (1 - l.armor / UNIT_KINDS[l.kind].armor);
    }
  }
  // Worms eat into what they infect.
  for (const u of mine) if (u.worm) danger += worth.get(u.id) * 0.15;
  // Its own Extractors beside its other units: their blasts hurt
  // everyone.
  for (const e of mine) {
    if (e.kind !== 'extractor') continue;
    for (const u of mine) if (u !== e && u.kind !== 'charge' && reaches(size, e, EXTRACTOR_BLAST, u)) danger += worth.get(u.id) * 0.06;
  }
  // Its own Charges beside its other units: any shot sets a group of
  // them off, and each one whose blast reaches a unit hurts it. Enough to
  // destroy it counts as losing it, more so where enemy launchers reach
  // (spec 09: keep them clear of its own buildings).
  for (const u of mine) {
    if (u.kind === 'charge' || u.kind === 'rover' || u.kind === 'skyProbe') continue;
    let worst = 0;
    for (const chain of chains) worst = Math.max(worst, chain.filter((c) => reaches(size, c, CHARGE_BLAST, u)).length * CHARGE_BLAST.damage);
    if (worst === 0) continue;
    const exposed = plan.attacked.has(u.id) || enemyLaunchers.some((l) => d2(size, l, u) <= (reachOf(l) + 60 * PX) ** 2) ? 0.6 : 0.2;
    const share = worst >= u.armor ? 1 : worst / UNIT_KINDS[u.kind].armor;
    danger += worth.get(u.id) * share * exposed;
  }
  value -= danger * w.defense;

  // Its own Charges in the way of its own launchers' fire at the enemy:
  // its shots set them off too (spec 06, Proximity Charges).
  for (const l of launchers) {
    for (const e of enemyLaunchers) {
      if (d2(size, l, e) > (reachOf(l) + 60 * PX) ** 2) continue;
      if (chains.some((chain) => chain.some((c) => inTheWay(size, l, e, c)))) value -= BLOCKED * w.attack * (e.guess ?? 1);
    }
  }

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
    // Seeing the place a lead points to.
    const n = s.fog.cells;
    for (const l of plan.leads) {
      const k = Math.floor(l.y / FOG_CELL) % n * n + Math.floor(l.x / FOG_CELL) % n;
      if (counts[k] > 0) value += 15 * w.attack;
    }
  }
  return value;
}

// How well a guard at `g` faces a threat from `foe` to a unit `u`: 1
// within about 45° of the way the threat comes, falling to none from
// behind; 1 if the threat's way is unknown, or the guard stands on it.
function facing(size, u, g, foe) {
  if (!foe) return 1;
  const gx = delta(u.x, g.x, size);
  const gy = delta(u.y, g.y, size);
  const fx = delta(u.x, foe.x, size);
  const fy = delta(u.y, foe.y, size);
  const lg = Math.hypot(gx, gy);
  if (lg < 40 * PX) return 1;
  const cos = (gx * fx + gy * fy) / (lg * (Math.hypot(fx, fy) || 1));
  return Math.max(0, Math.min(1, (cos + 0.2) / 0.9));
}

// Whether a blast from a unit reaches another: within its radius of the
// other's edge, as the rules measure it, leaving out height.
function reaches(size, from, blast, u) {
  return d2(size, from, u) <= (blast.radius + UNIT_KINDS[u.kind].radius) ** 2;
}

// Its Charges in groups that go off together: each within the blast of
// another in its group.
function chargeChains(size, charges) {
  const chains = [];
  const left = [...charges];
  while (left.length > 0) {
    const chain = [left.pop()];
    for (let k = 0; k < chain.length; k++) {
      for (let j = left.length - 1; j >= 0; j--) {
        if (d2(size, chain[k], left[j]) <= CHARGE_BLAST.radius ** 2) chain.push(...left.splice(j, 1));
      }
    }
    chains.push(chain);
  }
  return chains;
}

// Whether a Charge sits where a launcher's shots toward a target pass
// low enough to set it off: close to the launcher, by the line out.
function inTheWay(size, launcher, target, charge) {
  const tx = delta(launcher.x, target.x, size);
  const ty = delta(launcher.y, target.y, size);
  const cx = delta(launcher.x, charge.x, size);
  const cy = delta(launcher.y, charge.y, size);
  const len = Math.hypot(tx, ty) || 1;
  const along = (cx * tx + cy * ty) / len;
  const across = Math.abs(cx * ty - cy * tx) / len;
  return along > 0 && along <= 160 * PX && across <= 60 * PX;
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

// Its precious buildings that an enemy Rover's line runs into: they're
// under attack (decision D59). Added to `plan.attacked`.
export function roverAlerts(game, plan) {
  const s = game.state;
  const size = game.map.size;
  for (const r of s.units) {
    if (r.kind !== 'rover' || r.triggered || game.sides[r.owner] === plan.side) continue;
    const hit = roverStop(game, r, r.heading);
    if (!hit) continue;
    for (const u of s.units) {
      if (game.sides[u.owner] !== plan.side || (u.kind !== 'outpost' && u.kind !== 'battery' && u.kind !== 'extractor')) continue;
      if (d2(size, u, hit) <= ROVER_BLAST.radius ** 2) plan.attacked.set(u.id, 1);
    }
  }
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
