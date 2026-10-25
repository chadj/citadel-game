// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Conduits and their nodes (spec 05; decisions D5, D6, D31).
//
// A conduit in the game state is plain data:
//
//   {
//     id, owner,
//     from,        // the launcher's unit id
//     to,          // the building's unit id, or null until it lands
//     shot,        // the building's shot id while it flies, else null
//     started,     // whether the first node has been laid
//     nextAt,      // path distance of the next node to lay
//     path,        // [{ x, y, d }]: the building's track over the ground while it flies
//     broken,      // a node settled where it mustn't; no more nodes are laid
//     doomAt, doomCredit, // when the building at the far end goes, and who gets the credit
//     doomFails,   // whether that counts as its landing failing (a break while laying)
//     nodes: [{ x, y, z, vz, resting, burnAt }],
//   }
//
// Nodes are only ever marked burnt (burnAt reached), never removed while
// the conduit lasts, so their positions along the conduit stay fixed.

import {
  NODE_SPACING, CONDUIT_START_GAP, NODE_CLEARANCE, WARNING_DISTANCE, LANDING_CLEARANCE,
  NODE_TRAIL_TICKS, NODE_TRAIL_MAX, BURN_TICKS, GRAVITY, WET,
} from './constants.js';
import { VEL_PER_POS, divRound, mulFrac, isqrt } from './math/fixed.js';
import { cosDeg, sinDeg } from './math/trig.js';
import { wrap, delta, dist2 } from './math/wrap.js';
import { UNIT_KINDS } from './units.js';

// How far from the launcher's center the first node lies.
export function conduitStart(launcher) {
  return UNIT_KINDS[launcher.kind].radius + CONDUIT_START_GAP;
}

export function createConduit(state, { owner, launcher, shot }) {
  const conduit = {
    id: state.nextId++,
    owner,
    from: launcher.id,
    to: null,
    shot: shot.id,
    started: false,
    nextAt: 0,
    path: [{ x: shot.x, y: shot.y, d: 0 }],
    broken: false,
    doomAt: null,
    doomCredit: null,
    doomFails: false,
    nodes: [],
  };
  state.conduits.push(conduit);
  return conduit;
}

export const isGone = (state, node) => node.burnAt !== null && node.burnAt <= state.tick;

// Called after the building's shot has moved. Extends the track over the
// ground, starts the conduit once the building is clear of its launcher,
// and lays the nodes it has got far enough past. Returns true on the
// tick the conduit starts, when the wind starts acting on the building
// (spec 05, Laying the conduit).
export function trackBuilding(state, conduit, shot, launcher, heading, size) {
  const last = conduit.path[conduit.path.length - 1];
  const dx = delta(last.x, shot.x, size);
  const dy = delta(last.y, shot.y, size);
  const d = last.d + isqrt(dx * dx + dy * dy);
  conduit.path.push({ x: shot.x, y: shot.y, d });

  let startedNow = false;
  if (!conduit.started) {
    const start = conduitStart(launcher);
    if (d < start) return false;
    // The first node lies on the launch heading, whatever the wind did.
    conduit.started = true;
    startedNow = true;
    layNode(conduit, wrap(launcher.x + mulFrac(start, cosDeg(heading)), size),
      wrap(launcher.y + mulFrac(start, sinDeg(heading)), size), shot.z);
    conduit.nextAt = start + NODE_SPACING;
  }
  if (conduit.broken) return startedNow;
  const trail = Math.min(NODE_TRAIL_MAX, Math.max(0, divRound(-shot.vz * NODE_TRAIL_TICKS, VEL_PER_POS)));
  layUpTo(conduit, d - trail, shot.z, size);
  return startedNow;
}

// When the building has landed well: lays the nodes left, up to its
// footprint.
export function finishLaying(conduit, radius, z, size) {
  if (!conduit.started || conduit.broken) return;
  layUpTo(conduit, conduit.path[conduit.path.length - 1].d - radius, z, size);
  conduit.path = [];
  conduit.shot = null;
}

function layUpTo(conduit, until, z, size) {
  while (conduit.nextAt <= until) {
    const { x, y } = pointAt(conduit.path, conduit.nextAt, size);
    layNode(conduit, x, y, z);
    conduit.nextAt += NODE_SPACING;
  }
}

function layNode(conduit, x, y, z) {
  conduit.nodes.push({ x, y, z, vz: 0, resting: false, burnAt: null });
}

// The point at path distance d along the building's track.
function pointAt(path, d, size) {
  let k = 1;
  while (k < path.length - 1 && path[k].d < d) k++;
  const a = path[k - 1];
  const b = path[k];
  const span = b.d - a.d;
  if (span === 0) return { x: b.x, y: b.y };
  const t = d - a.d;
  return {
    x: wrap(a.x + divRound(delta(a.x, b.x, size) * t, span), size),
    y: wrap(a.y + divRound(delta(a.y, b.y, size) * t, span), size),
  };
}

