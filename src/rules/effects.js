// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Turn cycles (spec 03, Turn cycles; decision D2).
//
// A pointer moves seat by seat around the table, and counts its steps.
// Seats of players who are out still count: play walks over them. Every
// change of turn moves the pointer at least one seat, so when one player
// takes turns back to back, the pointer goes all the way around between
// them. At the end of a round, it walks on to the next round's first
// player, after income is paid.
//
// An effect that starts while the pointer is at seat S lasts until the
// pointer next leaves S after going all the way around. With N seats,
// and the step count c when it starts, that's the step that takes the
// count to c + N + 1. Effects store that count as the step they end on.

// The step count at which an effect starting now ends.
export function cycleEnd(state) {
  return state.cycle.steps + state.seats.length + 1;
}

// Moves the pointer forward to `seat`: at least one step, and all the
// way around if it's already there. `onStep` is called after each step,
// to end the effects due at that count.
export function walkTo(state, seat, onStep) {
  const n = state.seats.length;
  do {
    state.cycle.seat = (state.cycle.seat + 1) % n;
    state.cycle.steps += 1;
    onStep(state.cycle.steps);
  } while (state.cycle.seat !== seat);
}
