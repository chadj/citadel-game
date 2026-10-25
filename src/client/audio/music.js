// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The music (spec 11, The music, Other music; decision D51). It's made
// a bar at a time, just before the bar plays, so changes of intensity
// and mood always fall on a bar's start.
//
// Songs: 'menu', 'game', 'victory' and 'defeat'. The game song has four
// layers, added as the intensity rises (0 pad, 1 bass, 2 arpeggio,
// 3 drums), and a chord progression for each mood.
//
// Any part can be a recording instead. A slot is named
//   music.menu, music.victory, music.defeat,
//   music.game.<intensity>.<mood>   (e.g. music.game.2.dark)
// and listed in MUSIC_FILES with its tempo and length in bars. A slot
// with a file plays the file, starting on a bar; a slot without one is
// made here.

export const MUSIC_FILES = Object.freeze({
  // 'music.menu': { file: 'assets/music/menu.ogg', bpm: 88, bars: 8 },
});

const BPM = 88;
const BAR = (4 * 60) / BPM; // s
const STEP = BAR / 16;
const AHEAD = 0.35; // s: a bar is made this long before it starts
const TICK_MS = 50;

// Chords as MIDI notes, root first.
const PROGRESSIONS = {
  menu: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  upbeat: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
  neutral: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]],
  dark: [[48, 51, 55], [44, 48, 51], [53, 56, 60], [55, 59, 62]],
};
// The endings: a few bars, then the menu song returns.
const ENDINGS = {
  victory: [[[48, 52, 55, 60], 'up'], [[53, 57, 60, 65], 'up'], [[55, 59, 62, 67], 'up'], [[60, 64, 67, 72], 'hold']],
  defeat: [[[57, 60, 64], 'down'], [[53, 56, 60], 'down'], [[52, 55, 59], 'down'], [[45, 48, 52], 'hold']],
};

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  constructor(engine) {
    this.engine = engine;
    this.song = null;
    this.state = { intensity: 0, tone: 'neutral' };
    this.bar = 0;
    this.next = 0; // when the next bar starts
    this.out = null;
    this.timer = null;
  }

  get ctx() {
    return this.engine.ctx;
  }

  // Starts a song, unless it's already playing. `then` is the song
  // that follows an ending.
  play(song, { then = 'menu' } = {}) {
    if (!this.ctx || this.song === song) return;
    if (this.fading) {
      this.fading.next = song;
      return;
    }
    this.stopNow();
    this.song = song;
    this.after = then;
    this.bar = 0;
    this.out = this.ctx.createGain();
    this.out.connect(this.engine.bus('music'));
    this.next = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  // What the game song follows (core/mood.js).
  setState(intensity, tone) {
    this.state = { intensity, tone };
  }

  // Fades out over `ms`, then starts `then`, if given.
  fadeOut(ms = 1000, then = null) {
    if (!this.out) {
      if (then) this.play(then);
      return;
    }
    const t = this.engine.now;
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + ms / 1000);
    clearInterval(this.timer);
    this.timer = null;
    const out = this.out;
    this.out = null;
    this.song = null;
    const fading = { next: then };
    this.fading = fading;
    setTimeout(() => {
      out.disconnect();
      if (this.fading !== fading) return;
      this.fading = null;
      if (fading.next) this.play(fading.next);
    }, ms + 50);
  }

  stopNow() {
    this.fading = null;
    clearInterval(this.timer);
    this.timer = null;
    this.out?.disconnect();
    this.out = null;
    this.song = null;
  }

  tick() {
    if (!this.engine.running || !this.out) return;
    const now = this.engine.now;
    if (this.next < now) this.next = now + 0.05;
    while (this.next - now < AHEAD && this.out) {
      const length = this.makeBar(this.next);
      this.next += length;
      this.bar++;
    }
  }

  // Makes the bar starting at `t`. Returns how long it is, in seconds.
  makeBar(t) {
    const song = this.song;
    if (song === 'victory' || song === 'defeat') {
      const ending = ENDINGS[song];
      if (this.bar >= ending.length) {
        const then = this.after;
        this.stopLater(t, then);
        return BAR * 2;
      }
    }
    const slot = this.slot();
    const file = MUSIC_FILES[slot];
    if (file) {
      const buffer = this.engine.buffers.get(file.file);
      if (buffer && !(buffer instanceof Promise)) {
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.out);
        src.start(t);
        return ((4 * 60) / file.bpm) * file.bars;
      }
      this.engine.load(file.file);
    }
    if (song === 'menu') this.menuBar(t);
    else if (song === 'game') this.gameBar(t);
    else this.endingBar(t, ENDINGS[song][this.bar]);
    return BAR;
  }

  slot() {
    if (this.song === 'game') return `music.game.${this.state.intensity}.${this.state.tone}`;
    return `music.${this.song}`;
  }

  stopLater(t, then) {
    const wait = Math.max(0, (t - this.engine.now) * 1000);
    const out = this.out;
    clearInterval(this.timer);
    this.timer = null;
    setTimeout(() => {
      if (this.out !== out) return;
      this.stopNow();
      if (then) this.play(then);
    }, wait);
  }

  // The parts ---------------------------------------------------------

  note(type, midi, at, dur, gain, { attack = 0.01, cutoff = 0, detune = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz(midi);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = o;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.frequency.value = cutoff;
      node = o.connect(f);
    }
    node.connect(g).connect(this.out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  pad(t, chord, gain = 0.05) {
    for (const m of chord) {
      for (const d of [-7, 7]) this.note('sawtooth', m, t, BAR * 1.05, gain, { attack: 0.6, cutoff: 900, detune: d });
    }
  }

  hit(t, { f, dur, gain, filter = 'lowpass' }) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise ??= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const fl = ctx.createBiquadFilter();
    fl.type = filter;
    fl.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(fl).connect(g).connect(this.out);
    n.start(t);
    n.stop(t + dur + 0.05);
  }

  menuBar(t) {
    const chord = PROGRESSIONS.menu[this.bar % 4];
    this.pad(t, chord, 0.045);
    // A slow, sparse arpeggio.
    [0, 6, 10].forEach((s, i) => this.note('triangle', chord[i] + 12, t + s * STEP, STEP * 5, 0.05, { attack: 0.02 }));
  }

  gameBar(t) {
    const { intensity, tone } = this.state;
    const chord = PROGRESSIONS[tone][this.bar % 4];
    this.pad(t, chord, intensity >= 2 ? 0.035 : 0.045);
    if (intensity >= 1) {
      const pattern = intensity >= 3 ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 8, 14];
      for (const s of pattern) this.note('triangle', chord[0] - 12, t + s * STEP, STEP * 1.8, 0.16, { attack: 0.005 });
    }
    if (intensity >= 2) {
      const up = [0, 1, 2, 1];
      for (let s = 0; s < 16; s++) {
        const m = chord[up[s % 4]] + (s >= 8 ? 24 : 12);
        this.note('square', m, t + s * STEP, STEP * 0.9, 0.025, { cutoff: 2400 });
      }
    }
    if (intensity >= 3) {
      for (const s of [0, 8]) this.note('sine', 36, t + s * STEP, 0.25, 0.4, { attack: 0.002 });
      for (const s of [4, 12]) this.hit(t + s * STEP, { f: 1800, dur: 0.15, gain: 0.18 });
      for (let s = 0; s < 16; s += 2) this.hit(t + s * STEP, { f: 7000, dur: 0.04, gain: 0.05, filter: 'highpass' });
    }
  }

  endingBar(t, [chord, shape]) {
    this.pad(t, chord, 0.05);
    if (shape === 'hold') {
      for (const m of chord) this.note('triangle', m + 12, t, BAR * 1.6, 0.07, { attack: 0.02 });
      return;
    }
    const notes = shape === 'up' ? chord : [...chord].reverse();
    notes.forEach((m, i) => this.note('triangle', m + 12, t + i * STEP * 3, STEP * 4, 0.08, { attack: 0.01 }));
  }

  // A short sample at the music's volume, for its slider.
  sample() {
    if (!this.engine.running) return;
    const was = this.out;
    if (was) return; // the music is already playing: that's the sample
    this.out = this.ctx.createGain();
    this.out.connect(this.engine.bus('music'));
    this.pad(this.engine.now + 0.02, PROGRESSIONS.menu[0], 0.06);
    const out = this.out;
    this.out = null;
    setTimeout(() => out.disconnect(), BAR * 1200);
  }
}
