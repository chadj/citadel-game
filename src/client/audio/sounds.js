// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Every sound the game asks for, by name (decision D49). The game only
// ever asks for a name; this table says where each one comes from:
//   { synth: 'recipe' }  made in the browser (audio/synth.js)
//   { files: [...] }     recorded files, one picked at random each time
// plus the bus it plays on, the shortest gap between two of it in ms,
// and `loop` for sounds that run until they're stopped.
//
// To swap in a recording, change an entry's `synth` to `files` and log
// the file in ASSETS.md. Music slots are listed in audio/music.js.

const fx = (synth, more = {}) => ({ synth, bus: 'effects', gap: 40, ...more });
const ui = (synth, more = {}) => ({ synth, bus: 'ui', gap: 30, ...more });

export const SOUNDS = Object.freeze({
  'launch.outpost': fx('launchOutpost'),
  'launch.battery': fx('launchBattery'),
  'seeker.lock': fx('seekerLock', { loop: true }),
  'explosion.small': fx('explosionSmall'),
  'explosion.medium': fx('explosionMedium'),
  'explosion.large': fx('explosionLarge'),
  'blast.charge': fx('blastCharge'),
  'blast.extractor': fx('blastExtractor'),
  'blast.rover': fx('blastRover'),
  'destroy.large': fx('destroyLarge'),
  'destroy.small': fx('destroySmall'),
  'land.heavy': fx('landHeavy'),
  'land.medium': fx('landMedium'),
  'land.light': fx('landLight'),
  'probe.stop': fx('probeStop'),
  'splash.light': fx('splashLight'),
  'splash.medium': fx('splashMedium'),
  'splash.heavy': fx('splashHeavy'),
  'node.tap': fx('nodeTap', { gap: 25 }),
  'node.break': fx('nodeBreak'),
  fizzle: fx('fizzle'),
  'dome.hit': fx('domeHit'),
  'rover.dome': fx('roverDome'),
  'rover.drive': fx('roverDrive', { loop: true }),
  'warn.trigger': fx('warnTrigger'),
  'pulse.charge': fx('pulseCharge'),
  'pulse.burst': fx('pulseBurst'),
  'surge.hit': fx('surgeHit'),
  'surge.crackle': fx('surgeCrackle', { gap: 60 }),
  'worm.infect': fx('wormInfect'),
  'repair.land': fx('toolLand'),
  'repair.work': fx('repairWork', { gap: 120 }),
  'salvage.land': fx('toolLand'),
  'salvage.work': fx('salvageWork', { gap: 120 }),
  'interceptor.fire': fx('interceptorFire'),
  'missile.fly': fx('missileFly', { loop: true }),
  'missile.miss': fx('missileMiss'),
  'missile.hit': fx('missileHit'),
  'unit.disabled': fx('unitDisabled'),
  'barrier.up': fx('barrierUp'),
  'conduit.burn': fx('conduitBurn', { gap: 80 }),

  'ui.hover': ui('uiHover', { gap: 50 }),
  'ui.click': ui('uiClick'),
  'ui.launchPress': ui('uiLaunchPress'),
  'ui.turn': ui('uiTurn'),
  'ui.clockWarning': ui('uiClockWarning'),
  'ui.buzzer': ui('uiBuzzer'),
  'ui.chat': ui('uiChat'),
});

// The sample each volume slider plays when it's let go (spec 11).
export const SLIDER_SAMPLES = Object.freeze({
  effects: 'explosion.medium',
  music: 'music.sample',
  aide: 'aide.sample',
  ui: 'ui.click',
});

// Recordings of the aide's lines, by `aide.<faction>.<event>.<n>`
// (see core/aide.js), each a file path. Lines with no recording are
// spoken by the browser's own voice.
export const AIDE_FILES = Object.freeze({});
