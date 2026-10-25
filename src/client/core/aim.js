// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The aim, as the player turns it (spec 01, Aiming, Shots are hard to
// repeat exactly; spec 10, Selecting a launcher; decision D22).
//
// The aim turns in eighths of a degree. A shot follows it only to the
// whole degree, and the targeting marks show it only to the nearest
// MARK_STEP degrees. So two aims that look the same can fly differently.

export const AIM_FINE = 8; // steps per degree
export const AIM_FULL = 360 * AIM_FINE;
export const PRESS_TURN = 9; // a press turns 1⅛°: about a degree
export const MARK_STEP = 3; // the marks show the heading to about 3°

// Holding an arrow: after a short wait, it turns faster and faster, up
// to about 250° a second (decision D22).
export const HOLD_WAIT_MS = 60;
export const RAMP_MS = 900;
export const START_RATE = 15; // degrees a second
export const MAX_RATE = 250;

export const wrapAim = (fine) => ((Math.round(fine) % AIM_FULL) + AIM_FULL) % AIM_FULL;

// The whole degree a shot follows, for a move.
export const moveHeading = (fine) => Math.round(fine / AIM_FINE) % 360;

// The heading the targeting marks show, in degrees.
export const markHeading = (fine) => (Math.round(fine / AIM_FINE / MARK_STEP) * MARK_STEP) % 360;

// The aim of a launcher whose heading is a whole degree, such as a
// building that has just landed (spec 01, Aiming).
export const aimFromHeading = (heading) => wrapAim(heading * AIM_FINE);

// Turning with an arrow held. `dir` is -1 (counterclockwise) or 1.
export class AimTurner {
  constructor() {
    this.dir = 0;
    this.held = 0;
    this.carry = 0;
  }

  // Starts turning; returns the press's own turn, in steps.
  press(dir) {
    this.dir = dir;
    this.held = 0;
    this.carry = 0;
    return dir * PRESS_TURN;
  }

  release() {
    this.dir = 0;
  }

  get turning() {
    return this.dir !== 0;
  }

  // Time passes; returns the turn in steps since the last call.
  update(ms) {
    if (this.dir === 0) return 0;
    const from = this.held;
    this.held += ms;
    // Degrees turned between `from` and `held`, integrating the rate.
    const turned = degreesHeld(this.held) - degreesHeld(from);
    const steps = turned * AIM_FINE + this.carry;
    const whole = Math.trunc(steps);
    this.carry = steps - whole;
    return this.dir * whole;
  }
}

// Degrees turned after holding for t ms, beyond the press itself.
function degreesHeld(t) {
  const s = Math.max(0, t - HOLD_WAIT_MS);
  const ramp = Math.min(s, RAMP_MS);
  const rise = (MAX_RATE - START_RATE) / RAMP_MS;
  let deg = (START_RATE * ramp + (rise * ramp * ramp) / 2) / 1000;
  if (s > RAMP_MS) deg += (MAX_RATE * (s - RAMP_MS)) / 1000;
  return deg;
}
