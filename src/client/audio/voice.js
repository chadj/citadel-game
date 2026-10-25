// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The aide's voice (spec 11, The aide; decision D50). Each faction's
// aide has its own voice: the browser's own speech, with a pitch, a
// speed and, where the system has several voices, a voice of its own.
// A recording listed in AIDE_FILES speaks a line instead.

import { AIDE_FILES } from './sounds.js';

const PROFILES = [
  { slug: 'meridian', pitch: 1.25, rate: 1.05, pick: 0 },
  { slug: 'ostrevan', pitch: 0.85, rate: 0.95, pick: 1 },
  { slug: 'deepbore', pitch: 0.7, rate: 0.92, pick: 2 },
  { slug: 'ruuk', pitch: 0.55, rate: 0.88, pick: 3 }, // a warrior's: low and gruff
];

export class AideVoice {
  constructor(engine, prefs) {
    this.engine = engine;
    this.prefs = prefs;
    this.speech = globalThis.speechSynthesis ?? null;
    this.playing = 0; // recordings playing
  }

  get busy() {
    return this.playing > 0 || !!this.speech?.speaking || !!this.speech?.pending;
  }

  // Says a line from core/aide.js, in `faction`'s voice.
  say(line, faction) {
    const profile = PROFILES[faction] ?? PROFILES[0];
    const file = AIDE_FILES[line.id.replace(/^aide\./, `aide.${profile.slug}.`)];
    if (file) {
      this.playFile(file);
      return;
    }
    if (!this.speech) return;
    const v = (this.prefs.volumes.aide ?? 0) / 100;
    if (v <= 0) return;
    const u = new SpeechSynthesisUtterance(line.text);
    u.volume = v * v;
    u.pitch = profile.pitch;
    u.rate = profile.rate;
    const voice = this.voiceFor(profile);
    if (voice) u.voice = voice;
    this.speech.speak(u);
  }

  // The system's English voices, one for each faction where there are
  // enough.
  voiceFor(profile) {
    const voices = this.speech.getVoices().filter((x) => /^en/i.test(x.lang));
    if (voices.length === 0) return null;
    const local = voices.filter((x) => x.localService);
    const pool = local.length > 0 ? local : voices;
    return pool[profile.pick % pool.length];
  }

  playFile(url) {
    const ctx = this.engine.ctx;
    if (!this.engine.running) return;
    this.playing++;
    this.engine.load(url).then((buffer) => {
      if (!buffer) {
        this.playing--;
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.engine.bus('aide'));
      src.onended = () => this.playing--;
      src.start();
    });
  }

  stop() {
    this.speech?.cancel();
  }
}
