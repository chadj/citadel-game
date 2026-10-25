// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Which sounds the game's events make, and where they're heard from
// (spec 11, Where effects are heard, The effects; decision D49).
//
// A cue is { sound, at, follow, gain }: a sound by name (see
// audio/sounds.js), the point it comes from in position units, what it
// moves with, if anything ({ shot }, { missile } or { unit }), and a
// gain from 0 to 1 for sounds that fade.

import { PX } from '../../rules/constants.js';

// Effects fade out about 1,300 px away (spec 11).
export const HEAR_PX = 1300;
// Full pan this far to the side of the view.
const PAN_PX = 700;
const PAN_MAX = 0.85;

// How loud a sound is, and where it leans, for a listener at the middle
// of the view. Distances go the short way around the map. A sound in
// the fog plays at half volume, from the middle (spec 11).
export function placeSound(listener, at, size, visible) {
  if (!visible) return { gain: 0.5, pan: 0 };
  const short = (d) => {
    const r = ((d % size) + size) % size;
    return r > size / 2 ? r - size : r;
  };
  const dx = short(at.x - listener.x) / PX;
  const dy = short(at.y - listener.y) / PX;
  const d = Math.hypot(dx, dy);
  const near = Math.max(0, 1 - d / HEAR_PX);
  return { gain: near * near, pan: Math.max(-PAN_MAX, Math.min(PAN_MAX, (dx / PAN_PX) * PAN_MAX)) };
}

const BLAST_SOUNDS = [[100, 'blast.charge'], [160, 'blast.extractor'], [Infinity, 'blast.rover']];
const LANDING = Object.freeze({
  outpost: 'land.heavy', battery: 'land.heavy', extractor: 'land.heavy', barrier: 'land.medium',
  interceptor: 'land.medium', spire: 'land.medium', charge: 'land.light', rover: 'land.light',
});

// The cues for one rules event. `look` finds things the event names:
//   where(e)       the point the event happened at, or null
//   shotFrom(id)   the newest shot from a launcher, or null
//   kindOf(id)     a launcher's kind
//   wet(at)        whether a point is on water
export function cuesFor(e, look) {
  const at = look.where(e);
  if (!at) return [];
  const cue = (sound, more = {}) => ({ sound, at, follow: null, gain: 1, ...more });
  switch (e.type) {
    case 'launch': {
      const shot = look.shotFrom(e.launcher);
      return [cue(look.kindOf(e.launcher) === 'battery' ? 'launch.battery' : 'launch.outpost', { follow: shot === null ? null : { shot } })];
    }
    case 'seekerLocked':
      return [cue('seeker.lock', { follow: { shot: e.shot } })];
    case 'explosion': {
      const r = e.radius / PX;
      return [cue(r < 25 ? 'explosion.small' : r < 35 ? 'explosion.medium' : 'explosion.large')];
    }
    case 'blast':
      return [cue(BLAST_SOUNDS.find(([r]) => e.radius / PX < r)[1])];
    case 'destroy':
      // Salvaged units go quietly; ones that blast are heard in their
      // blast; a Pontoon's sinking splashes.
      if (e.how === 'salvaged') return [];
      if (e.how === 'sunk') return [cue('splash.heavy')];
      if (e.how === 'destroyed' && look.blasts?.(e)) return [];
      return [cue(e.kind === 'outpost' || e.kind === 'battery' || e.kind === 'extractor' ? 'destroy.large' : 'destroy.small')];
    case 'built':
      if (e.kind === 'skyProbe') return [cue('probe.stop')];
      if (e.kind === 'pontoon') return [cue('splash.medium')];
      return [cue(LANDING[e.kind] ?? 'land.medium')];
    case 'nodeSettled':
      return [cue(e.broke ? 'node.break' : 'node.tap', { gain: 0.6 })];
    case 'splash':
      return [cue(e.unit !== undefined || e.item === 'rover' ? 'splash.heavy' : e.item === 'scatter' ? 'splash.light' : 'splash.medium')];
    case 'lost':
    case 'pontoonLost':
      return [cue(look.wet(at) ? 'splash.light' : 'fizzle')];
    case 'buildingFailed':
      return [cue(e.reason === 'water' || look.wet(at) ? 'splash.heavy' : e.reason === 'caught' ? 'missile.hit' : 'destroy.small')];
    case 'domeFlicker':
      return [cue('dome.hit')];
    case 'roverDome':
      return [cue('rover.dome')];
    case 'roverDrives':
      return [cue('rover.drive', { follow: { unit: e.unit } })];
    case 'roverTriggered':
    case 'chargeSetOff':
      return [cue('warn.trigger')];
    case 'pulseLanded':
      return [cue('pulse.charge')];
    case 'pulse':
      return [cue('pulse.burst')];
    case 'surge':
      return [cue('surge.hit')];
    case 'surgeNode':
      // Weaker as its damage fades (spec 11).
      return [cue('surge.crackle', { gain: Math.max(0.15, Math.min(1, e.strength / 30)) })];
    case 'surgeEnd':
      return [cue('surge.hit', { gain: 0.6 })];
    case 'infected':
      return [cue('worm.infect', { gain: e.spread ? 0.6 : 1 })];
    case 'repairLanded':
      return [cue('repair.land')];
    case 'repair':
      return [cue('repair.work')];
    case 'salvagerLanded':
      return [cue('salvage.land')];
    case 'salvage':
      return [cue('salvage.work')];
    case 'interceptorFired':
      return [cue('interceptor.fire'), cue('missile.fly', { follow: { missile: e.missile } })];
    case 'missileMiss':
    case 'missileStopped':
      return [cue('missile.miss')];
    case 'missileHit':
    case 'caught':
      return [cue('missile.hit')];
    case 'disabled':
      return [cue('unit.disabled', { gain: 0.7 })];
    case 'barrierUp':
      return [cue('barrier.up')];
    case 'nodeBurnt':
      return [cue('conduit.burn', { gain: 0.5 })];
    default:
      return [];
  }
}

// The interface sounds for an event, for the player whose screen it is
// (spec 11: the turn and clock sounds are heard only by the player
// they're for). `viewer` is that player.
export function interfaceCues(e, viewer) {
  switch (e.type) {
    case 'turnStart':
      return e.player === viewer ? [] : ['ui.turn'];
    case 'clockWarning':
      return e.player === viewer ? ['ui.clockWarning'] : [];
    case 'timeUp':
      return e.player === viewer ? ['ui.buzzer'] : [];
    case 'chat':
      return ['ui.chat'];
    default:
      return [];
  }
}
