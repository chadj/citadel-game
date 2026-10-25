// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The aide's voice (spec 11, The aide; decision D50). Each faction's
// aide has its own voice: one of the system's English voices, chosen by
// name. A recording listed in AIDE_FILES speaks a line instead.

import { AIDE_FILES } from './sounds.js';

// Each faction's voices, best first, by the names the systems give them:
// macOS and iOS (Safari, and Chrome on a Mac), Chrome's own voices, then
// Windows. All are US English voices: two women's and two men's. A name
// matches a voice whose name starts with it, such as "Samantha
// (Enhanced)" or "Reed (English (US))". Where there aren't enough US
// voices (Windows has one woman's; Chrome's own voices have one US
// voice), other English voices of the same kind stand in.
const WOMEN = ['Karen', 'Moira', 'Tessa', 'Google UK English Female', 'Microsoft Hazel', 'Microsoft Libby',
  'Microsoft Sonia', 'Microsoft Susan'];
const MEN = ['Daniel', 'Rishi', 'Arthur', 'Google UK English Male', 'Microsoft George', 'Microsoft Ryan'];
const PROFILES = [
  {
    slug: 'ion-mercantile', // a woman's voice
    voices: ['Samantha', 'Ava', 'Allison', 'Susan', 'Nicky', 'Google US English',
      'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira'],
    others: WOMEN,
  },
  {
    slug: 'rivet-and-ash', // a man's voice
    voices: ['Alex', 'Tom', 'Aaron', 'Reed', 'Microsoft Guy', 'Microsoft Christopher', 'Microsoft David'],
    others: MEN,
  },
  {
    slug: 'toroid-drift', // a woman's voice
    voices: ['Zoe', 'Shelley', 'Sandy', 'Flo', 'Kathy', 'Microsoft Michelle', 'Microsoft Jenny', 'Microsoft Zira'],
    others: WOMEN,
  },
  {
    slug: 'crater-born', // a man's voice
    voices: ['Evan', 'Nathan', 'Eddy', 'Rocko', 'Fred', 'Microsoft Eric', 'Microsoft Roger', 'Microsoft Mark',
      'Microsoft David'],
    others: MEN,
  },
];
const RATE = 1.05;

// Novelty voices some systems include (macOS and iOS): singing, bleating,
// whispering and the like. The aide never uses them.
const NOVELTY = [
  'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged', 'Good News',
  'Hysterical', 'Jester', 'Organ', 'Pipe Organ', 'Princess', 'Superstar', 'Trinoids', 'Whisper',
  'Wobble', 'Zarvox',
];

const named = (voice, name) => voice.name === name || voice.name.startsWith(`${name} `);

// The voice for each faction, from the system's voices: the first US
// English voice on its list that's there and not taken by a faction
// before it; failing that, the first of its other English voices; then
// the first US English voice not taken (as on Android, whose voice
// names say nothing of who speaks); then any English voice not taken;
// then any English voice; or null.
export function assignVoices(all) {
  const english = all.filter((v) => /^en/i.test(v.lang) && !NOVELTY.some((n) => named(v, n)));
  const us = english.filter((v) => /^en[-_]us/i.test(v.lang));
  const taken = new Set();
  const free = (v) => !taken.has(v);
  return PROFILES.map((profile) => {
    let voice = null;
    for (const name of profile.voices) {
      voice = us.find((v) => named(v, name) && free(v)) ?? null;
      if (voice) break;
    }
    for (const name of voice ? [] : profile.others) {
      voice = english.find((v) => named(v, name) && free(v)) ?? null;
      if (voice) break;
    }
    voice ??= us.find(free) ?? english.find(free) ?? english[0] ?? null;
    if (voice) taken.add(voice);
    return voice;
  });
}

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
    u.rate = RATE;
    const voice = this.voiceFor(faction);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    this.speech.speak(u);
  }

  // The faction's voice. The system's list can arrive late, so the
  // choice is made again whenever it changes.
  voiceFor(faction) {
    const all = this.speech.getVoices();
    if (all !== this.voiceList || all.length !== this.voiceCount) {
      this.voiceList = all;
      this.voiceCount = all.length;
      this.voices = assignVoices(all);
    }
    return this.voices[faction] ?? this.voices[0] ?? null;
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
