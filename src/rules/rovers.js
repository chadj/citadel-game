// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Rovers: their landing, and their drive at the end of every round
// (spec 04, Rover; spec 06, Rover; spec 07; decisions D8, D9, D13, D36).
//
// A Rover unit also carries `heading` (the launch heading, which it
// drives along) and `triggered` (it has reached an enemy and is about
// to explode). While Rovers drive, state.drive is
//   { rover, owner, x, y, d, done }
// with where this round's drive started, how far it has gone, and
// whether it has ended; state.roverQueue lists the Rovers still to go.

import {
  ROVER_LAND_NODE, ROVER_REACH, ROVER_UNDERWATER, ROVER_DRIVE, ROVER_DRIVE_TICKS, ROVER_SUBSTEPS,
  ROVER_NODE_REACH, ROVER_UNIT_PAUSE, ROVER_CONDUIT_PAUSE, ROVER_BLAST, CHARGE_BLAST, WET, ONE,
} from './constants.js';
import { divRound, mulFrac } from './math/fixed.js';
import { cosDeg, sinDeg } from './math/trig.js';
import { delta, wrap } from './math/wrap.js';
import { UNIT_KINDS, addUnit, findUnit, isWorking } from './units.js';
import { isGone } from './conduits.js';
import {
  groundGap, gap3, nearest, blastPoint, isArmedCharge, armedChargeNear, setOff, schedule, scheduleBlast,
} from './combat.js';
import { insideDome, enemyDomes } from './barriers.js';
import { chaseLanded } from './interceptors.js';

// Units a Rover reacts to: everything but Sky Probes and Pontoons
// (spec 07; decision D9).
const counts = (u) => u.kind !== 'skyProbe' && u.kind !== 'pontoon';

// A Rover that explodes where it is, without ever being a unit: on the
// spot in the air, or as it lands. It goes off a second later.
export function roverExplodesAt(ctx, p, credit) {
  const s = ctx.game.state;
  ctx.emit({ type: 'roverExplodes', x: p.x, y: p.y, z: p.z });
  schedule(s, { type: 'blast', at: s.tick + ROVER_BLAST.delay, x: p.x, y: p.y, z: p.z + 1, damage: ROVER_BLAST.damage, radius: ROVER_BLAST.radius, credit });
}

// A Rover coming down (spec 04, spec 06).
export function landRover(ctx, shot, landing) {
  const { game } = ctx;
  const s = game.state;
  const size = game.map.size;
  const credit = ctx.credit();
  const nearNode = s.conduits.some((c) => c.nodes.some((n) => !isGone(s, n)
    && sq(delta(landing.x, n.x, size)) + sq(delta(landing.y, n.y, size)) <= sq(ROVER_LAND_NODE)));
  if (nearNode) return roverExplodesAt(ctx, landing, credit);
  const charge = armedChargeNear(game, landing.x, landing.y, landing.z);
  if (charge) {
    setOff(ctx, charge, credit);
    return roverExplodesAt(ctx, landing, credit);
  }
  const side = game.sides[shot.owner];
  const close = s.units.some((u) => counts(u) && (u.kind === 'rover' || game.sides[u.owner] !== side)
    && groundGap(size, landing.x, landing.y, u) <= ROVER_REACH);
  if (close) return roverExplodesAt(ctx, landing, credit);

  const ground = ctx.terrain(landing.x, landing.y);
  const underwater = ground.type === WET;
  const unit = addUnit(s, {
    kind: 'rover', owner: shot.owner, x: landing.x, y: landing.y,
    base: underwater ? -ROVER_UNDERWATER : ground.alt,
  });
  unit.heading = shot.heading;
  unit.triggered = false;
  // Underwater, it's safe from a missile chasing it (spec 06).
  if (shot.chased !== null && !underwater) chaseLanded(s, shot, unit);
  if (underwater) ctx.emit({ type: 'splash', x: landing.x, y: landing.y, z: 0 });
  ctx.emit({ type: 'built', unit: unit.id, kind: 'rover', owner: unit.owner, heading: unit.heading });
  return undefined;
}

const sq = (v) => v * v;

// The Rovers that drive at this round's end: the working ones, oldest
// first.
export function roversToDrive(state) {
  return state.units.filter((u) => u.kind === 'rover' && isWorking(state, u) && !u.triggered).map((u) => u.id);
}

// Starts the next Rover's drive. Returns false if none is left.
export function nextDrive(state) {
  while (state.roverQueue.length > 0) {
    const rover = findUnit(state, state.roverQueue.shift());
    // A Rover destroyed or disabled during another's drive is skipped.
    if (!rover || !isWorking(state, rover) || rover.triggered) continue;
    state.drive = { rover: rover.id, owner: rover.owner, x: rover.x, y: rover.y, d: 0, done: false };
    return true;
  }
  state.drive = null;
  return false;
}

