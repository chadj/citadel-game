// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Spec 01's flight targets, measured with the rules' own flight. Shared
// by the tests and tools/calibrate.js. Distances are in pixels, times
// in seconds.

import { launch, flyToGround, makeWind, OUTPOST, BATTERY } from '../../src/rules/flight.js';
import { PX, TICKS_PER_SECOND, POWER_MAX, WIND_STRONG, LAUNCH_CLEARANCE } from '../../src/rules/constants.js';
import { px } from '../../src/rules/math/fixed.js';
import { delta } from '../../src/rules/math/wrap.js';
import { cosDeg, sinDeg } from '../../src/rules/math/trig.js';

// A launcher is about 20 px tall (spec 04).
export const LAUNCHER_HEIGHT = px(20);
const SIZE = px(3840);
const ORIGIN = SIZE / 2;

// Flat Ground everywhere, or a raised patch around the launcher.
export const flat = { size: SIZE, altitude: () => 0 };
export function raisedLauncher(height) {
  return {
    size: SIZE,
    altitude: (x, y) =>
      Math.abs(delta(ORIGIN, x, SIZE)) < px(60) && Math.abs(delta(ORIGIN, y, SIZE)) < px(60) ? height : 0,
  };
}

// Flies one shot from a launcher at the middle of the map. Returns how
// far it went along its heading and across it, how long it flew, and
// how high it rose above where it started.
export function fly({ launcher = OUTPOST, power = POWER_MAX, heading = 0, wind = null, env = flat } = {}) {
  const base = env.altitude(ORIGIN, ORIGIN);
  const shot = launch({ x: ORIGIN, y: ORIGIN, top: base + LAUNCHER_HEIGHT, heading, power, launcher });
  const start = shot.z;
  const { landing, ticks, peak } = flyToGround(shot, wind, env);
  const dx = delta(ORIGIN, landing.x, SIZE) / PX;
  const dy = delta(ORIGIN, landing.y, SIZE) / PX;
  const c = cosDeg(heading) / 65536;
  const s = sinDeg(heading) / 65536;
  return {
    along: dx * c + dy * s,
    across: dy * c - dx * s,
    distance: Math.hypot(dx, dy),
    seconds: ticks / TICKS_PER_SECOND,
    rise: (peak - start) / PX,
    landing,
  };
}

// A wind with no push and no drift: it only turns drag off along its
// direction. Along the heading, that's a flight with no drag at all.
function noDragAlong(heading) {
  return { dir: heading, push: 0, drift: 0, cos: cosDeg(heading), sin: sinDeg(heading) };
}

// Each case: what it measures, the value got, the target, and the
// allowed difference.
export function flightCases() {
  const full = fly();
  const short = fly({ power: 0 });
  const battery = fly({ launcher: BATTERY });
  const batteryShort = fly({ launcher: BATTERY, power: 0 });
  const noDrag = fly({ wind: noDragAlong(0) });
  const tail = fly({ wind: makeWind(WIND_STRONG, 0) });
  const head = fly({ wind: makeWind(WIND_STRONG, 180) });
  const cross = fly({ wind: makeWind(WIND_STRONG, 90) });
  const high = fly({ env: raisedLauncher(px(75)) });
  return [
    { name: 'Outpost full power: distance', got: full.distance, target: 500, within: 25 },
    { name: 'Outpost full power: seconds', got: full.seconds, target: 2.5, within: 0.25 },
    { name: 'Outpost full power: rise', got: full.rise, target: 150, within: 20 },
    { name: 'Outpost lowest power: distance', got: short.distance, target: 100, within: 15 },
    { name: 'Outpost lowest power: seconds', got: short.seconds, target: 1.2, within: 0.2 },
    { name: 'Outpost lowest power: rise', got: short.rise, target: 20, within: 8 },
    { name: 'Battery full power: distance', got: battery.distance, target: 900, within: 45 },
    { name: 'Battery full power: seconds', got: battery.seconds, target: 3.5, within: 0.35 },
    { name: 'Battery full power: rise', got: battery.rise, target: 300, within: 30 },
    { name: 'Battery lowest power: distance', got: batteryShort.distance, target: 100, within: 15 },
    { name: 'Battery / Outpost reach', got: battery.distance / full.distance, target: 1.8, within: 0.1 },
    { name: 'No drag / with drag', got: noDrag.distance / full.distance, target: 1.2, within: 0.06 },
    { name: 'Strong tailwind: distance', got: tail.along, target: 600, within: 40 },
    { name: 'Strong headwind: distance', got: head.along, target: 350, within: 35 },
    { name: 'Strong crosswind: along', got: cross.along, target: 500, within: 30 },
    { name: 'Strong crosswind: sideways', got: cross.across, target: 150, within: 20 },
    { name: 'From 75 px up: distance', got: high.distance, target: 540, within: 30 },
  ];
}
