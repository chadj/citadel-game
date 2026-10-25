// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game's own sounds, made with the Web Audio API (decision D49).
// Each recipe gets a kit that plays into one voice, and a `rate` near 1
// that every pitch is scaled by, so a sound that repeats varies. It
// returns how long it lasts in seconds; a looping recipe plays until
// the voice is stopped.

const noiseBuffers = new WeakMap();

function noiseBuffer(ctx) {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
}

// The building blocks. `sources` collects everything started, so the
// voice can stop it all.
export function kit(ctx, out, t0, rate) {
  const sources = [];
  const env = (g, s, dur, peak, attack) => {
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(peak, s + attack);
    if (Number.isFinite(dur)) g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  };
  const start = (src, s, dur) => {
    src.start(s);
    if (Number.isFinite(dur)) src.stop(s + dur + 0.05);
    sources.push(src);
  };
  return {
    ctx,
    sources,
    rate,
    // An oscillator, gliding from `f` to `to`.
    tone({ type = 'sine', f, to = null, at = 0, dur = Infinity, attack = 0.005, gain = 0.4, dest = out }) {
      const s = t0 + at;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * rate, s);
      if (to !== null && Number.isFinite(dur)) o.frequency.exponentialRampToValueAtTime(to * rate, s + dur);
      const g = ctx.createGain();
      env(g, s, dur, gain, attack);
      o.connect(g).connect(dest);
      start(o, s, dur);
      return { osc: o, gain: g };
    },
    // Filtered noise, its filter sweeping from `f` to `to`.
    noise({ filter = 'lowpass', f = 2000, to = null, q = 1, at = 0, dur = Infinity, attack = 0.005, gain = 0.4, dest = out }) {
      const s = t0 + at;
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx);
      n.loop = true;
      n.playbackRate.value = rate;
      const fl = ctx.createBiquadFilter();
      fl.type = filter;
      fl.Q.value = q;
      fl.frequency.setValueAtTime(f * rate, s);
      if (to !== null && Number.isFinite(dur)) fl.frequency.exponentialRampToValueAtTime(to * rate, s + dur);
      const g = ctx.createGain();
      env(g, s, dur, gain, attack);
      n.connect(fl).connect(g).connect(dest);
      start(n, s, dur);
      return { src: n, filter: fl, gain: g };
    },
    // A slow wobble on an AudioParam.
    wobble(param, hz, depth, type = 'sine') {
      const l = ctx.createOscillator();
      l.type = type;
      l.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = depth;
      l.connect(g).connect(param);
      start(l, t0, Infinity);
    },
  };
}

const boom = (k, f, dur, gain = 0.7) => k.tone({ f, to: f * 0.35, dur, gain });