// One tick of falling nodes. `terrain(x, y)` gives { alt, type }.
// Returns the nodes that came to rest this tick, as [conduit, index].
export function fallNodes(state, terrain) {
  const settled = [];
  for (const conduit of state.conduits) {
    conduit.nodes.forEach((node, index) => {
      if (node.resting || isGone(state, node)) return;
      node.vz -= GRAVITY;
      node.z += divRound(node.vz, VEL_PER_POS);
      const ground = terrain(node.x, node.y);
      if (node.z > ground.alt) return;
      node.z = ground.alt;
      node.vz = 0;
      node.resting = true;
      settled.push([conduit, index, ground.type]);
    });
  }
  return settled;
}

// Why a node that has just come to rest breaks its conduit, or null
// (spec 05, Conduits that break). A node near an armed Charge is
// checked by the caller, since the Charge then goes off.
export function breakReason(state, conduit, node, groundType, size) {
  if (groundType === WET) return 'water';
  for (const u of state.units) {
    // A Pontoon's tile is ground conduits may cross; a Sky Probe floats
    // high above; the conduit's own building is where it ends (D6).
    if (u.kind === 'pontoon' || u.kind === 'skyProbe' || u.id === conduit.to) continue;
    const r = UNIT_KINDS[u.kind].radius;
    if (dist2(node.x, node.y, u.x, u.y, size) < r * r) return 'unit';
  }
  if (nodeWithin(state, node.x, node.y, NODE_CLEARANCE, conduit.id, size)) return 'conduit';
  return null;
}

// Whether any node of a conduit other than `except` is within `r` of
// (x, y), measured across the ground.
export function nodeWithin(state, x, y, r, except, size) {
  for (const c of state.conduits) {
    if (c.id === except) continue;
    for (const n of c.nodes) {
      if (!isGone(state, n) && dist2(x, y, n.x, n.y, size) < r * r) return true;
    }
  }
  return false;
}

// Whether a building landing at (x, y) has another conduit's node within
// a few pixels of its footprint (spec 05, Landing).
export function nodeNearFootprint(state, x, y, radius, own, size) {
  return nodeWithin(state, x, y, radius + LANDING_CLEARANCE, own, size);
}

// Starts a burn at node `index`, from tick `at`, spreading both ways at
// BURN_TICKS per node. A node already burning burns at whichever time
// comes first. `origin` says where it started: 'child' when the
// building at the far end was destroyed, 'parent' when the launcher
// was, 'break' when a node broke it as it was laid, or 'sink' when a
// Pontoon under it went. Unless the building at the far end is what was
// destroyed, it goes once the burn reaches it (spec 05, Conduits that
// break, When a building is destroyed). After a break, that building's
// landing has failed, so it doesn't explode (spec 04, Extractor).
export function burn(conduit, index, at, origin, credit) {
  let last = at;
  conduit.nodes.forEach((node, j) => {
    const t = at + Math.abs(j - index) * BURN_TICKS;
    if (node.burnAt === null || t < node.burnAt) node.burnAt = t;
    if (j === conduit.nodes.length - 1) last = node.burnAt;
  });
  conduit.broken = true;
  if (origin === 'child' || conduit.to === null) return;
  const doom = last + BURN_TICKS;
  if (conduit.doomAt === null || doom < conduit.doomAt) {
    conduit.doomAt = doom;
    conduit.doomCredit = credit;
    conduit.doomFails = origin === 'break';
  }
}

// One tick of burning. Returns the buildings whose time has come, as
// [unitId, credit, fails], and drops conduits that have burned away.
export function advanceBurns(state, onNodeBurnt) {
  const doomed = [];
  for (const conduit of state.conduits) {
    conduit.nodes.forEach((node, index) => {
      if (node.burnAt === state.tick) onNodeBurnt(conduit, index);
    });
    if (conduit.doomAt !== null && conduit.doomAt <= state.tick) {
      doomed.push([conduit.to, conduit.doomCredit, conduit.doomFails]);
      conduit.doomAt = null;
    }
  }
  state.conduits = state.conduits.filter(
    (c) => c.shot !== null || c.doomAt !== null || c.nodes.some((n) => !isGone(state, n)),
  );
  return doomed;
}

// Whether anything about conduits is still in motion: a node falling,
// or a burn not yet finished.
export function conduitsBusy(state) {
  return state.conduits.some((c) =>
    c.doomAt !== null
    || c.nodes.some((n) => (n.burnAt !== null && n.burnAt > state.tick) || (!n.resting && !isGone(state, n))));
}

// The launcher's conduits that a new conduit, launched on `heading`,
// would start too close to (spec 05, Aiming along your own conduit).
// Includes the conduit leading into the launcher.
export function conduitWarning(state, launcher, heading, size) {
  const start = conduitStart(launcher);
  const x = wrap(launcher.x + mulFrac(start, cosDeg(heading)), size);
  const y = wrap(launcher.y + mulFrac(start, sinDeg(heading)), size);
  const r2 = WARNING_DISTANCE * WARNING_DISTANCE;
  return state.conduits
    .filter((c) => (c.from === launcher.id || c.to === launcher.id)
      && c.nodes.some((n) => !isGone(state, n) && dist2(x, y, n.x, n.y, size) < r2))
    .map((c) => c.id);
}
