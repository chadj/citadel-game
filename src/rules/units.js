// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Units: their numbers, and the basics every rule needs (spec 04). A
// unit in the game state is plain data:
//
//   { id, kind, owner, x, y, base, armor, citadel, disabledUntil }
//
// x, y and base are in position units; armor in tenths. A unit is
// disabled while the turn-cycle step count is below disabledUntil
// (decision D2; see effects.js).

import { px } from './math/fixed.js';

const kind = (armor, radius, height, launcher = false) =>
  Object.freeze({ armor, radius: px(radius), height: px(height), launcher });

// Armor in tenths; footprint radius and height in pixels (spec 04, The
// units; decision D29).
export const UNIT_KINDS = Object.freeze({
  outpost: kind(50, 15, 20, true),
  battery: kind(30, 15, 20, true),
  extractor: kind(50, 20, 20),
  barrier: kind(30, 15, 20),
  interceptor: kind(30, 18, 20),
  spire: kind(30, 15, 100),
  pontoon: kind(30, 30, 10),
  skyProbe: kind(10, 15, 50),
  charge: kind(10, 10, 20),
  rover: kind(30, 5, 2),
});

// Adds a unit to the state and returns it.
export function addUnit(state, { kind: k, owner, x, y, base, citadel = false }) {
  const spec = UNIT_KINDS[k];
  if (!spec) throw new Error(`no unit kind "${k}"`);
  const unit = {
    id: state.nextId++, kind: k, owner, x, y, base, armor: spec.armor, citadel, disabledUntil: 0,
    worm: null, // the Worm infecting it (worm.js)
    wormsHad: [], // the Worms that have infected it
    landing: false, // it has come down, but an Interceptor missile is still after it
  };
  if (k === 'barrier') unit.up = false; // its dome comes up at the next change of turn
  if (k === 'charge') {
    unit.armed = false; // once everything from its launch has settled
    unit.triggered = false;
  }
  state.units.push(unit);
  return unit;
}

export function findUnit(state, id) {
  return state.units.find((u) => u.id === id) ?? null;
}

// A unit's top altitude.
export function unitTop(unit) {
  return unit.base + UNIT_KINDS[unit.kind].height;
}

export function isWorking(state, unit) {
  return state.cycle.steps >= unit.disabledUntil;
}

export function isLauncher(unit) {
  return UNIT_KINDS[unit.kind].launcher;
}

export function citadelOf(state, player) {
  return state.units.find((u) => u.citadel && u.owner === player) ?? null;
}

export function hasWorkingLauncher(state, player) {
  return state.units.some((u) => u.owner === player && isLauncher(u) && isWorking(state, u));
}
