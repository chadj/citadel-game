// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// A computer player (spec 09). Each turn it:
//   1. looks at the game as its side sees it, and remembers;
//   2. lists the moves worth considering;
//   3. plays each one out on its copy of the game, with the game's own
//      rules, and weighs where it leaves it (value.js);
//   4. plays the best of them out again with its own aim error, so a
//      move that only works when perfect counts for less;
//   5. picks one, as its judgment, style and whims allow, and launches
//      it with its error added; or passes.
// Thinking runs in slices, so the screen keeps moving; it stops at its
// limit with the best move found so far.

import { applyMove, settle } from '../rules/game.js';
import { ITEMS, BUILDING, itemCost } from '../rules/items.js';
import { conduitWarning } from '../rules/conduits.js';
import { findUnit } from '../rules/units.js';
import { MIN_TO_PLAY, POWER_MAX } from '../rules/constants.js';
import { Memory } from './belief.js';
import { envFor } from './aim.js';
import { candidates } from './candidates.js';
import { evaluate, planFor } from './value.js';
import { personality as pick, STYLE_WEIGHTS } from './personalities.js';

export const THINK_LIMIT_MS = 25000; // spec 09: about 20 to 30 seconds
const EYE = [1, 0.6, 0.3, 0.1, 0]; // its error, by how often it has repeated a shot
const ROBUST_TOP = 6; // the best moves played out again with error
const now = () => (globalThis.performance ? performance.now() : Date.now());

