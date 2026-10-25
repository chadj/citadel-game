// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The map wraps on all four edges, and distances are always measured
// the short way around (spec 01, Units and time; spec 02, Shape and
// size).

// v brought into [0, size).
export function wrap(v, size) {
  const r = v % size;
  return r < 0 ? r + size : r;
}

// The short way from `from` to `to`: a signed offset in
// (-size / 2, size / 2].
export function delta(from, to, size) {
  let d = wrap(to - from, size);
  if (2 * d > size) d -= size;
  return d;
}

// Squared distance between two points, the short way around.
export function dist2(ax, ay, bx, by, size) {
  const dx = delta(ax, bx, size);
  const dy = delta(ay, by, size);
  return dx * dx + dy * dy;
}
