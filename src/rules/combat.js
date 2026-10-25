// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Damage, explosions, blasts and the effects that wait (spec 04, When a
// unit is destroyed; spec 06, Explosions and damage, Pulse, Surge,
// Salvager; decisions D32, D35).
//
// Every function here takes the tick's context `ctx`:
//   { game, terrain(x, y), env, emit(event), destroy(unit, credit, how) }
// where `how` is 'destroyed', 'failed' (a landing that failed),
// 'salvaged' or 'sunk'. Only 'destroyed' units that are working explode.
//
// Effects that happen later wait in state.pending, each as plain data
// { id, at, type, ... }, and are run in the order they were added once
// their tick comes.

import {
  CHARGE_BLAST, CHARGE_TRIGGER, PULSE_REACH, PULSE_RADIUS, PULSE_DAMAGE,
  SURGE_DAMAGE, SURGE_TICKS_PER_NODE, SURGE_FADE_NODES, SALVAGE_STEP, SALVAGE_TICKS,
} from './constants.js';
import { isqrt } from './math/fixed.js';
import { delta } from './math/wrap.js';
import { UNIT_KINDS, findUnit, unitTop, isWorking } from './units.js';
import { cycleEnd } from './effects.js';
import { isGone } from './conduits.js';

// How far a point is from a unit's edge across the ground, its gap
// above or below the unit's base-to-top span, and the gap in 3D to the
// nearest part of the unit. All in position units.
export function groundGap(size, x, y, unit) {
  const dx = delta(x, unit.x, size);
  const dy = delta(y, unit.y, size);
  return Math.max(0, isqrt(dx * dx + dy * dy) - UNIT_KINDS[unit.kind].radius);
}

export function heightGap(z, unit) {
  return Math.max(0, unit.base - z, z - unitTop(unit));
}

export function gap3(size, x, y, z, unit) {
  const g = groundGap(size, x, y, unit);
  const h = heightGap(z, unit);
  return isqrt(g * g + h * h);
}

// The unit for which `score` is smallest, among those it doesn't
// return null for; the lower id on a tie.
export function nearest(units, score) {
  let best = null;
  let bestScore = Infinity;
  for (const u of units) {
    const v = score(u);
    if (v !== null && v < bestScore) {
      best = u;
      bestScore = v;
    }
  }
  return best;
}

// Takes armor away; a unit with none left is destroyed.
export function hurt(ctx, unit, amount, credit) {
  const s = ctx.game.state;
  if (amount <= 0 || !s.units.includes(unit)) return;
  unit.armor -= amount;
  ctx.emit({ type: 'damage', unit: unit.id, amount, armor: Math.max(0, unit.armor) });
  if (unit.armor <= 0) ctx.destroy(unit, credit, 'destroyed');
}

// A shot explosion: full damage to units whose edge is within half the
// radius, half damage (rounded down to a tenth) out to the radius. A
// unit is out of reach if its span is more than the radius above or
// below the explosion (decision D17).
export function shotExplosion(ctx, { x, y, z, radius, damage, credit }) {
  const { game } = ctx;
  const size = game.map.size;
  ctx.emit({ type: 'explosion', x, y, z, radius });
  for (const u of [...game.state.units]) {
    const g = groundGap(size, x, y, u);
    if (g > radius || heightGap(z, u) > radius) continue;
    hurt(ctx, u, 2 * g <= radius ? damage : Math.floor(damage / 2), credit);
  }
}

// A blast: full damage to every unit any part of which is within the
// radius in 3D. Barriers in range are destroyed first, whatever their
// armor.
export function blast(ctx, { x, y, z, radius, damage, credit }) {
  const { game } = ctx;
  const size = game.map.size;
  ctx.emit({ type: 'blast', x, y, z, radius });
  const inRange = game.state.units.filter((u) => gap3(size, x, y, z, u) <= radius);
  for (const u of inRange) {
    if (u.kind === 'barrier' && game.state.units.includes(u)) ctx.destroy(u, credit, 'destroyed');
  }
  for (const u of inRange) {
    if (u.kind !== 'barrier') hurt(ctx, u, damage, credit);
  }
}

// Where a unit's blast comes from: its center, halfway up.
export function blastPoint(unit) {
  return { x: unit.x, y: unit.y, z: unit.base + (UNIT_KINDS[unit.kind].height >> 1) };
}

export function schedule(state, effect) {
  state.pending.push({ id: state.nextId++, ...effect });
}

// Schedules the blast of a unit that explodes when destroyed.
export function scheduleBlast(state, unit, { damage, radius, delay }, credit) {
  schedule(state, { type: 'blast', at: state.tick + delay, unit: unit.id, ...blastPoint(unit), damage, radius, credit });
}

// Disables a unit until the step count `until`, or later if it already
// is (decision D3).
export function disable(unit, until) {
  unit.disabledUntil = Math.max(unit.disabledUntil, until);
}

// Charges -----------------------------------------------------------------

