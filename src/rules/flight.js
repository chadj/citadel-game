// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Launching and flight (spec 01; decisions D22, D25).
//
// Every launch leaves at 45°. The player picks a heading in whole
// degrees and a power from 0 to POWER_MAX. Each tick, in this order:
//   1. gravity pulls the shot down;
//   2. drag slows its movement across the ground, except along the
//      wind's direction when the wind acts on it; the wind pushes it
//      toward the drift speed;
//   3. it moves, and wraps around the map's edges;
//   4. it lands if it has come down to the ground beneath it.
// Collisions in the air are added on top of this by chapter 06's rules.

import {
  GRAVITY, DRAG, POWER_MAX, LAUNCH_CLEARANCE, WIND_NONE, WIND_MEDIUM,
  STRONG_PUSH, STRONG_DRIFT, WIND_SHARE, WIND_MIN_SPEED, MEDIUM_VARIATION,
  OUTPOST_SPEED_MIN, OUTPOST_SPEED_MAX, BATTERY_SPEED_MIN, BATTERY_SPEED_MAX,
} from './constants.js';
import { ONE, VEL_PER_POS, divRound, mulFrac, isqrt } from './math/fixed.js';
import { sinDeg, cosDeg, normDeg } from './math/trig.js';
import { wrap } from './math/wrap.js';

export const OUTPOST = 'outpost';
export const BATTERY = 'battery';

const SPEEDS = Object.freeze({
  [OUTPOST]: [OUTPOST_SPEED_MIN, OUTPOST_SPEED_MAX],
  [BATTERY]: [BATTERY_SPEED_MIN, BATTERY_SPEED_MAX],
});

// The wind for a game (spec 01, Setting up the wind). `dir` is a whole
// degree, the way the wind blows toward. `variation` is the roll for a
// Medium wind, in ONE units from -MEDIUM_VARIATION to MEDIUM_VARIATION;
// the other levels ignore it. Both are rolled once, at the start.
export function makeWind(level, dir, variation = 0) {
  if (level === WIND_NONE) return null;
  let share = WIND_SHARE[level];
  if (level === WIND_MEDIUM) {
    if (Math.abs(variation) > MEDIUM_VARIATION) throw new RangeError('Medium wind variation out of range');
    share = mulFrac(share, ONE + variation);
  }
  const d = normDeg(dir);
  return Object.freeze({
    dir: d,
    push: mulFrac(STRONG_PUSH, share),
    drift: mulFrac(STRONG_DRIFT, share),
    cos: cosDeg(d),
    sin: sinDeg(d),
  });
}

// The per-axis launch speed for a power: its square grows evenly with
// the power, so the distance grows about evenly too.
export function launchSpeed(launcher, power) {
  const [lo, hi] = SPEEDS[launcher];
  if (!Number.isInteger(power) || power < 0 || power > POWER_MAX) {
    throw new RangeError(`power ${power} isn't a whole number from 0 to ${POWER_MAX}`);
  }
  return isqrt(lo * lo + divRound((hi * hi - lo * lo) * power, POWER_MAX));
}

// A new shot over (x, y), leaving from just above `top`, the launcher's
// top altitude. `windFromStart` is false for buildings, which feel the
// wind only once their conduit starts (spec 05).
export function launch({ x, y, top, heading, power, launcher, windFromStart = true }) {
  if (!Number.isInteger(heading)) throw new RangeError('heading must be a whole degree');
  const speed = launchSpeed(launcher, power);
  return {
    x,
    y,
    z: top + LAUNCH_CLEARANCE,
    vx: mulFrac(speed, cosDeg(heading)),
    vy: mulFrac(speed, sinDeg(heading)),
    vz: speed,
    windOn: windFromStart,
  };
}

// One tick of flight. `env` is { size, altitude(x, y) }, with size the
// map's side in position units. Returns the landing point { x, y, z }
// if the shot comes down this tick, or null. The shot is updated in
// place.
export function stepShot(shot, wind, env) {
  shot.vz -= GRAVITY;

  if (wind && shot.windOn) {
    // Along the wind (u) and across it (w).
    const { cos, sin } = wind;
    const u = divRound(shot.vx * cos + shot.vy * sin, ONE);
    const w = divRound(shot.vy * cos - shot.vx * sin, ONE);
    let du = 0;
    const dw = -mulFrac(w, DRAG);
    const moving = shot.vx * shot.vx + shot.vy * shot.vy >= WIND_MIN_SPEED * WIND_MIN_SPEED;
    if (moving && u < wind.drift) du = Math.min(wind.push, wind.drift - u);
    shot.vx += divRound(du * cos - dw * sin, ONE);
    shot.vy += divRound(du * sin + dw * cos, ONE);
  } else {
    shot.vx -= mulFrac(shot.vx, DRAG);
    shot.vy -= mulFrac(shot.vy, DRAG);
  }

  const x0 = shot.x;
  const y0 = shot.y;
  const z0 = shot.z;
  const dx = divRound(shot.vx, VEL_PER_POS);
  const dy = divRound(shot.vy, VEL_PER_POS);
  const dz = divRound(shot.vz, VEL_PER_POS);
  shot.x = wrap(x0 + dx, env.size);
  shot.y = wrap(y0 + dy, env.size);
  shot.z = z0 + dz;

  if (shot.z > env.altitude(shot.x, shot.y)) return null;
  return findLanding(x0, y0, z0, dx, dy, dz, env);
}

// Where along this tick's move the shot first met the ground: checked
// in sixteenths of the move, then narrowed down by halving.
const STEPS = 16;
const SCALE = 1024;
function findLanding(x0, y0, z0, dx, dy, dz, env) {
  const at = (t) => ({
    x: wrap(x0 + divRound(dx * t, SCALE), env.size),
    y: wrap(y0 + divRound(dy * t, SCALE), env.size),
    z: z0 + divRound(dz * t, SCALE),
  });
  const below = (p) => p.z <= env.altitude(p.x, p.y);
  let lo = 0;
  let hi = SCALE;
  for (let k = 1; k <= STEPS; k++) {
    const t = (k * SCALE) / STEPS;
    if (below(at(t))) {
      hi = t;
      break;
    }
    lo = t;
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (below(at(mid))) hi = mid;
    else lo = mid;
  }
  const p = at(hi);
  return { x: p.x, y: p.y, z: env.altitude(p.x, p.y) };
}

// Flies a shot until it lands, with nothing in the air to hit. Used by
// tests, tuning and computer players. Returns the landing point, the
// number of ticks, and the highest altitude reached.
export function flyToGround(shot, wind, env, maxTicks = 3000) {
  let peak = shot.z;
  for (let tick = 1; tick <= maxTicks; tick++) {
    const landing = stepShot(shot, wind, env);
    if (shot.z > peak) peak = shot.z;
    if (landing) return { landing, ticks: tick, peak };
  }
  throw new Error(`shot still flying after ${maxTicks} ticks`);
}
