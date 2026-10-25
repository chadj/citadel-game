// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Making a shot (spec 09, Making a shot): the computer predicts the
// flight with the game's own flight rules, the wind and the launcher's
// height included, and searches for the heading and power that bring a
// shot down on a point.

import { PX, POWER_MAX } from '../rules/constants.js';
import { launch, flyToGround } from '../rules/flight.js';
import { sampleTerrain, tileIndex } from '../rules/terrain/terrain.js';
import { UNIT_KINDS, unitTop } from '../rules/units.js';
import { delta } from '../rules/math/wrap.js';

const DEG = 180 / Math.PI;

// The ground as shots meet it, Pontoons included.
export function envFor(game) {
  const tops = new Map();
  for (const u of game.state.units) {
    if (u.kind === 'pontoon') tops.set(tileIndex(game.map, u.x, u.y), u.base + UNIT_KINDS.pontoon.height);
  }
  return {
    size: game.map.size,
    altitude: (x, y) => sampleTerrain(game.map, x, y, tops).alt,
    terrain: (x, y) => sampleTerrain(game.map, x, y, tops),
  };
}

// Where a shot from the launcher comes down, with nothing in its way.
// A building feels the wind only once its conduit starts; that is near
// enough to the launch for planning, so the wind is on from the start.
export function landing(game, env, launcher, heading, power) {
  const shot = launch({ x: launcher.x, y: launcher.y, top: unitTop(launcher), heading, power, launcher: launcher.kind });
  return flyToGround(shot, game.wind, env).landing;
}

export function bearing(size, from, to) {
  const a = Math.atan2(delta(from.y, to.y, size), delta(from.x, to.x, size)) * DEG;
  return ((Math.round(a) % 360) + 360) % 360;
}

export function distance(size, a, b) {
  return Math.hypot(delta(a.x, b.x, size), delta(a.y, b.y, size));
}

// How far the launcher reaches at full power, about.
export function reach(game, env, launcher) {
  const far = landing(game, env, launcher, 0, POWER_MAX);
  return distance(game.map.size, launcher, far);
}

// The heading and power that land a shot nearest the target, with how
// far off it comes down; or null if the target is out of reach.
export function solve(game, env, launcher, target, { tolerance = 4 * PX } = {}) {
  const size = game.map.size;
  let heading = bearing(size, launcher, target);
  let best = null;
  for (let round = 0; round < 4; round++) {
    // Along this heading, the distance grows with the power.
    const want = distance(size, launcher, target);
    let lo = 0;
    let hi = POWER_MAX;
    const along = (p) => {
      const at = landing(game, env, launcher, heading, p);
      return { at, d: distance(size, launcher, at) };
    };
    if (along(hi).d < want - 30 * PX) return best;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (along(mid).d < want) lo = mid;
      else hi = mid;
    }
    const pick = [lo, hi].map((p) => ({ p, ...along(p) }))
      .map((c) => ({ ...c, miss: distance(size, c.at, target) }))
      .sort((a, b) => a.miss - b.miss)[0];
    if (!best || pick.miss < best.miss) best = { heading, power: pick.p, miss: pick.miss, at: pick.at };
    if (pick.miss <= tolerance) break;
    // Turn by how far the wind pushed it aside.
    const off = bearing(size, launcher, pick.at) - bearing(size, launcher, target);
    const turn = ((off + 540) % 360) - 180;
    if (turn === 0) break;
    heading = (((heading - turn) % 360) + 360) % 360;
  }
  return best;
}
