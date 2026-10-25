// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Shots in flight: how each item flies, what it meets in the air, and
// where it comes down (spec 05, As the building comes down, Landing;
// spec 06, Shots in the air, Scatter Shell, Seeker, Free-standing units
// in flight; spec 04, Sky Probe; decisions D31, D32, D34).
//
// A shot in the game state is plain data: the flight (see flight.js)
// plus
//   { id, item, owner, launcher, heading, peakTick, peakZ, conduit,
//     chased, startedIn, target, lockTick, seekDone }
// `chased` is the missile chasing it, `startedIn` the enemy domes it
// started inside, and target, lockTick and seekDone the Seeker's.
//
// Each tick, for each shot in turn: it moves; then it may be stopped
// by a dome, hit a unit, set off a Charge, or land, checked in that
// order (decision D32).

import {
  SHOT_RADIUS, FULL_FOOTPRINT_DELAY, FLAT, WET, SCATTER_SPREAD, CHARGES_SPREAD, SPLIT_SPEEDUP,
  SEEKER_RANGE, SEEKER_STEER_TICKS, SEEKER_MIN_SPEED, SKIM_HEIGHT, PROBE_STOP_TICKS, PROBE_DEPLOY_TICK,
  PROBE_DIP_TICKS, PROBE_DIP, PROBE_RISE, CHARGE_NODE_CLEARANCE, ONE,
} from './constants.js';
import { divRound, mulFrac, isqrt } from './math/fixed.js';
import { cosDeg, sinDeg, normDeg } from './math/trig.js';
import { delta, wrap } from './math/wrap.js';
import { stepShot } from './flight.js';
import { ITEMS, BUILDING, WEAPON } from './items.js';
import { UNIT_KINDS, addUnit, findUnit } from './units.js';
import { tileIndex, tileCenter } from './terrain/terrain.js';
import { trackBuilding, finishLaying, burn, nodeNearFootprint, nodeWithin } from './conduits.js';
import { domeStop } from './barriers.js';
import { armedChargeNear, setOff } from './combat.js';
import { chaseLanded } from './interceptors.js';
import { weaponEnd } from './weapons.js';
import { landRover, roverExplodesAt } from './rovers.js';
import { linger } from './fog.js';

// The fields every new shot starts with, besides its flight.
export function shotFields(game, { item, owner, launcher, heading, startedIn }) {
  return {
    id: game.state.nextId++, item, owner, launcher, heading,
    peakTick: null, peakZ: null, conduit: null, chased: null, startedIn,
    target: null, lockTick: null, seekDone: false,
  };
}

// Moves every shot one tick, and settles the ones whose flight ends.
export function stepShots(ctx) {
  const s = ctx.game.state;
  for (const shot of [...s.shots]) {
    if (s.shots.includes(shot)) stepOne(ctx, shot);
  }
}