// One tick of the Rover that's driving.
export function stepDrive(ctx) {
  const { game } = ctx;
  const s = game.state;
  const drive = s.drive;
  if (!drive || drive.done) return;
  const rover = findUnit(s, drive.rover);
  if (!rover || rover.triggered) {
    drive.done = true;
    return;
  }
  const size = game.map.size;
  if (drive.d === 0) ctx.emit({ type: 'roverDrives', unit: rover.id });
  const step = divRound(ROVER_DRIVE, ROVER_DRIVE_TICKS * ROVER_SUBSTEPS);
  const cos = cosDeg(rover.heading);
  const sin = sinDeg(rover.heading);
  for (let k = 0; k < ROVER_SUBSTEPS; k++) {
    if (drive.d >= ROVER_DRIVE) {
      drive.done = true;
      return;
    }
    const d = Math.min(ROVER_DRIVE, drive.d + step);
    // Always worked out from the drive's start, so it keeps exactly to
    // its heading.
    const x = wrap(drive.x + mulFrac(d, cos), size);
    const y = wrap(drive.y + mulFrac(d, sin), size);
    if (react(ctx, rover, x, y, cos, sin)) {
      drive.done = true;
      return;
    }
    moveTo(ctx, rover, x, y);
    drive.d = d;
  }
}

// What the Rover meets at (x, y), checked in spec 07's order. Returns
// true if its drive ends there; it has then stopped where it is.
function react(ctx, rover, x, y, cos, sin) {
  const { game } = ctx;
  const s = game.state;
  const size = game.map.size;
  const side = game.sides[rover.owner];
  const credit = rover.owner;
  const near = (u) => u !== rover && counts(u) && groundGap(size, x, y, u) <= ROVER_REACH;

  // 1. An enemy unit: it explodes where it first comes within reach.
  if (s.units.some((u) => near(u) && game.sides[u.owner] !== side)) {
    moveTo(ctx, rover, x, y);
    return trigger(ctx, rover, ROVER_UNIT_PAUSE, credit);
  }
  // 2. One of its own side's units ahead: it stops just short.
  const ahead = (u) => {
    const dx = delta(x, u.x, size);
    const dy = delta(y, u.y, size);
    const along = divRound(cos * dx + sin * dy, ONE);
    return along > 0 && 2 * along * along >= dx * dx + dy * dy;
  };
  if (s.units.some((u) => near(u) && game.sides[u.owner] === side && ahead(u))) {
    ctx.emit({ type: 'roverStopped', unit: rover.id });
    return true;
  }
  // 3. A conduit node.
  for (const c of s.conduits) {
    const hit = c.nodes.some((n) => !isGone(s, n) && sq(delta(x, n.x, size)) + sq(delta(y, n.y, size)) <= sq(ROVER_NODE_REACH));
    if (!hit) continue;
    if (game.sides[c.owner] === side) {
      ctx.emit({ type: 'roverStopped', unit: rover.id });
      return true;
    }
    moveTo(ctx, rover, x, y);
    return trigger(ctx, rover, ROVER_CONDUIT_PAUSE, credit);
  }
  // 4. An armed Charge: it goes off, and its blast destroys the Rover.
  // Measured the way the blast reaches, so the Rover is always in it
  // (decision D36).
  const ground = ctx.terrain(x, y);
  const there = { ...rover, x, y, base: ground.type === WET ? -ROVER_UNDERWATER : ground.alt };
  const charge = nearest(s.units.filter((u) => isArmedCharge(s, u)), (u) => {
    const p = blastPoint(u);
    const g = gap3(size, p.x, p.y, p.z, there);
    return g <= CHARGE_BLAST.radius ? g : null;
  });
  if (charge) {
    moveTo(ctx, rover, x, y);
    setOff(ctx, charge, credit);
    return true;
  }
  return false;
}

// The Rover stops, and after a pause is destroyed and explodes at that
// moment (decision D13).
function trigger(ctx, rover, pause, credit) {
  const s = ctx.game.state;
  rover.triggered = true;
  ctx.emit({ type: 'roverTriggered', unit: rover.id });
  scheduleBlast(s, rover, { ...ROVER_BLAST, delay: pause }, credit);
  return true;
}

// Puts the Rover on the ground at (x, y), or on the bottom under water.
function moveTo(ctx, rover, x, y) {
  const { game } = ctx;
  const size = game.map.size;
  const ground = ctx.terrain(x, y);
  const wasUnder = rover.base < 0;
  const under = ground.type === WET;
  // A sound as it passes the edge of an enemy dome.
  for (const b of enemyDomes(game, game.sides[rover.owner])) {
    if (insideDome(b, rover.x, rover.y, rover.base, size) !== insideDome(b, x, y, under ? 0 : ground.alt, size)) {
      ctx.emit({ type: 'roverDome', unit: rover.id, barrier: b.id });
    }
  }
  rover.x = x;
  rover.y = y;
  rover.base = under ? -ROVER_UNDERWATER : ground.alt;
  if (under !== wasUnder) ctx.emit({ type: 'splash', x, y, z: 0, unit: rover.id });
}

export const ROVER_HEIGHT = UNIT_KINDS.rover.height;