// A random number source from a seed, so tests can repeat a game.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Brain {
  constructor(personalityId, player, { starts = [], random = Math.random } = {}) {
    this.random = random;
    this.personality = pick(personalityId, random);
    this.weights = STYLE_WEIGHTS[this.personality.style];
    this.player = player;
    this.memory = new Memory(player, starts);
    this.last = null; // its last intended shot, and how often in a row
    this.recent = []; // its last few moves, to notice repeating itself
    this.misses = new Map(); // target id → attacks on it that did nothing
    this.lastAttack = null;
  }

  observe(game) {
    this.memory.observe(game);
    // A plan that keeps failing: the target it last attacked is still
    // there, unharmed.
    if (this.lastAttack) {
      const known = this.memory.units.get(this.lastAttack.target);
      if (known && known.unit.armor >= this.lastAttack.armor) {
        this.misses.set(this.lastAttack.target, (this.misses.get(this.lastAttack.target) ?? 0) + 1);
      }
      this.lastAttack = null;
    }
  }

  // Starts thinking about a turn. work(ms) thinks for about that long
  // and returns the move once it has one; best() returns the move from
  // what it has weighed so far.
  begin(game, player = this.player) {
    this.observe(game);
    this.game = game;
    const gen = this.thinking(game, player);
    let move = null;
    let found = null;
    const started = now();
    return {
      work: (ms) => {
        const until = now() + ms;
        while (!move) {
          const r = gen.next();
          if (r.done) {
            move = r.value;
            break;
          }
          found = r.value;
          if (now() >= until) break;
          if (now() - started >= THINK_LIMIT_MS) move = this.finish(found, player);
        }
        return move;
      },
      best: () => move ?? this.finish(found, player),
    };
  }

  // Thinks a turn through at once.
  think(game, player = this.player) {
    const t = this.begin(game, player);
    return t.work(Infinity) ?? t.best();
  }

  *thinking(game, player) {
    const s = game.state;
    const pass = { type: 'pass', player };
    const progress = { scored: [], pass };
    if (s.players[player].energy < MIN_TO_PLAY) return pass;
    const j = this.personality.judgment;
    const plan = planFor(game, player, this.personality, this.weights, this.memory);
    const belief = this.memory.belief(game, plan.odds);
    const env = envFor(belief);
    let list = candidates(belief, plan, env, this.random);
    yield progress;
    // Poorer judgment looks at fewer moves.
    const share = 0.4 + 0.6 * j;
    if (share < 1) list = list.filter(() => this.random() < share);

    const passValue = this.playOut(belief, plan, pass);
    progress.passValue = passValue;
    for (const c of list) {
      const move = { type: 'launch', player, ...withoutTarget(c) };
      const v = this.playOut(belief, plan, move);
      if (v !== null) progress.scored.push({ c, move, v: v + this.habit(c) });
      yield progress;
    }

    // The best few, again with its own error.
    progress.scored.sort((a, b) => b.v - a.v);
    const p = this.personality;
    if (p.aim > 0 || p.power > 0) {
      for (const e of progress.scored.slice(0, ROBUST_TOP)) {
        const vs = [e.v];
        for (let k = 0; k < 2; k++) {
          const v = this.playOut(belief, plan, this.stray(e.move, 0.7));
          vs.push(v === null ? passValue - itemCost(e.move.item) : v + this.habit(e.c));
        }
        e.v = vs.reduce((a, b) => a + b, 0) / vs.length;
        yield progress;
      }
    }
    progress.done = true;
    return this.finish(progress, player);
  }

  // What it has learned about repeating itself (spec 09, Not getting
  // stuck).
  habit(c) {
    let v = 0;
    if (c.target !== null && ITEMS[c.item].category === 'weapon') v -= 18 * Math.max(0, (this.misses.get(c.target) ?? 0) - 1);
    const key = `${c.launcher}:${c.item}:${c.target ?? `${c.heading}/${c.power}`}`;
    const repeats = this.recent.filter((k) => k === key).length;
    if (repeats >= 3) v -= 15 * (repeats - 2);
    return v;
  }

  playOut(belief, plan, move) {
    const copy = { ...belief, state: structuredClone(belief.state), events: [] };
    try {
      if (!applyMove(copy, move).ok) return null;
      settle(copy);
    } catch {
      return null;
    }
    return evaluate(copy, plan);
  }

  // Picks a move from what it weighed, and adds its error.
  finish(progress, player) {
    const pass = { type: 'pass', player };
    if (!progress || progress.passValue === undefined) return pass;
    const p = this.personality;
    const noise = (1 - p.judgment) * 20;
    const scored = progress.scored.map((e) => ({ ...e, v: e.v + noise * gauss(this.random) }));
    scored.sort((a, b) => b.v - a.v);
    let choice = scored[0] && scored[0].v > progress.passValue ? scored[0] : null;
    // A whim: something else that isn't a disaster.
    if (this.random() < p.whim) {
      const others = scored.filter((e) => e !== choice && e.v > progress.passValue - 15);
      if (others.length > 0) choice = others[Math.floor(this.random() * others.length)];
    }
    if (!choice) {
      this.last = null;
      return pass;
    }
    const key = `${choice.c.launcher}:${choice.c.item}:${choice.c.target ?? `${choice.c.heading}/${choice.c.power}`}`;
    this.recent = [...this.recent.slice(-5), key];
    const same = this.last && this.last.launcher === choice.move.launcher && this.last.item === choice.move.item
      && this.last.heading === choice.move.heading && this.last.power === choice.move.power;
    const repeats = same ? this.last.repeats + 1 : 0;
    this.last = { ...choice.move, repeats };
    if (choice.c.target !== null && ITEMS[choice.c.item].category === 'weapon') {
      const t = this.memory.units.get(choice.c.target);
      if (t) this.lastAttack = { target: choice.c.target, armor: t.unit.armor };
    }
    return this.aimed(choice.move, EYE[Math.min(repeats, EYE.length - 1)]);
  }

  // The move as launched, with its error. Like a human, it doesn't
  // launch a building while the conduit warning shows: it aims again.
  aimed(move, share) {
    const s = this.game.state;
    const launcher = findUnit(s, move.launcher);
    for (let k = 0; k < 6; k++) {
      const m = this.stray(move, share);
      if (ITEMS[m.item].category !== BUILDING || conduitWarning(s, launcher, m.heading, this.game.map.size).length === 0) return m;
    }
    return move;
  }

  // A move with its aim error added, scaled by `share`.
  stray(move, share) {
    const p = this.personality;
    if (share === 0 || (p.aim === 0 && p.power === 0)) return move;
    const r = () => this.random() * 2 - 1;
    const heading = (((move.heading + Math.round(r() * p.aim * share)) % 360) + 360) % 360;
    const power = Math.max(0, Math.min(POWER_MAX, move.power + Math.round(r() * p.power * share * POWER_MAX)));
    return { ...move, heading, power };
  }
}

function withoutTarget({ target, ...rest }) {
  return rest;
}

function gauss(random) {
  return (random() + random() + random() - 1.5) * 1.15;
}
