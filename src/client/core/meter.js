// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The power meter (spec 01, Power; spec 10, The launching view;
// decision D22). The player holds Launch: the meter fills from the
// lowest power to the highest in about 1.25 seconds, then runs back
// down at the same speed, and fires by itself at the bottom. The meter
// moves once a tick, at the rules' 30 ticks a second, so the power comes
// in METER_FILL_TICKS coarse steps each way. The meter shows it only in
// METER_STEPS steps.

import { POWER_MAX } from '../../rules/constants.js';

export const METER_FILL_TICKS = 38; // about 1.25 s
export const METER_STEPS = 20;
// The meter has always started to fill: the quickest tap counts as this
// many ticks, so it fires a little above the lowest power (spec 01, The
// shortest shots).
export const MIN_HOLD_TICKS = 1;

// How full the meter is after holding for `ticks`: 0 to 1.
export function meterLevel(ticks) {
  const t = Math.max(0, ticks);
  if (t <= METER_FILL_TICKS) return t / METER_FILL_TICKS;
  return Math.max(0, (2 * METER_FILL_TICKS - t) / METER_FILL_TICKS);
}

// The power a release after `ticks` fires at.
export const meterPower = (ticks) => Math.round(meterLevel(ticks) * POWER_MAX);

// Whether the meter has come back down to the bottom, and fires.
export const meterRunOut = (ticks) => ticks >= 2 * METER_FILL_TICKS;

// How many of the meter's steps show lit for a power.
export const meterShown = (power) => Math.ceil((power * METER_STEPS) / POWER_MAX);

// The meter while Launch is held.
export class Meter {
  constructor() {
    this.held = null; // ticks held, or null when not holding
    this.shown = null; // the last shot's power, shown until the next pick
  }

  get holding() {
    return this.held !== null;
  }

  start() {
    this.held = 0;
    this.shown = 0;
  }

  // Ticks pass. Returns the power if the meter ran out and fires.
  update(ticks = 1) {
    if (this.held === null) return null;
    this.held += ticks;
    this.shown = meterPower(this.held);
    if (meterRunOut(this.held)) return this.release();
    return null;
  }

  // Lets go: returns the power to fire at.
  release() {
    if (this.held === null) return null;
    const power = meterPower(Math.max(MIN_HOLD_TICKS, this.held));
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
