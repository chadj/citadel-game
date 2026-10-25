// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Barrier domes (spec 04, Barrier; spec 06, Barriers; decisions D12,
// D32).
//
// A dome is a half-sphere centered on the Barrier's base. A point is
// inside it if it's no lower than the base and closer to the center
// than the dome's radius. A shot is stopped where it enters a dome of a
// working Barrier of an enemy side, or where it leaves one it started
// inside. Barriers of its own side, and Barriers that are disabled or
// not up yet, are ignored completely.

import { DOME_RADIUS } from './constants.js';
import { delta, wrap } from './math/wrap.js';
import { isWorking } from './units.js';

export function insideDome(barrier, x, y, z, size) {
  if (z < barrier.base) return false;
  const dx = delta(barrier.x, x, size);
  const dy = delta(barrier.y, y, size);
  const dz = z - barrier.base;
  return dx * dx + dy * dy + dz * dz < DOME_RADIUS * DOME_RADIUS;
}

// The Barriers whose domes can stop something of `side`.
export function enemyDomes(game, side) {
  const s = game.state;
  return s.units.filter((u) => u.kind === 'barrier' && u.up && isWorking(s, u) && game.sides[u.owner] !== side);
}

// The ids of the enemy domes a point is inside: where a shot starts.
export function domesAround(game, side, x, y, z) {
  return enemyDomes(game, side).filter((b) => insideDome(b, x, y, z, game.map.size)).map((b) => b.id);
}

// Whether the move from p0 to p1 is stopped by a dome. Returns
// { barrier, x, y, z, entering } with the point on the dome's edge, or
// null.
export function domeStop(game, side, startedIn, p0, p1) {
  const size = game.map.size;
  for (const b of enemyDomes(game, side)) {
    const in0 = insideDome(b, p0.x, p0.y, p0.z, size);
    const in1 = insideDome(b, p1.x, p1.y, p1.z, size);
    const entering = !in0 && in1;
    const leaving = in0 && !in1 && startedIn.includes(b.id);
    if (!entering && !leaving) continue;
    // Narrow down the edge by halving the move.
    const dx = delta(p0.x, p1.x, size);
    const dy = delta(p0.y, p1.y, size);
    const dz = p1.z - p0.z;
    const at = (t) => ({
      x: wrap(p0.x + Math.trunc((dx * t) / 1024), size),
      y: wrap(p0.y + Math.trunc((dy * t) / 1024), size),
      z: p0.z + Math.trunc((dz * t) / 1024),
    });
    let lo = 0;
    let hi = 1024;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const p = at(mid);
      if (insideDome(b, p.x, p.y, p.z, size) === in0) lo = mid;
      else hi = mid;
    }
    return { barrier: b.id, entering, ...at(hi) };
  }
  return null;
}
