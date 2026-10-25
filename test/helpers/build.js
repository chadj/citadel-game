// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Helpers for tests that build: aiming at a point, launching there, and
// destroying a unit the way an explosion would.

import { launch, flyToGround } from '../../src/rules/flight.js';
import { applyMove, settle, destroyUnit } from '../../src/rules/game.js';
import { sampleTerrain, tileIndex } from '../../src/rules/terrain/terrain.js';
import { UNIT_KINDS, addUnit, findUnit, unitTop, citadelOf } from '../../src/rules/units.js';
import { POWER_MAX, PX } from '../../src/rules/constants.js';
import { delta } from '../../src/rules/math/wrap.js';
import { whoseTurn } from './setups.js';

// The heading and power that bring a shot from `launcher` down closest
// to (x, y), in pixels, with no wind.
export function aimAt(game, launcher, x, y) {
  const size = game.map.size;
  const dx = delta(launcher.x, x * PX, size);
  const dy = delta(launcher.y, y * PX, size);
  const heading = ((Math.round((Math.atan2(dy, dx) * 180) / Math.PI) % 360) + 360) % 360;
  const want = Math.hypot(dx, dy);
  const reach = (power) => {
    const { x: lx, y: ly } = landingOf(game, launcher, heading, power);
    return Math.hypot(delta(launcher.x, lx, size), delta(launcher.y, ly, size));
  };
  let lo = 0;
  let hi = POWER_MAX;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (reach(mid) < want) lo = mid;
    else hi = mid;
  }
  const power = Math.abs(reach(lo) - want) <= Math.abs(reach(hi) - want) ? lo : hi;
  return { heading, power };
}

// Where a shot launched now would come down, in position units.
export function landingOf(game, launcher, heading, power) {
  const tops = new Map();
  for (const u of game.state.units) {
    if (u.kind === 'pontoon') tops.set(tileIndex(game.map, u.x, u.y), u.base + UNIT_KINDS.pontoon.height);
  }
  const env = { size: game.map.size, altitude: (x, y) => sampleTerrain(game.map, x, y, tops).alt };
  const shot = launch({
    x: launcher.x, y: launcher.y, top: unitTop(launcher), heading, power, launcher: launcher.kind,
  });
  return flyToGround(shot, null, env).landing;
}

// Launches `item` from `launcher` (the current player's Citadel by
// default) at (x, y), in pixels, and lets the game settle. Returns what
// the move returned, and the events it caused.
export function launchAt(game, item, x, y, { launcher, override, aim } = {}) {
  const player = whoseTurn(game);
  const from = launcher ?? citadelOf(game.state, player);
  const { heading, power } = aim ?? aimAt(game, from, x, y);
  const before = game.events.length;
  const move = { type: 'launch', player, launcher: from.id, item, heading, power };
  if (override !== undefined) move.override = override;
  const result = applyMove(game, move);
  if (result.ok) settle(game);
  return { result, heading, power, events: game.events.slice(before) };
}

// The unit a 'built' event among `events` added, or undefined.
export function builtUnit(game, events) {
  const built = events.find((e) => e.type === 'built');
  return built && findUnit(game.state, built.unit);
}

// Destroys a unit during play, credited to the current player, and lets
// everything that follows from it settle. Returns the events it caused.
export function destroyAndSettle(game, unit) {
  const before = game.events.length;
  const credit = whoseTurn(game);
  game.state.phase = 'flight';
  destroyUnit(game, unit, credit);
  settle(game);
  return game.events.slice(before);
}

// Gives every player plenty of energy.
export function richPlayers(game) {
  for (const p of game.state.players) p.energy = 350;
}

// Unit positions in pixels.
export const pos = (unit) => ({ x: unit.x / PX, y: unit.y / PX });

// Puts a unit straight onto the map at (x, y), in pixels, on the ground
// there unless `base` (in pixels) says otherwise. `extra` sets fields.
export function place(game, kind, owner, x, y, extra = {}) {
  const px = Math.round(x * PX);
  const py = Math.round(y * PX);
  const { base, ...rest } = extra;
  const unit = addUnit(game.state, {
    kind, owner, x: px, y: py, base: base === undefined ? sampleTerrain(game.map, px, py).alt : base * PX,
  });
  return Object.assign(unit, rest);
}

// Lets the game run until the waiting turn changes hands, and returns
// the events on the way.
export function settleEvents(game) {
  const before = game.events.length;
  settle(game);
  return game.events.slice(before);
}

// The landing point, in pixels, of a launch from `launcher` with no
// obstacles in the way.
export function landingPx(game, launcher, heading, power) {
  const p = landingOf(game, launcher, heading, power);
  return { x: p.x / PX, y: p.y / PX };
}
