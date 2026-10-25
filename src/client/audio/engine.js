// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Plays sounds by name (spec 11; decision D49). Four buses, one for
// each volume setting; a limit on how many sounds play at once; small
// changes of pitch and volume each time a sound plays; and recorded
// files, loaded the first time they're asked for.

import { SOUNDS } from './sounds.js';
import { RECIPES, kit } from './synth.js';

// Each bus's level at full volume: the music sits well under the
// effects, so the aide and the interface stay clear (spec 11).
const BUS_LEVEL = { effects: 1, music: 0.32, aide: 1, ui: 0.7 };
const VOICE_LIMIT = 12; // sounds at once, not counting music or the aide
const RATE_SPREAD = 0.06; // ±6% pitch
const GAIN_SPREAD = 0.1; // ±10% volume
const SMOOTH = 0.03; // s, for moving sounds

export class AudioEngine {
  constructor(prefs) {
    this.prefs = prefs;
    this.ctx = null;
    this.buses = {};
    this.voices = [];
    this.lastPlayed = new Map();
    this.buffers = new Map(); // url → AudioBuffer, or a Promise while loading
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.connect(this.ctx.destination);
    for (const name of Object.keys(BUS_LEVEL)) {
      const g = this.ctx.createGain();
      g.connect(comp);
      this.buses[name] = g;
    }
    this.syncVolumes();
    // Browsers only let sound start after the player does something.
    const unlock = () => {
      if (this.ctx.state !== 'running') this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) globalThis.addEventListener?.(ev, unlock, { capture: true });
  }

  get running() {
    return this.ctx?.state === 'running';
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  // Sets each bus from the volume settings.
  syncVolumes() {
    if (!this.ctx) return;
    for (const [name, level] of Object.entries(BUS_LEVEL)) {
      const v = (this.prefs.volumes[name] ?? 0) / 100;
      this.buses[name].gain.setTargetAtTime(level * v * v, this.now, 0.02);
    }
  }

  bus(name) {
    return this.buses[name];
  }

  // Plays a sound by name. Returns a handle, { place(gain, pan),
  // stop() }, or null when it isn't played.
  play(name, { gain = 1, pan = 0 } = {}) {
    const def = SOUNDS[name];
    if (!def || !this.running) return null;
    const nowMs = this.now * 1000;
    const last = this.lastPlayed.get(name);
    if (last !== undefined && nowMs - last < def.gap) return null;
    this.lastPlayed.set(name, nowMs);
    this.prune();
    if (this.voices.length >= VOICE_LIMIT) this.steal();

    const ctx = this.ctx;
    const vary = 1 + (Math.random() * 2 - 1) * GAIN_SPREAD;
    const rate = 1 + (Math.random() * 2 - 1) * RATE_SPREAD;
    const out = ctx.createGain();
    out.gain.value = gain * vary;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(this.buses[def.bus]);
    const voice = { name, out, panner, vary, sources: [], ends: Infinity, loop: !!def.loop, started: this.now };
    this.voices.push(voice);

    if (def.files) {
      const url = def.files[Math.floor(Math.random() * def.files.length)];
      this.load(url).then((buffer) => {
        if (voice.stopped || !buffer) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = voice.loop;
        src.playbackRate.value = rate;
        src.connect(out);
        src.start();
        voice.sources.push(src);
        if (!voice.loop) voice.ends = this.now + buffer.duration / rate + 0.1;
      });
    } else {
      const k = kit(ctx, out, this.now + 0.005, rate);
      const length = RECIPES[def.synth](k);
      voice.sources = k.sources;
      if (!voice.loop) voice.ends = this.now + (length ?? 1) + 0.15;
    }
    return this.handle(voice);
  }

  handle(voice) {
    return {
      get playing() {
        return !voice.stopped;
      },
      loop: voice.loop,
      place: (gain, pan) => {
        if (voice.stopped) return;
        voice.out.gain.setTargetAtTime(gain * voice.vary, this.now, SMOOTH);
        voice.panner.pan.setTargetAtTime(pan, this.now, SMOOTH);
      },
      stop: (fade = 0.08) => this.stopVoice(voice, fade),
    };
  }

  stopVoice(voice, fade = 0.08) {
    if (voice.stopped) return;
    voice.stopped = true;
    const t = this.now;
    voice.out.gain.cancelScheduledValues(t);
    voice.out.gain.setValueAtTime(voice.out.gain.value, t);
    voice.out.gain.linearRampToValueAtTime(0, t + fade);
    for (const s of voice.sources) {
      try {
        s.stop(t + fade + 0.02);
      } catch {
        // already stopped
      }
    }
    setTimeout(() => voice.panner.disconnect(), (fade + 0.1) * 1000);
    this.voices = this.voices.filter((v) => v !== voice);
  }

  // Forgets sounds that have finished.
  prune() {
    const t = this.now;
    for (const v of this.voices) {
      if (v.ends < t) {
        v.stopped = true;
        v.panner.disconnect();
      }
    }
    this.voices = this.voices.filter((v) => !v.stopped);
  }

  // Makes room: the oldest sound that isn't a loop goes first.
  steal() {
    const v = this.voices.find((x) => !x.loop) ?? this.voices[0];
    this.stopVoice(v, 0.05);
  }

  stopAll() {
    for (const v of [...this.voices]) this.stopVoice(v);
  }

  // A recorded file, loaded once.
  load(url) {
    const got = this.buffers.get(url);
    if (got) return got instanceof Promise ? got : Promise.resolve(got);
    const p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => this.ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(url, buffer);
        return buffer;
      })
      .catch(() => {
        this.buffers.delete(url);
        return null;
      });
    this.buffers.set(url, p);
    return p;
  }
}
