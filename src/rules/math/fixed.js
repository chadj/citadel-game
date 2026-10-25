// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Integer fixed-point arithmetic for the rules (decision D21). Every
// number in the game state is a whole number in one of these units, so
// every machine computes exactly the same results.

// Positions, altitudes and distances: units per pixel.
export const PX = 1024;

// Velocities: units per pixel per tick. A velocity moves a position by
// velocity / (VEL / PX) position units each tick.
export const VEL = 65536;
export const VEL_PER_POS = VEL / PX;

// Fractions and trig values: units per 1.
export const ONE = 65536;

// a / b rounded to the nearest whole number, halves away from zero. It's
// symmetric, so mirrored inputs give mirrored results. Exact while |a|
// is below 2^53.
export function divRound(a, b) {
  let q = Math.trunc(a / b);
  const r = a - q * b;
  if (2 * Math.abs(r) >= Math.abs(b)) q += (r < 0) === (b < 0) ? 1 : -1;
  return q;
}

// a times a fraction f (in ONE units), rounded.
export function mulFrac(a, f) {
  return divRound(a * f, ONE);
}

// The largest whole number whose square is at most n (n ≥ 0, below 2^53).
export function isqrt(n) {
  if (n < 0) throw new RangeError('isqrt of a negative number');
  let s = Math.floor(Math.sqrt(n));
  while (s * s > n) s--;
  while ((s + 1) * (s + 1) <= n) s++;
  return s;
}

// Whole pixels to position units.
export function px(n) {
  return Math.round(n * PX);
}