function stepOne(ctx, shot) {
  const { game } = ctx;
  const s = game.state;
  const p0 = { x: shot.x, y: shot.y, z: shot.z };
  const { landing, halted } = move(ctx, shot);
  if (shot.peakTick === null && shot.vz <= 0) {
    shot.peakTick = s.tick;
    shot.peakZ = shot.z;
    if (shot.item === 'scatter') split(game, shot, SCATTER_SPREAD);
    if (shot.item === 'charges') split(game, shot, CHARGES_SPREAD);
  }
  const end = landing ?? { x: shot.x, y: shot.y, z: shot.z };

  if (shot.conduit !== null) {
    const conduit = s.conduits.find((c) => c.id === shot.conduit);
    const launcher = findUnit(s, shot.launcher);
    if (conduit && launcher) {
      const at = { ...shot, ...end };
      if (trackBuilding(s, conduit, at, launcher, shot.heading, game.map.size)) shot.windOn = true;
    }
  }

  const stop = domeStop(game, game.sides[shot.owner], shot.startedIn, p0, end);
  if (stop) {
    endShot(game, shot);
    ctx.emit({ type: 'domeFlicker', unit: stop.barrier, x: stop.x, y: stop.y, z: stop.z });
    ctx.emit({ type: 'stopped', shot: shot.id, item: shot.item, x: stop.x, y: stop.y, z: stop.z });
    if (isBuilding(shot)) failBuilding(ctx, shot, 'barrier');
    return;
  }

  const hit = airHit(game, shot, p0, end);
  if (hit) {
    endShot(game, shot);
    const { unit, point } = hit;
    ctx.emit({ type: 'hit', shot: shot.id, item: shot.item, unit: unit.id, ...point });
    if (unit.kind === 'skyProbe') ctx.destroy(unit, ctx.credit(), 'destroyed');
    if (isBuilding(shot)) failBuilding(ctx, shot, 'hit');
    else if (ITEMS[shot.item].category === WEAPON) {
      weaponEnd(ctx, shot, 'direct', point, s.units.includes(unit) ? unit : null);
    } else if (shot.item === 'rover') {
      // A Rover that hits a unit explodes on the spot (spec 06, Rover).
      roverExplodesAt(ctx, point, ctx.credit());
    } else ctx.emit({ type: 'lost', shot: shot.id, item: shot.item, ...point });
    return;
  }

  const charge = armedChargeNear(game, end.x, end.y, end.z);
  if (charge) {
    endShot(game, shot);
    ctx.emit({ type: 'chargeHit', shot: shot.id, item: shot.item, unit: charge.id, ...end });
    setOff(ctx, charge, ctx.credit());
    if (isBuilding(shot)) failBuilding(ctx, shot, 'charge');
    return;
  }

  if (landing) {
    endShot(game, shot);
    land(ctx, shot, landing);
    return;
  }
  if (halted) {
    endShot(game, shot);
    const unit = addUnit(s, { kind: 'skyProbe', owner: shot.owner, x: shot.x, y: shot.y, base: shot.z });
    if (shot.chased !== null) chaseLanded(s, shot, unit);
    ctx.emit({ type: 'built', unit: unit.id, kind: unit.kind, owner: unit.owner });
  }
}

const isBuilding = (shot) => ITEMS[shot.item].category === BUILDING;

// A shot's flight is over. A weapon's view of the fog lingers there.
export function endShot(game, shot) {
  const s = game.state;
  s.shots.splice(s.shots.indexOf(shot), 1);
  if (ITEMS[shot.item].category === WEAPON) linger(game, shot);
}

// Flight ------------------------------------------------------------------

// Moves a shot one tick. Returns { landing, halted }.
function move(ctx, shot) {
  const { game } = ctx;
  if (shot.item === 'skyProbe' && shot.peakTick !== null) return probeStop(ctx, shot);
  if (shot.item === 'seeker') {
    seek(game, shot);
    // For the screen and the sound: it has just locked on.
    if (shot.lockTick === game.state.tick) ctx.emit({ type: 'seekerLocked', shot: shot.id, unit: shot.target, x: shot.x, y: shot.y, z: shot.z });
  }
  const homing = shot.target !== null;
  if (!homing) return { landing: stepShot(shot, game.wind, ctx.env), halted: false };

  // Skimming: only water or a Pontoon's tile lets it land.
  const env = {
    size: game.map.size,
    altitude: (x, y) => {
      const t = ctx.terrain(x, y);
      return t.type === WET || isPontoonTile(game, x, y) ? t.alt : -Infinity;
    },
  };
  const landing = stepShot(shot, game.wind, env);
  if (!landing) {
    const floor = ctx.terrain(shot.x, shot.y).alt + SKIM_HEIGHT;
    if (shot.z < floor) {
      shot.z = floor;
      shot.vz = Math.max(shot.vz, 0);
    }
  }
  return { landing, halted: false };
}

function isPontoonTile(game, x, y) {
  const tile = tileIndex(game.map, x, y);
  return game.state.units.some((u) => u.kind === 'pontoon' && tileIndex(game.map, u.x, u.y) === tile);
}

