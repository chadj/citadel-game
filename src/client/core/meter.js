// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The power meter (spec 01, Power; spec 10, The launching view;
// decision D22). The player holds Launch: the meter fills from the
// lowest power to the highest in about 1.25 seconds, then runs back
// down at the same speed, and fires by itself at the bottom. The power
// comes from how long Launch was held, so it isn't limited to a step
// per tick. The meter shows it only in METER_STEPS steps.

import { POWER_MAX } from '../../rules/constants.js';

export const METER_FILL_MS = 1250;
export const METER_STEPS = 20;
// The meter has always started to fill: the quickest tap counts as this
// long, so it fires a little above the lowest power (spec 01, The
// shortest shots).
export const MIN_HOLD_MS = 40;

// How full the meter is after holding for `ms`: 0 to 1.
export function meterLevel(ms) {
  const t = Math.max(0, ms);
  if (t <= METER_FILL_MS) return t / METER_FILL_MS;
  return Math.max(0, (2 * METER_FILL_MS - t) / METER_FILL_MS);
}

// The power a release after `ms` fires at.
export const meterPower = (ms) => Math.round(meterLevel(ms) * POWER_MAX);

// Whether the meter has come back down to the bottom, and fires.
export const meterRunOut = (ms) => ms >= 2 * METER_FILL_MS;

// How many of the meter's steps show lit for a power.
export const meterShown = (power) => Math.ceil((power * METER_STEPS) / POWER_MAX);

// The meter while Launch is held.
export class Meter {
  constructor() {
    this.held = null; // ms held, or null when not holding
    this.shown = null; // the last shot's power, shown until the next pick
  }

  get holding() {
    return this.held !== null;
  }

  start() {
    this.held = 0;
    this.shown = 0;
  }

  // Time passes. Returns the power if the meter ran out and fires.
  update(ms) {
    if (this.held === null) return null;
    this.held += ms;
    this.shown = meterPower(this.held);
    if (meterRunOut(this.held)) return this.release();
    return null;
  }

  // Lets go: returns the power to fire at.
  release() {
    if (this.held === null) return null;
    const power = meterPower(Math.max(MIN_HOLD_MS, this.held));
    this.held = null;
    this.shown = power;
    return power;
  }

  // Lets go without firing (the launch couldn't happen).
  cancel() {
    this.held = null;
  }

  clear() {
    this.held = null;
    this.shown = null;
  }
}
