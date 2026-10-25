// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Shots in flight: what they hit in the air, and where they come down
// (spec 05, As the building comes down, Landing; spec 06, Shots in the
// air, Pontoon). Weapons' effects, Barriers, Interceptors and Charges
// come in M4; until then a weapon that ends its flight does nothing.
//
// A shot in the game state is plain data: the flight (see flight.js)
// plus { id, item, owner, launcher, heading, peakTick, conduit }.

import { SHOT_RADIUS, FULL_FOOTPRINT_DELAY, FLAT, WET } from './constants.js';
import { divRound } from './math/fixed.js';
import { delta, wrap } from './math/wrap.js';
import { stepShot } from './flight.js';
import { ITEMS, BUILDING } from './items.js';
import { UNIT_KINDS, addUnit, findUnit } from './units.js';
import { tileIndex, tileCenter } from './terrain/terrain.js';
import {
  trackBuilding, finishLaying, burn, nodeNearFootprint,
} from './conduits.js';

// Moves every shot one tick, and settles the ones whose flight ends.
// `ctx` is { game, env, terrain, emit }.
export function stepShots(ctx) {
  const s = ctx.game.state;
  for (const shot of [...s.shots]) {
    const x0 = shot.x;
    const y0 = shot.y;
    const z0 = shot.z;
    const landing = stepShot(shot, ctx.game.wind, ctx.env);
    if (shot.peakTick === null && shot.vz <= 0) shot.peakTick = s.tick;
    const end = landing ?? shot;

    if (shot.conduit !== null) {
      const conduit = s.conduits.find((c) => c.id === shot.conduit);
      const launcher = findUnit(s, shot.launcher);
      if (conduit && launcher) {
        const at = { ...shot, x: end.x, y: end.y, z: end.z };
        if (trackBuilding(s, conduit, at, launcher, shot.heading, ctx.game.map.size)) shot.windOn = true;
      }
    }

    const hit = airHit(ctx.game, shot, x0, y0, z0, end);
    if (hit) {
      endShot(s, shot);
      ctx.emit({ type: 'hit', shot: shot.id, item: shot.item, unit: hit.id });
      if (ITEMS[shot.item].category === BUILDING) failBuilding(ctx, shot, 'hit');
      else if (shot.item === 'pontoon') ctx.emit({ type: 'pontoonLost', shot: shot.id });
      continue;
    }
    if (landing) {
      endShot(s, shot);
      land(ctx, shot, landing);
    }
  }
}

function endShot(s, shot) {
  s.shots.splice(s.shots.indexOf(shot), 1);
}

// The size a shot collides at: a building takes on its full footprint
// shortly after the top of its arc (spec 05). A Pontoon stays a pod.
function shotRadius(s, shot) {
  if (ITEMS[shot.item].category === BUILDING && shot.peakTick !== null
    && s.tick >= shot.peakTick + FULL_FOOTPRINT_DELAY) {
    return UNIT_KINDS[shot.item].radius;
  }
  return SHOT_RADIUS;
}

// The first unit the shot touched on its move this tick, or null. A
// shot hits a unit when it overlaps the footprint at an altitude between
// the unit's base and its top (spec 06, Units). Pontoons are never
// struck; Sky Probes only by enemy shots.
function airHit(game, shot, x0, y0, z0, end) {
  const s = game.state;
  const size = game.map.size;
  const r = shotRadius(s, shot);
  const dx = delta(x0, end.x, size);
  const dy = delta(y0, end.y, size);
  const zLow = Math.min(z0, end.z);
  const zHigh = Math.max(z0, end.z);
  let best = null;
  let bestT = Infinity;
  for (const u of s.units) {
    if (u.kind === 'pontoon') continue;
    if (u.kind === 'skyProbe' && game.sides[u.owner] === game.sides[shot.owner]) continue;
    const spec = UNIT_KINDS[u.kind];
    if (zHigh < u.base || zLow > u.base + spec.height) continue;
    // The closest the move came to the unit's center.
    const cx = delta(x0, u.x, size);
    const cy = delta(y0, u.y, size);
    const len2 = dx * dx + dy * dy;
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
  return best;
}

// Where a flight comes down to the ground.
function land(ctx, shot, landing) {
  const category = ITEMS[shot.item].category;
  if (category === BUILDING) landBuilding(ctx, shot, landing);
  else if (shot.item === 'pontoon') landPontoon(ctx, shot, landing);
  else ctx.emit({ type: 'land', shot: shot.id, item: shot.item, x: landing.x, y: landing.y, z: landing.z });
}

// A building's landing (spec 05, Landing).
function landBuilding(ctx, shot, landing) {
  const { game } = ctx;
  const s = game.state;
  const conduit = s.conduits.find((c) => c.id === shot.conduit);
  const ground = ctx.terrain(landing.x, landing.y);
  const radius = UNIT_KINDS[shot.item].radius;
  let reason = null;
  // A building that comes down before it's clear of its launcher never
  // started its conduit (D31).
  if (!conduit || !conduit.started) reason = 'tooClose';
  else if (conduit.broken) reason = 'conduit';
  else if (ground.type === WET) reason = 'water';
  else if (ground.type !== FLAT) reason = 'slope';
  else if (nodeNearFootprint(s, landing.x, landing.y, radius, conduit.id, game.map.size)) reason = 'nearConduit';
  if (reason) {
    failBuilding(ctx, shot, reason, landing);
    return;
  }
  const unit = addUnit(s, { kind: shot.item, owner: shot.owner, x: landing.x, y: landing.y, base: ground.alt });
  if (unit.kind === 'extractor') unit.onVent = onVent(game.map, unit);
  conduit.to = unit.id;
  finishLaying(conduit, radius, ground.alt, game.map.size);
  ctx.emit({ type: 'built', unit: unit.id, kind: unit.kind, owner: unit.owner, heading: shot.heading });
}

// A building whose landing failed is never really there. Its conduit
// burns back from its end (spec 05, Landing).
function failBuilding(ctx, shot, reason, landing = null) {
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
  ctx.emit({ type: 'built', unit: unit.id, kind: 'pontoon', owner: unit.owner });
}
