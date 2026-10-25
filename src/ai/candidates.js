// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The moves a computer considers (spec 09, Choosing what to do): for
// each of its working launchers, the items it can afford, aimed at the
// places that matter for each one. Buildings go out in a ring, toward
// vents, the enemy and the starts it hasn't seen; defenses go by its
// threatened buildings; weapons go at the enemy units it knows of.

import { PX, POWER_MAX, ROVER_DRIVE, WET } from '../rules/constants.js';
import { tileIndex, tileCenter } from '../rules/terrain/terrain.js';
import { wrap } from '../rules/math/wrap.js';
import { ITEMS, itemCost, canLaunch } from '../rules/items.js';
import { UNIT_KINDS, isLauncher, isWorking } from '../rules/units.js';
import { isGone } from '../rules/conduits.js';
import { solve, bearing, distance } from './aim.js';
import { reachOf } from './value.js';

const MAX_TARGETS = 10; // the nearest enemy units weighed per launcher

export function candidates(game, plan, env, random) {
  const s = game.state;
  const size = game.map.size;
  const energy = s.players[plan.player].energy;
  const mine = s.units.filter((u) => game.sides[u.owner] === plan.side);
  const theirs = s.units.filter((u) => game.sides[u.owner] !== plan.side);
  const launchers = mine.filter((u) => u.owner === plan.player && isLauncher(u) && isWorking(s, u));
  const out = [];
  const can = (l, item) => canLaunch(l.kind, item) && itemCost(item) <= energy;
  const add = (l, item, heading, power, target = null, extra = {}) => {
    out.push({ launcher: l.id, item, heading: ((heading % 360) + 360) % 360, power: Math.max(0, Math.min(POWER_MAX, Math.round(power))), target, ...extra });
  };
  const aimAt = (l, item, point, target = null, extra = {}) => {
    const shot = solve(game, env, l, point);
    if (shot && shot.miss < 25 * PX) add(l, item, shot.heading, shot.power, target, extra);
  };
  const toward = (l, p, d) => {
    const a = (bearing(size, l, p) * Math.PI) / 180;
    return { x: l.x + Math.cos(a) * d, y: l.y + Math.sin(a) * d };
  };
  const spin = Math.floor(random() * 30);
  const enemyLaunchers = theirs.filter((u) => isLauncher(u) && !s.players[u.owner].knockedOut);
  const threatened = (u) => enemyLaunchers.some((l) => distance(size, l, u) <= reachOf(l) + 60 * PX);
  const precious = mine.filter((u) => (u.kind === 'outpost' || u.kind === 'battery' || u.kind === 'extractor') && threatened(u));
  const freeVents = game.map.vents.filter((v) => !s.units.some((u) => distance(size, u, v) < v.radius));

  for (const l of launchers) {
    const r = reachOf(l);
    const near = theirs.filter((u) => distance(size, l, u) <= r * 1.15)
      .sort((a, b) => distance(size, l, a) - distance(size, l, b)).slice(0, MAX_TARGETS);

    if (l.kind === 'outpost') {
      if (can(l, 'outpost')) {
        for (let h = spin; h < 360; h += 30) for (const p of [350, 600, 850]) add(l, 'outpost', h, p);
        const goals = [...freeVents, ...plan.unseenStarts, ...enemyLaunchers]
          .filter((g) => distance(size, l, g) > 150 * PX);
        for (const g of goals.slice(0, 8)) aimAt(l, 'outpost', toward(l, g, Math.min(distance(size, l, g) - 60 * PX, 0.85 * r)));
        // Onto its own Pontoons, and past them, to carry a crossing on.
        for (const pt of mine.filter((u) => u.kind === 'pontoon' && distance(size, l, u) <= r)) {
          for (const d of [0, 70, 130]) aimAt(l, 'outpost', toward(l, pt, distance(size, l, pt) + d * PX));
        }
      }
      if (can(l, 'extractor')) {
        for (const v of freeVents) if (distance(size, l, v) <= r) aimAt(l, 'extractor', v);
        if (s.round <= 3) for (let h = spin + 15; h < 360; h += 60) add(l, 'extractor', h, 450);
      }
      // Pontoons where its land meets water: weighed with the building
      // that would follow across (brain.js).
      if (can(l, 'pontoon')) for (const p of shoreWater(game, env, l, 0.9 * r)) aimAt(l, 'pontoon', p, null, { cross: true });
      if (can(l, 'spire') && plan.fog) for (let h = spin; h < 360; h += 45) for (const p of [500, 850]) add(l, 'spire', h, p);
      if (can(l, 'battery') && enemyLaunchers.length > 0) {
        for (const e of enemyLaunchers.slice(0, 3)) for (const d of [200, 350]) aimAt(l, 'battery', toward(l, e, d * PX));
      }
      for (const u of precious) {
        if (distance(size, l, u) > r) continue;
        const foe = nearest(size, u, enemyLaunchers);
        const a = foe ? (bearing(size, u, foe) * Math.PI) / 180 : 0;
        const ring = (d, offs) => offs.map((o) => ({ x: u.x + Math.cos(a + o) * d, y: u.y + Math.sin(a + o) * d }));
        if (can(l, 'interceptor')) for (const p of ring(75 * PX, [0, 1.6, -1.6])) aimAt(l, 'interceptor', p);
        if (can(l, 'barrier')) for (const p of ring(45 * PX, [0, 2.4])) aimAt(l, 'barrier', p);
        if (can(l, 'charges')) aimAt(l, 'charges', ring(120 * PX, [0])[0]);
      }
      if (can(l, 'skyProbe') && plan.fog && plan.knownEnemies < 4) {
        for (const st of plan.unseenStarts.slice(0, 3)) aimAt(l, 'skyProbe', toward(l, st, Math.min(distance(size, l, st), 0.95 * r)));
        for (let h = spin; h < 360; h += 90) add(l, 'skyProbe', h, POWER_MAX);
      }
      if (can(l, 'repair')) {
        for (const u of mine) {
          if (u.armor < UNIT_KINDS[u.kind].armor && u.kind !== 'rover' && distance(size, l, u) <= r && distance(size, l, u) > 40 * PX) aimAt(l, 'repair', u, u.id);
        }
      }
    }

    for (const t of near) {
      const tgt = t.id;
      if (can(l, 'shell')) aimAt(l, 'shell', t, tgt);
      if (can(l, 'scatter')) aimAt(l, 'scatter', t, tgt);
      if (can(l, 'seeker')) aimAt(l, 'seeker', toward(l, t, Math.max(60 * PX, distance(size, l, t) - 120 * PX)), tgt);
      if (can(l, 'pulse') && (t.kind === 'barrier' || t.kind === 'interceptor' || t.kind === 'rover' || isLauncher(t))) aimAt(l, 'pulse', t, tgt);
      if (can(l, 'surge')) aimAt(l, 'surge', t, tgt);
      if (can(l, 'worm') && (isLauncher(t) || t.kind === 'barrier')) aimAt(l, 'worm', t, tgt);
      if (can(l, 'salvager') && t.armor <= 30) aimAt(l, 'salvager', t, tgt);
      if (can(l, 'rover') && t.kind !== 'rover') {
        aimAt(l, 'rover', t, tgt);
        const d = distance(size, l, t);
        if (d > ROVER_DRIVE * 0.6) aimAt(l, 'rover', toward(l, t, d - ROVER_DRIVE * 0.6), tgt);
      }
    }
    // Surges on the enemy conduits it has seen.
    if (can(l, 'surge')) {
      for (const c of s.conduits) {
        if (game.sides[c.owner] === plan.side) continue;
        const live = c.nodes.filter((n) => !isGone(s, n));
        const n = live[Math.floor(live.length / 2)];
        if (n && distance(size, l, n) <= r) aimAt(l, 'surge', n, c.to);
      }
    }
  }
  return out.filter((c) => ITEMS[c.item]);
}

// The water tiles a launcher's land first meets, looking out along
// every 15° up to `far`: the centers of the tiles.
function shoreWater(game, env, l, far) {
  const step = 15 * PX;
  const seen = new Set();
  const out = [];
  for (let h = 0; h < 360; h += 15) {
    const a = (h * Math.PI) / 180;
    for (let d = step; d <= far; d += step) {
      const x = wrap(Math.round(l.x + Math.cos(a) * d), game.map.size);
      const y = wrap(Math.round(l.y + Math.sin(a) * d), game.map.size);
      if (env.terrain(x, y).type !== WET) continue;
      const tile = tileIndex(game.map, x, y);
      if (!seen.has(tile)) {
        seen.add(tile);
        out.push(tileCenter(game.map, tile));
      }
      break;
    }
  }
  return out;
}

function nearest(size, p, list) {
  let best = null;
  let bd = Infinity;
  for (const u of list) {
    const d = distance(size, p, u);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}