export const isArmedCharge = (state, u) => u.kind === 'charge' && u.armed && !u.triggered && isWorking(state, u);

// The nearest armed Charge within reach of a point, in 3D, or null.
export function armedChargeNear(game, x, y, z, reach = CHARGE_TRIGGER) {
  const s = game.state;
  return nearest(s.units.filter((u) => isArmedCharge(s, u)), (u) => {
    const g = gap3(game.map.size, x, y, z, u);
    return g <= reach ? g : null;
  });
}

// Sets a Charge off: it explodes a moment later.
export function setOff(ctx, charge, credit) {
  const s = ctx.game.state;
  charge.triggered = true;
  ctx.emit({ type: 'chargeSetOff', unit: charge.id });
  scheduleBlast(s, charge, CHARGE_BLAST, credit);
}

// Effects that wait --------------------------------------------------------

// Runs the waiting effects whose tick has come.
export function runPending(ctx) {
  const s = ctx.game.state;
  for (const effect of s.pending.filter((e) => e.at <= s.tick)) {
    s.pending.splice(s.pending.indexOf(effect), 1);
    const again = RUN[effect.type](ctx, effect);
    if (again) s.pending.push(effect);
  }
}

const RUN = {
  blast(ctx, e) {
    // A Charge that goes off is used up in its own blast.
    const unit = e.unit !== undefined ? findUnit(ctx.game.state, e.unit) : null;
    if (unit) {
      const s = ctx.game.state;
      s.units.splice(s.units.indexOf(unit), 1);
      ctx.emit({ type: 'destroy', unit: unit.id, kind: unit.kind });
    }
    blast(ctx, e);
    return false;
  },

  // The Pulse disables first, then explodes (spec 06, Pulse).
  pulse(ctx, e) {
    const s = ctx.game.state;
    const size = ctx.game.map.size;
    ctx.emit({ type: 'pulse', x: e.x, y: e.y, z: e.z });
    const n = s.seats.length;
    for (const u of s.units) {
      if (groundGap(size, e.x, e.y, u) > PULSE_REACH) continue;
      if (u.worm) {
        // It holds the Worm back by a turn cycle (decision D3).
        u.worm.until += n;
        disable(u, u.worm.until);
      } else {
        disable(u, cycleEnd(s));
      }
      ctx.emit({ type: 'disabled', unit: u.id });
    }
    shotExplosion(ctx, { x: e.x, y: e.y, z: e.z, radius: PULSE_RADIUS, damage: PULSE_DAMAGE, credit: e.credit });
    return false;
  },

  // The Surge's damage, one node further along its conduit. It stops if
  // the node has burned away, and fades to nothing as it goes.
  surge(ctx, e) {
    const s = ctx.game.state;
    const conduit = s.conduits.find((c) => c.id === e.conduit);
    if (!conduit) return false;
    if (e.index < 0 || e.index >= conduit.nodes.length) {
      const end = findUnit(s, e.index < 0 ? conduit.from : conduit.to);
      const left = surgeLeft(e.traveled);
      if (end) {
        ctx.emit({ type: 'surgeEnd', unit: end.id, amount: left });
        hurt(ctx, end, left, e.credit);
      }
      return false;
    }
    if (isGone(s, conduit.nodes[e.index])) return false;
    e.traveled += 1;
    ctx.emit({ type: 'surgeNode', conduit: conduit.id, index: e.index, strength: surgeLeft(e.traveled), owner: e.owner });
    if (surgeLeft(e.traveled) <= 0) return false;
    e.index += e.dir;
    e.at = s.tick + SURGE_TICKS_PER_NODE;
    return true;
  },

  // The Salvager takes 1 armor at a time (spec 06, Salvager).
  salvage(ctx, e) {
    const s = ctx.game.state;
    const unit = findUnit(s, e.unit);
    if (!unit) return false;
    const take = Math.min(SALVAGE_STEP, e.max - e.taken, unit.armor);
    unit.armor -= take;
    e.taken += take;
    s.players[e.owner].salvaged += take;
    ctx.emit({ type: 'salvage', unit: unit.id, amount: take, armor: unit.armor });
    if (unit.armor <= 0) {
      ctx.destroy(unit, e.credit, 'salvaged');
      return false;
    }
    if (e.taken >= e.max) return false;
    e.at = s.tick + SALVAGE_TICKS;
    return true;
  },
};

// What's left of the Surge's 3 after `traveled` nodes, in tenths:
// it weakens steadily to nothing at SURGE_FADE_NODES.
export function surgeLeft(traveled) {
  return Math.max(0, Math.floor((SURGE_DAMAGE * (SURGE_FADE_NODES - traveled)) / SURGE_FADE_NODES));
}

// Starts the Surge's damage running along a conduit from node `index`.
export function startSurge(state, conduit, index, dir, owner, credit, traveled = 0) {
  schedule(state, {
    type: 'surge', at: state.tick + SURGE_TICKS_PER_NODE, conduit: conduit.id, index, dir, traveled, owner, credit,
  });
}