export const RECIPES = {
  // Launches
  launchOutpost(k) {
    boom(k, 120, 0.3, 0.6);
    k.noise({ f: 1400, to: 200, dur: 0.45, gain: 0.45 });
    k.noise({ filter: 'bandpass', f: 700, to: 2600, q: 2, at: 0.05, dur: 1.2, attack: 0.3, gain: 0.12 });
    return 1.3;
  },
  launchBattery(k) {
    for (const at of [0, 0.07]) {
      k.tone({ type: 'triangle', f: 240, to: 70, at, dur: 0.14, gain: 0.45 });
      k.noise({ filter: 'bandpass', f: 2400, to: 900, q: 1.5, at, dur: 0.22, gain: 0.35 });
    }
    k.noise({ filter: 'bandpass', f: 1200, to: 3200, q: 2, at: 0.1, dur: 0.9, attack: 0.2, gain: 0.1 });
    return 1;
  },
  seekerLock(k) {
    const { gain } = k.tone({ type: 'square', f: 1300, gain: 0.07 });
    k.wobble(gain.gain, 7, 0.07, 'square');
  },

  // Explosions
  explosionSmall(k) {
    boom(k, 90, 0.35, 0.6);
    k.noise({ f: 2200, to: 150, dur: 0.5, gain: 0.55 });
    return 0.55;
  },
  explosionMedium(k) {
    boom(k, 75, 0.6, 0.75);
    k.noise({ f: 1600, to: 110, dur: 0.9, gain: 0.65 });
    return 0.95;
  },
  explosionLarge(k) {
    boom(k, 60, 1.1, 0.9);
    k.noise({ f: 1200, to: 70, dur: 1.6, gain: 0.75 });
    k.noise({ filter: 'bandpass', f: 400, to: 90, q: 0.8, at: 0.1, dur: 1.3, gain: 0.3 });
    return 1.7;
  },
  blastCharge(k) {
    k.noise({ filter: 'highpass', f: 3000, dur: 0.15, gain: 0.5 });
    k.tone({ type: 'square', f: 620, to: 300, dur: 0.18, gain: 0.12 });
    RECIPES.explosionSmall(k);
    return 0.6;
  },
  blastExtractor(k) {
    RECIPES.explosionLarge(k);
    k.noise({ filter: 'bandpass', f: 400, to: 3600, q: 3, dur: 0.9, attack: 0.05, gain: 0.25 });
    k.tone({ type: 'sawtooth', f: 180, to: 900, dur: 0.6, gain: 0.08 });
    return 1.7;
  },
  blastRover(k) {
    RECIPES.explosionMedium(k);
    for (const at of [0.12, 0.25, 0.34, 0.5, 0.63]) {
      k.noise({ filter: 'bandpass', f: 1800 + at * 2000, q: 4, at, dur: 0.07, gain: 0.3 });
    }
    return 1;
  },

  // Destruction without a blast
  destroyLarge(k) {
    k.noise({ f: 900, to: 120, dur: 0.75, gain: 0.55 });
    k.tone({ type: 'sawtooth', f: 90, to: 40, dur: 0.5, gain: 0.12 });
    for (const at of [0.1, 0.22, 0.4]) k.noise({ filter: 'bandpass', f: 700, q: 5, at, dur: 0.08, gain: 0.25 });
    return 0.8;
  },
  destroySmall(k) {
    k.noise({ f: 1500, to: 200, dur: 0.35, gain: 0.45 });
    k.tone({ type: 'triangle', f: 210, to: 80, dur: 0.22, gain: 0.25 });
    return 0.4;
  },

  // Landings and water
  landHeavy(k) {
    boom(k, 95, 0.35, 0.7);
    k.noise({ f: 450, dur: 0.22, gain: 0.35 });
    return 0.4;
  },
  landMedium(k) {
    boom(k, 140, 0.25, 0.55);
    k.noise({ f: 700, dur: 0.15, gain: 0.25 });
    return 0.3;
  },
  landLight(k) {
    boom(k, 210, 0.15, 0.4);
    k.noise({ f: 1100, dur: 0.08, gain: 0.18 });
    return 0.2;
  },
  probeStop(k) {
    k.tone({ f: 900, to: 1800, dur: 0.12, gain: 0.2 });
    k.tone({ f: 1800, at: 0.12, dur: 0.45, gain: 0.18 });
    return 0.6;
  },
  splashLight(k) {
    k.noise({ filter: 'bandpass', f: 2600, to: 1200, q: 1.2, dur: 0.3, gain: 0.3 });
    return 0.35;
  },
  splashMedium(k) {
    k.tone({ f: 320, to: 120, dur: 0.1, gain: 0.3 });
    k.noise({ f: 3200, to: 500, dur: 0.6, attack: 0.02, gain: 0.45 });
    return 0.65;
  },
  splashHeavy(k) {
    boom(k, 75, 0.4, 0.6);
    k.noise({ f: 2200, to: 280, dur: 1, attack: 0.03, gain: 0.6 });
    k.noise({ filter: 'bandpass', f: 1800, to: 700, q: 1, at: 0.3, dur: 0.7, gain: 0.2 });
    return 1.05;
  },
  nodeTap(k) {
    k.tone({ type: 'triangle', f: 1800, dur: 0.05, gain: 0.2 });
    return 0.08;
  },
  nodeBreak(k) {
    k.noise({ filter: 'highpass', f: 4000, dur: 0.08, gain: 0.3 });
    k.tone({ type: 'triangle', f: 1300, to: 600, dur: 0.12, gain: 0.2 });
    return 0.15;
  },
  fizzle(k) {
    k.noise({ filter: 'highpass', f: 5000, to: 2000, dur: 0.5, gain: 0.15 });
    return 0.55;
  },

  // Defenses
  domeHit(k) {
    k.tone({ f: 500, dur: 0.6, gain: 0.25 });
    k.tone({ f: 507, dur: 0.6, gain: 0.25 });
    k.tone({ type: 'sawtooth', f: 250, to: 180, dur: 0.3, gain: 0.06 });
    return 0.65;
  },
  roverDome(k) {
    [700, 900, 700].forEach((f, i) => k.tone({ type: 'square', f, at: i * 0.14, dur: 0.11, gain: 0.12 }));
    return 0.45;
  },
  roverDrive(k) {
    const { osc } = k.tone({ type: 'sawtooth', f: 55, gain: 0.12 });
    k.wobble(osc.frequency, 8, 6);
    k.noise({ f: 300, gain: 0.08 });
  },
  warnTrigger(k) {
    for (const at of [0, 0.15]) k.tone({ type: 'square', f: 1000, at, dur: 0.1, gain: 0.14 });
    return 0.3;
  },
  interceptorFire(k) {
    k.noise({ filter: 'bandpass', f: 3000, to: 1200, q: 1, dur: 0.18, gain: 0.4 });
    k.tone({ type: 'triangle', f: 900, to: 300, dur: 0.12, gain: 0.25 });
    return 0.2;
  },
  missileFly(k) {
    k.noise({ filter: 'bandpass', f: 1800, q: 3, gain: 0.12 });
    k.tone({ f: 1100, gain: 0.03 });
  },
  missileMiss(k) {
    k.tone({ f: 800, to: 300, dur: 0.35, gain: 0.12 });
    k.noise({ filter: 'highpass', f: 2500, dur: 0.25, gain: 0.12 });
    return 0.4;
  },
  missileHit(k) {
    k.noise({ filter: 'highpass', f: 2500, dur: 0.06, gain: 0.4 });
    k.noise({ f: 2500, to: 300, dur: 0.35, gain: 0.45 });
    return 0.4;
  },
  barrierUp(k) {
    k.tone({ f: 200, to: 600, dur: 0.5, attack: 0.1, gain: 0.2 });
    k.tone({ f: 302, to: 905, dur: 0.5, attack: 0.1, gain: 0.12 });
    return 0.55;
  },
  unitDisabled(k) {
    k.tone({ type: 'triangle', f: 420, to: 70, dur: 0.75, gain: 0.25 });
    k.noise({ f: 900, dur: 0.2, gain: 0.2 });
    return 0.8;
  },

  // Tools and special weapons
  pulseCharge(k) {
    k.tone({ f: 200, to: 1600, dur: 1.2, attack: 0.3, gain: 0.18 });
    k.noise({ filter: 'bandpass', f: 300, to: 3000, q: 4, dur: 1.2, attack: 0.5, gain: 0.15 });
    return 1.25;
  },
  pulseBurst(k) {
    k.tone({ f: 1600, to: 90, dur: 0.6, gain: 0.35 });
    k.noise({ filter: 'highpass', f: 1500, dur: 0.3, gain: 0.3 });
    boom(k, 70, 0.6, 0.5);
    return 0.65;
  },
  surgeHit(k) {
    k.tone({ type: 'sawtooth', f: 120, to: 90, dur: 0.4, gain: 0.15 });
    RECIPES.surgeCrackle(k);
    return 0.45;
  },
  surgeCrackle(k) {
    for (let i = 0; i < 6; i++) {
      k.noise({ filter: 'highpass', f: 2500 + Math.random() * 3000, at: Math.random() * 0.25, dur: 0.03, gain: 0.3 });
    }
    return 0.3;
  },
  wormInfect(k) {
    const { osc } = k.tone({ f: 320, to: 150, dur: 0.6, gain: 0.2 });
    k.wobble(osc.frequency, 11, 25);
    k.tone({ type: 'square', f: 80, dur: 0.4, gain: 0.04 });
    return 0.65;
  },
  toolLand(k) {
    k.tone({ type: 'triangle', f: 600, to: 900, dur: 0.12, gain: 0.2 });
    RECIPES.landLight(k);
    return 0.2;
  },
  repairWork(k) {
    for (let i = 0; i < 4; i++) k.tone({ type: 'triangle', f: 1200, at: i * 0.07, dur: 0.04, gain: 0.15 });
    k.tone({ f: 700, to: 950, dur: 0.35, gain: 0.08 });
    return 0.4;
  },
  salvageWork(k) {
    k.tone({ type: 'sawtooth', f: 300, to: 150, dur: 0.4, gain: 0.08 });
    for (const at of [0.05, 0.2]) k.noise({ filter: 'bandpass', f: 900, q: 6, at, dur: 0.08, gain: 0.25 });
    return 0.45;
  },
  conduitBurn(k) {
    k.noise({ filter: 'bandpass', f: 1200, q: 1, dur: 0.3, gain: 0.2 });
    return 0.35;
  },

  // Interface
  uiHover(k) {
    k.tone({ f: 1500, dur: 0.04, gain: 0.07 });
    return 0.05;
  },
  uiClick(k) {
    k.tone({ type: 'triangle', f: 900, dur: 0.05, gain: 0.25 });
    return 0.07;
  },
  uiLaunchPress(k) {
    k.tone({ type: 'triangle', f: 480, to: 720, dur: 0.09, gain: 0.25 });
    return 0.1;
  },
  uiTurn(k) {
    k.tone({ f: 660, dur: 0.25, gain: 0.2 });
    k.tone({ f: 880, at: 0.12, dur: 0.3, gain: 0.2 });
    return 0.45;
  },
  uiClockWarning(k) {
    for (let i = 0; i < 3; i++) k.tone({ f: 1000, at: i * 0.18, dur: 0.1, gain: 0.2 });
    return 0.55;
  },
  uiBuzzer(k) {
    k.tone({ type: 'sawtooth', f: 160, dur: 0.7, attack: 0.01, gain: 0.15 });
    k.tone({ type: 'square', f: 163, dur: 0.7, attack: 0.01, gain: 0.08 });
    return 0.75;
  },
  uiChat(k) {
    k.tone({ f: 1200, to: 1500, dur: 0.08, gain: 0.15 });
    k.tone({ f: 1500, at: 0.08, dur: 0.12, gain: 0.12 });
    return 0.22;
  },
};
