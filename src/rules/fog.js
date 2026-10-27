// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Fog of war as rule state (spec 08; spec 12, The game state; decisions
// D10, D11, D37).
//
// With fog on, state.fog is { cells, counts }: the map is cells × cells
// square cells, and counts[side] holds, for each cell (y * cells + x),
// how many things reveal it to that side. A cell is visible while its
// count is above 0. The counts are worked out afresh from everything
// that reveals at every turn's start, when the state is compared and
// computer players look. Nothing in the rules depends on the fog during
// a flight, so the counts are kept up tick by tick only when the game
// asks for it with `game.liveFog`, as a screen showing the flight does.
// Either way, the state at a turn's start, and at the game's end, is the
// same.
//
// Where a weapon's flight ended, its view stays a moment: state.lingers
// lists { side, x, y, z, until }.

import {
  FOG_CELL, NODE_SIGHT, SPIRE_SIGHT, SIGHT_MAX, GROUND_SIGHT_MAX, UNIT_SIGHT_CURVE, PROBE_SIGHT_CURVE,
  SHOT_SIGHT_CURVE, LINGER_TICKS, OBLIQUE, PX,
} from './constants.js';
import { divRound, mulFrac, isqrt } from './math/fixed.js';
import { wrap } from './math/wrap.js';
import { unitTop, citadelOf } from './units.js';
import { isGone } from './conduits.js';

export function createFog(game) {
  if (!game.setup.fog) return null;
  const cells = game.map.size / FOG_CELL;
  const counts = {};
  for (const side of new Set(game.sides)) counts[side] = new Uint16Array(cells * cells);
  return { cells, counts };
}

// Sight along a curve of [altitude, sight] points in pixels, for an
// altitude in position units. Above the last point it stays there, or
// rises by rise[0] / rise[1] px per px, up to `max`.
function along(curve, alt, rise = null, max = SIGHT_MAX) {
  const pts = curve.map(([a, r]) => [a * PX, r * PX]);
  if (alt <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) {
    const [a0, r0] = pts[k - 1];
    const [a1, r1] = pts[k];
    if (alt <= a1) return r0 + divRound((alt - a0) * (r1 - r0), a1 - a0);
  }
  const [aN, rN] = pts[pts.length - 1];
  if (rise === null) return Math.min(max, rN);
  return Math.min(max, rN + divRound((alt - aN) * rise[0], rise[1]));
}

// How far a unit sees (spec 08, How far things see).
export function unitSight(unit) {
  if (unit.kind === 'spire') return SPIRE_SIGHT;
  const top = unitTop(unit);
  if (unit.kind === 'skyProbe') return along(PROBE_SIGHT_CURVE, top);
  return along(UNIT_SIGHT_CURVE, top, [3, 2], GROUND_SIGHT_MAX);
}

export const shotSight = (z) => along(SHOT_SIGHT_CURVE, z);

// What's revealed is centered where the revealer appears on screen.
const lifted = (y, z, size) => wrap(y - mulFrac(Math.max(0, z), OBLIQUE), size);

// Everything that reveals now, as [side, x, y, r].
export function revealers(game) {
  const s = game.state;
  const size = game.map.size;
  const side = (player) => game.sides[player];
  const out = [];
  for (const u of s.units) {
    const r = unitSight(u);
    const top = unitTop(u);
    out.push([side(u.owner), u.x, lifted(u.y, top, size), r]);
    // An infected unit reveals for the Worm's owner too.
    if (u.worm) out.push([side(u.worm.owner), u.x, lifted(u.y, top, size), r]);
  }
  // Every fifth node of each conduit, from the launcher (decision D11).
  for (const c of s.conduits) {
    for (let i = 4; i < c.nodes.length; i += 5) {
      const n = c.nodes[i];
      if (!isGone(s, n)) out.push([side(c.owner), n.x, n.y, NODE_SIGHT]);
    }
  }
  for (const shot of s.shots) out.push([side(shot.owner), shot.x, lifted(shot.y, shot.z, size), shotSight(shot.z)]);
  for (const m of s.missiles) out.push([side(m.owner), m.x, lifted(m.y, m.z, size), shotSight(m.z)]);
  for (const l of s.lingers) out.push([l.side, l.x, lifted(l.y, l.z, size), shotSight(l.z)]);
  return out;
}

// Lets lingering views that are over go.
export function dropLingers(state) {
  if (state.lingers.some((l) => l.until <= state.tick)) state.lingers = state.lingers.filter((l) => l.until > state.tick);
}

// Works the counts out afresh.
export function updateFog(game) {
  const s = game.state;
  dropLingers(s);
  const fog = s.fog;
  if (!fog) return;
  for (const side of Object.keys(fog.counts)) fog.counts[side].fill(0);
  const n = fog.cells;
  const half = FOG_CELL / 2;
  for (const [side, x, y, r] of revealers(game)) {
    const counts = fog.counts[side];
    // Each row of cells whose centers are within r: the run of columns
    // whose centers are within the circle's half-width at that row.
    const j0 = Math.ceil((y - r - half) / FOG_CELL);
    const j1 = Math.floor((y + r - half) / FOG_CELL);
    for (let j = j0; j <= j1; j++) {
      const dy = j * FOG_CELL + half - y;
      const w = isqrt(r * r - dy * dy);
      const i0 = Math.ceil((x - w - half) / FOG_CELL);
      const i1 = Math.floor((x + w - half) / FOG_CELL);
      const row = (((j % n) + n) % n) * n;
      for (let i = i0; i <= i1; i++) counts[row + (((i % n) + n) % n)] += 1;
    }
  }
}

// A weapon's view lingers about a second where its flight ended, while
// the fog is on; the turn waits for it (spec 08, What reveals the map).
export function linger(game, shot) {
  const s = game.state;
  if (!s.fog) return;
  s.lingers.push({ side: game.sides[shot.owner], x: shot.x, y: shot.y, z: Math.max(0, shot.z), until: s.tick + LINGER_TICKS });
}

// Whether a point of the map is visible to a player's side. With fog
// off, and for a side out of the game, everything is.
export function canSee(game, player, x, y) {
  const fog = game.state.fog;
  if (!fog || fogLifted(game, player)) return true;
  const n = fog.cells;
  const cx = Math.floor(wrap(x, game.map.size) / FOG_CELL) % n;
  const cy = Math.floor(wrap(y, game.map.size) / FOG_CELL) % n;
  return fog.counts[game.sides[player]][cy * n + cx] > 0;
}

// The fog lifts for good on the screens of a side that's out of the
// game: no human player on it still has a Citadel (spec 08, When the
// fog lifts). The winners don't get this.
export function fogLifted(game, player) {
  const side = game.sides[player];
  const s = game.state;
  if (s.result && s.result.winner === side) return false;
  return !game.setup.players.some((p, i) => game.sides[i] === side && !p.computer && citadelOf(s, i));
}