// The two outer parts break away about `spread` degrees to either side,
// a little faster; the shot itself carries on as the third.
function split(game, shot, spread) {
  const s = game.state;
  for (const turn of [-spread, spread]) {
    const c = cosDeg(turn);
    const n = sinDeg(turn);
    const vx = mulFrac(divRound(shot.vx * c - shot.vy * n, ONE), SPLIT_SPEEDUP);
    const vy = mulFrac(divRound(shot.vx * n + shot.vy * c, ONE), SPLIT_SPEEDUP);
    s.shots.push({
      ...shotFields(game, {
        item: shot.item, owner: shot.owner, launcher: shot.launcher,
        heading: normDeg(shot.heading + turn), startedIn: [...shot.startedIn],
      }),
      peakTick: shot.peakTick,
      peakZ: shot.peakZ,
      x: shot.x, y: shot.y, z: shot.z, vx, vy, vz: shot.vz, windOn: shot.windOn,
    });
  }
}

// The Seeker, from the top of its arc: it locks on to the nearest unit
// of another side within reach ahead of it, then steers toward the
// unit's base, harder as it goes (spec 06, Seeker; decision D17).
function seek(game, shot) {
  const s = game.state;
  if (shot.peakTick === null || shot.seekDone) return;
  const size = game.map.size;
  if (shot.target !== null && !findUnit(s, shot.target)) {
    // Its target is gone: it carries on as a plain Shell.
    shot.target = null;
    shot.seekDone = true;
    return;
  }
  if (shot.target === null) {
    const speed = isqrt(shot.vx * shot.vx + shot.vy * shot.vy);
    if (speed === 0) return;
    const ux = divRound(shot.vx * ONE, speed);
    const uy = divRound(shot.vy * ONE, speed);
    const side = game.sides[shot.owner];
    let best = null;
    let bestD = Infinity;
    for (const u of s.units) {
      if (game.sides[u.owner] === side) continue;
      const dx = delta(shot.x, u.x, size);
      const dy = delta(shot.y, u.y, size);
      const d2 = dx * dx + dy * dy;
      if (d2 > SEEKER_RANGE * SEEKER_RANGE || d2 >= bestD) continue;
      // Ahead: within 45° of its heading across the ground.
      const along = divRound(ux * dx + uy * dy, ONE);
      if (along <= 0 || 2 * along * along < d2) continue;
      best = u;
      bestD = d2;
    }
    if (!best) return;
    shot.target = best.id;
    shot.lockTick = s.tick;
  }
  const target = findUnit(s, shot.target);
  const dx = delta(shot.x, target.x, size);
  const dy = delta(shot.y, target.y, size);
  const dz = target.base - shot.z;
  const dist = isqrt(dx * dx + dy * dy + dz * dz);
  if (dist === 0) return;
  const speed = Math.max(SEEKER_MIN_SPEED, isqrt(shot.vx * shot.vx + shot.vy * shot.vy + shot.vz * shot.vz));
  const f = Math.min(ONE, divRound(ONE * (s.tick - shot.lockTick + 1), SEEKER_STEER_TICKS));
  shot.vx += mulFrac(divRound(speed * dx, dist) - shot.vx, f);
  shot.vy += mulFrac(divRound(speed * dy, dist) - shot.vy, f);
  shot.vz += mulFrac(divRound(speed * dz, dist) - shot.vz, f);
}

// The Sky Probe's stop, k ticks after the top of its arc: the wind
// still acts on it, its sideways movement fades away, and it dips, then
// rises, to float a little above the top of its arc (spec 04, spec 06;
// decision D34).
function probeStop(ctx, shot) {
  const { game } = ctx;
  const k = game.state.tick - shot.peakTick;
  stepShot(shot, game.wind, { size: game.map.size, altitude: () => -Infinity });
  const left = PROBE_STOP_TICKS - k;
  shot.vx = Math.trunc((shot.vx * left) / (left + 1));
  shot.vy = Math.trunc((shot.vy * left) / (left + 1));
  shot.vz = 0;
  shot.z = shot.peakZ + probeOffset(k);
  const ground = ctx.terrain(shot.x, shot.y).alt;
  if (shot.z <= ground) return { landing: { x: shot.x, y: shot.y, z: ground }, halted: false };
  return { landing: null, halted: k >= PROBE_STOP_TICKS };
}

export function probeOffset(k) {
  const D = PROBE_DIP_TICKS;
  if (k <= D) return -Math.trunc((PROBE_DIP * 4 * k * (D - k)) / (D * D));
  const span = PROBE_STOP_TICKS - D;
  const rest = Math.max(0, PROBE_STOP_TICKS - k);
  return PROBE_RISE - Math.trunc((PROBE_RISE * rest * rest) / (span * span));
}

