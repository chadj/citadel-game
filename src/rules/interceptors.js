// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Interceptors and their missiles (spec 04, Interceptor; spec 06,
// Interceptors; decisions D15, D33).
//
// A missile in the game state is plain data:
//   { id, interceptor, owner, shot, unit, x, y, z, speed, leaveAt, startedIn }
// `shot` is the shot it chases; `unit` is set when that shot comes down
// as a unit, which then waits for the chase to end. `startedIn` lists
// the enemy domes it was inside when it left (null until then).

import {
  INTERCEPTOR_RANGE, MISSILE_DELAY, MISSILE_ACCEL, MISSILE_MAX_SPEED, MISSILE_CATCH, LAUNCH_CLEARANCE,
} from './constants.js';
import { VEL_PER_POS, isqrt } from './math/fixed.js';
import { delta, wrap } from './math/wrap.js';
import { findUnit, unitTop, isWorking } from './units.js';
import { cycleEnd } from './effects.js';
import { disable } from './combat.js';
import { domeStop, domesAround } from './barriers.js';

// Which of several Interceptors fires: a mix of the shot and the tick,
// the same on every machine but hard for players to foresee.
function pick(list, shot, tick) {
  let h = Math.imul(shot.id ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul(tick + 0x9e3779b9, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return list[(h >>> 0) % list.length];
}

// Fires at shots that have come into range and aren't chased yet.
export function fireInterceptors(ctx) {
  const { game } = ctx;
  const s = game.state;
  const size = game.map.size;
  for (const shot of s.shots) {
    if (shot.chased !== null) continue;
    const side = game.sides[shot.owner];
    const ready = s.units.filter((u) => {
      if (u.kind !== 'interceptor' || u.landing || !isWorking(s, u) || game.sides[u.owner] === side) return false;
      const dx = delta(u.x, shot.x, size);
      const dy = delta(u.y, shot.y, size);
      return dx * dx + dy * dy <= INTERCEPTOR_RANGE * INTERCEPTOR_RANGE;
    });
    if (ready.length === 0) continue;
    const interceptor = pick(ready, shot, s.tick);
    const missile = {
      id: s.nextId++,
      interceptor: interceptor.id,
      owner: interceptor.owner,
      shot: shot.id,
      unit: null,
      x: interceptor.x,
      y: interceptor.y,
      z: unitTop(interceptor) + LAUNCH_CLEARANCE,
      speed: 0,
      leaveAt: s.tick + MISSILE_DELAY,
      startedIn: null,
    };
    s.missiles.push(missile);
    shot.chased = missile.id;
    // It reloads for a turn cycle, whatever happens to the missile.
    disable(interceptor, cycleEnd(s));
    ctx.emit({ type: 'interceptorFired', unit: interceptor.id, shot: shot.id, missile: missile.id });
  }
}

// Where the missile is heading now, or null if there's nothing left to
// chase.
function targetOf(s, m) {
  const shot = s.shots.find((sh) => sh.id === m.shot);
  if (shot) return { x: shot.x, y: shot.y, z: shot.z };
  if (m.unit !== null) {
    const unit = findUnit(s, m.unit);
    if (unit) return { x: unit.x, y: unit.y, z: unit.base };
  }
  return null;
}

// One tick of every missile. `onCatch(missile)` handles a catch.
export function stepMissiles(ctx, onCatch) {
  const { game } = ctx;
  const s = game.state;
  const size = game.map.size;
  for (const m of [...s.missiles]) {
    const target = targetOf(s, m);
    if (!target) {
      endMissile(ctx, m, 'missileMiss');
      continue;
    }
    if (s.tick < m.leaveAt) continue;
    const side = game.sides[m.owner];
    if (m.startedIn === null) m.startedIn = domesAround(game, side, m.x, m.y, m.z);

    m.speed = Math.min(MISSILE_MAX_SPEED, m.speed + MISSILE_ACCEL);
    const reach = Math.trunc(m.speed / VEL_PER_POS);
    const dx = delta(m.x, target.x, size);
    const dy = delta(m.y, target.y, size);
    const dz = target.z - m.z;
    const dist = isqrt(dx * dx + dy * dy + dz * dz);
    const caught = dist <= reach + MISSILE_CATCH;
    const p0 = { x: m.x, y: m.y, z: m.z };
    const p1 = caught
      ? { ...target }
      : {
          x: wrap(m.x + Math.trunc((dx * reach) / dist), size),
          y: wrap(m.y + Math.trunc((dy * reach) / dist), size),
          z: m.z + Math.trunc((dz * reach) / dist),
        };
    // It never flies below the ground.
    p1.z = Math.max(p1.z, ctx.terrain(p1.x, p1.y).alt);

    const stop = domeStop(game, side, m.startedIn, p0, p1);
    if (stop) {
      Object.assign(m, { x: stop.x, y: stop.y, z: stop.z });
      ctx.emit({ type: 'domeFlicker', unit: stop.barrier, x: stop.x, y: stop.y, z: stop.z });
      endMissile(ctx, m, 'missileStopped');
      continue;
    }
    Object.assign(m, p1);
    if (caught) {
      s.missiles.splice(s.missiles.indexOf(m), 1);
      ctx.emit({ type: 'missileHit', missile: m.id, x: m.x, y: m.y, z: m.z });
      onCatch(m);
    }
  }
}

// The missile gives up. A unit it was after is safe now.
function endMissile(ctx, m, type) {
  const s = ctx.game.state;
  s.missiles.splice(s.missiles.indexOf(m), 1);
  ctx.emit({ type, missile: m.id, x: m.x, y: m.y, z: m.z });
  if (m.unit !== null) {
    const unit = findUnit(s, m.unit);
    if (unit) unit.landing = false;
  }
}

// When a chased shot comes down as a unit, the missile goes after the
// unit instead.
export function chaseLanded(state, shot, unit) {
  const m = state.missiles.find((mm) => mm.id === shot.chased);
  if (!m) return;
  m.unit = unit.id;
  unit.landing = true;
}
