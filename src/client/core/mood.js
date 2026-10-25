// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What the game music follows (spec 11, The music; decision D51):
// excitement, which builds as the action comes near the player, and
// mood, which rises as things go well for them and falls as they go
// badly. With nothing happening, both drift back.
//
// The music reads them as an intensity from 0 to 3 and a mood of
// 'dark', 'neutral' or 'upbeat'.

const EXCITE_HALF_MS = 9000; // excitement halves in about 9 s
const MOOD_HALF_MS = 25000; // mood drifts halfway back in about 25 s
const INTENSITY_AT = [0.15, 0.45, 0.9]; // excitement for intensity 1, 2, 3
const MOOD_AT = 0.3;
const MOOD_STEP = 0.35; // how far one unit of good or bad news moves it

export class MoodTracker {
  constructor() {
    this.excitement = 0;
    this.mood = 0; // -1 to 1
  }

  // An event, already judged: `near` from 0 (far or unseen) to 1 (in the
  // middle of the view); `good` and `bad` how much it helps or hurts the
  // player.
  feel({ excite = 0, near = 1, good = 0, bad = 0 }) {
    this.excitement = Math.min(2, this.excitement + excite * near);
    this.mood = Math.max(-1, Math.min(1, this.mood + MOOD_STEP * (good - bad)));
  }

  update(ms) {
    this.excitement *= 0.5 ** (ms / EXCITE_HALF_MS);
    this.mood *= 0.5 ** (ms / MOOD_HALF_MS);
  }

  get intensity() {
    return INTENSITY_AT.filter((t) => this.excitement >= t).length;
  }

  get tone() {
    return this.mood >= MOOD_AT ? 'upbeat' : this.mood <= -MOOD_AT ? 'dark' : 'neutral';
  }
}

// How an event moves the music for player `me` (spec 11, What it
// listens for). `ctx` as for aideKeysFor, plus kindOf(unitId).
export function moodOf(e, ctx) {
  const { me, sides } = ctx;
  const ours = (p) => p !== null && p !== undefined && sides[p] === sides[me];
  const defense = (id) => ['barrier', 'interceptor'].includes(ctx.kindOf(e.unit ?? id));
  switch (e.type) {
    case 'explosion':
      return { excite: 0.25 };
    case 'blast':
      return { excite: 0.5 };
    case 'interceptorFired':
      return { excite: 0.3 };
    case 'built':
      if (!ours(e.owner)) return defense() ? { bad: 0.5 } : {};
      return { excite: 0.15, good: 0.35 };
    case 'damage':
      if (ours(e.owner)) return { bad: 0.4 * (e.amount / 30) };
      return ours(e.by) ? { good: 0.45 * (e.amount / 30) } : {};
    case 'destroy':
      if (e.how === 'salvaged' && !ours(e.owner)) return { good: 0.4 };
      if (ours(e.owner)) return { bad: e.kind === 'outpost' ? 1 : 0.5 };
      return ours(e.by) ? { good: e.kind === 'outpost' ? 1 : 0.5 } : {};
    case 'disabled':
      if (!defense()) return {};
      return ours(e.owner) ? { bad: 0.6 } : { good: 0.6 };
    case 'barrierUp':
      return ours(ctx.ownerOf?.(e.unit)) ? { good: 0.3 } : { bad: 0.4 };
    case 'knockedOut':
      return ours(e.player) ? { bad: 2, excite: 1 } : { good: ours(e.by) ? 2 : 0.5, excite: 0.8 };
    default:
      return {};
  }
}