// Collisions -------------------------------------------------------------

// The size a shot collides at. A building takes on its full footprint
// shortly after the top of its arc (spec 05), a Sky Probe early in its
// stop (spec 06).
function shotRadius(s, shot) {
  if (shot.peakTick !== null) {
    if (isBuilding(shot) && s.tick >= shot.peakTick + FULL_FOOTPRINT_DELAY) return UNIT_KINDS[shot.item].radius;
    if (shot.item === 'skyProbe' && s.tick >= shot.peakTick + PROBE_DEPLOY_TICK) return UNIT_KINDS.skyProbe.radius;
  }
  return SHOT_RADIUS;
}

// The first unit the shot touched on its move this tick, and where, or
// null. Pontoons are never struck; a Sky Probe only by enemy shots and
// other Sky Probes.
function airHit(game, shot, p0, end) {
  const s = game.state;
  const size = game.map.size;
  const r = shotRadius(s, shot);
  const dx = delta(p0.x, end.x, size);
  const dy = delta(p0.y, end.y, size);
  const zLow = Math.min(p0.z, end.z);
  const zHigh = Math.max(p0.z, end.z);
  const len2 = dx * dx + dy * dy;
  let best = null;
  let bestT = Infinity;
  for (const u of s.units) {
    if (u.kind === 'pontoon') continue;
    if (u.kind === 'skyProbe' && shot.item !== 'skyProbe' && game.sides[u.owner] === game.sides[shot.owner]) continue;
    const spec = UNIT_KINDS[u.kind];
    if (zHigh < u.base || zLow > u.base + spec.height) continue;
    const cx = delta(p0.x, u.x, size);
    const cy = delta(p0.y, u.y, size);
    let t = 0;
    if (len2 > 0) t = Math.max(0, Math.min(1024, divRound((cx * dx + cy * dy) * 1024, len2)));
    const ex = cx - divRound(dx * t, 1024);
    const ey = cy - divRound(dy * t, 1024);
    const reach = r + spec.radius;
    if (ex * ex + ey * ey < reach * reach && t < bestT) {
      best = u;
      bestT = t;
    }
  }
  if (!best) return null;
  return {
    unit: best,
    point: {
      x: wrap(p0.x + divRound(dx * bestT, 1024), size),
      y: wrap(p0.y + divRound(dy * bestT, 1024), size),
      z: p0.z + divRound((end.z - p0.z) * bestT, 1024),
    },
  };
}

// Landing ---------------------------------------------------------------

function land(ctx, shot, landing) {
  const wet = ctx.terrain(landing.x, landing.y).type === WET;
  if (isBuilding(shot)) landBuilding(ctx, shot, landing);
  else if (shot.item === 'pontoon') landPontoon(ctx, shot, landing);
  else if (shot.item === 'charges') landCharge(ctx, shot, landing);
  else if (shot.item === 'rover') landRover(ctx, shot, landing);
  else if (shot.item === 'skyProbe') ctx.emit({ type: 'lost', shot: shot.id, item: shot.item, ...landing });
  else weaponEnd(ctx, shot, wet ? 'water' : 'ground', landing, null);
}

// A building's landing (spec 05, Landing).
function landBuilding(ctx, shot, landing) {
  const { game } = ctx;
  const s = game.state;
  const conduit = s.conduits.find((c) => c.id === shot.conduit);
  const ground = ctx.terrain(landing.x, landing.y);
  const radius = UNIT_KINDS[shot.item].radius;
  let reason = null;
  let charge = null;
  // A building that comes down before it's clear of its launcher never
  // started its conduit (D31).
  if (!conduit || !conduit.started) reason = 'tooClose';
  else if (conduit.broken) reason = 'conduit';
  else if ((charge = armedChargeNear(game, landing.x, landing.y, landing.z))) reason = 'charge';
  else if (ground.type === WET) reason = 'water';
  else if (ground.type !== FLAT) reason = 'slope';
  else if (nodeNearFootprint(s, landing.x, landing.y, radius, conduit.id, game.map.size)) reason = 'nearConduit';
  if (charge) setOff(ctx, charge, ctx.credit());
  if (reason) {
    failBuilding(ctx, shot, reason, landing);
    return;
  }
  const unit = addUnit(s, { kind: shot.item, owner: shot.owner, x: landing.x, y: landing.y, base: ground.alt });
  if (unit.kind === 'extractor') unit.onVent = onVent(game.map, unit);
  conduit.to = unit.id;
  finishLaying(conduit, radius, ground.alt, game.map.size);
  if (shot.chased !== null) chaseLanded(s, shot, unit);
  ctx.emit({ type: 'built', unit: unit.id, kind: unit.kind, owner: unit.owner, heading: shot.heading });
}

// A building whose landing failed is never really there. Its conduit
// burns back from its end (spec 05, Landing).
export function failBuilding(ctx, shot, reason, landing = null) {
  const s = ctx.game.state;
  ctx.emit({ type: 'buildingFailed', shot: shot.id, kind: shot.item, reason, ...(landing && { x: landing.x, y: landing.y }) });
  const conduit = s.conduits.find((c) => c.id === shot.conduit);
  if (!conduit) return;
  conduit.shot = null;
  conduit.path = [];
  if (conduit.nodes.length === 0) {
    s.conduits.splice(s.conduits.indexOf(conduit), 1);
    return;
  }
  burn(conduit, conduit.nodes.length - 1, s.tick, 'child', null);
}

// An Extractor counts as on a vent if its footprint overlaps the vent at
// all (spec 02, Energy Vents).
export function onVent(map, unit) {
  const r = UNIT_KINDS[unit.kind].radius;
  return map.vents.some((v) => {
    const dx = delta(unit.x, v.x, map.size);
    const dy = delta(unit.y, v.y, map.size);
    const reach = r + v.radius;
    return dx * dx + dy * dy < reach * reach;
  });
}

// A Pontoon lands well on water in a tile with no Pontoon or Rover yet,
// and moves to the tile's center (spec 06, Pontoon; spec 02, Pontoons).
function landPontoon(ctx, shot, landing) {
  const { game } = ctx;
  const s = game.state;
  const map = game.map;
  const tile = tileIndex(map, landing.x, landing.y);
  const ground = ctx.terrain(landing.x, landing.y);
  const taken = s.units.some((u) => (u.kind === 'pontoon' || u.kind === 'rover') && tileIndex(map, u.x, u.y) === tile);
  if (ground.type !== WET || taken) {
    ctx.emit({ type: 'pontoonLost', shot: shot.id, x: landing.x, y: landing.y });
    return;
  }
  const c = tileCenter(map, tile);
  const unit = addUnit(s, { kind: 'pontoon', owner: shot.owner, x: wrap(c.x, map.size), y: wrap(c.y, map.size), base: 0 });
  if (shot.chased !== null) chaseLanded(s, shot, unit);
  ctx.emit({ type: 'built', unit: unit.id, kind: 'pontoon', owner: unit.owner });
}

// A Proximity Charge is lost where it lands on water, near a conduit
// node, or near an armed Charge, which goes off (spec 06, Proximity
// Charges).
function landCharge(ctx, shot, landing) {
  const { game } = ctx;
  const s = game.state;
  const ground = ctx.terrain(landing.x, landing.y);
  const charge = armedChargeNear(game, landing.x, landing.y, landing.z);
  let reason = null;
  if (charge) reason = 'charge';
  else if (ground.type === WET) reason = 'water';
  else if (nodeWithin(s, landing.x, landing.y, CHARGE_NODE_CLEARANCE, null, game.map.size)) reason = 'conduit';
  if (charge) setOff(ctx, charge, ctx.credit());
  if (reason) {
    ctx.emit({ type: 'lost', shot: shot.id, item: shot.item, reason, ...landing });
    return;
  }
  const unit = addUnit(s, { kind: 'charge', owner: shot.owner, x: landing.x, y: landing.y, base: ground.alt });
  if (shot.chased !== null) chaseLanded(s, shot, unit);
  ctx.emit({ type: 'built', unit: unit.id, kind: 'charge', owner: unit.owner });
}
