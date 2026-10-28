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
import { findUnit, addUnit } from '../rules/units.js';
import { MIN_TO_PLAY, POWER_MAX, PX, WET } from '../rules/constants.js';
import { delta, wrap } from '../rules/math/wrap.js';
import { tileIndex, tileCenter, sampleTerrain } from '../rules/terrain/terrain.js';
import { Memory } from './belief.js';
import { envFor, solve, landing } from './aim.js';
import { candidates } from './candidates.js';
import { landDistance } from './land.js';
import { evaluate, planFor, roverAlerts } from './value.js';
import { personality as pick, STYLE_WEIGHTS } from './personalities.js';

export const THINK_LIMIT_MS = 25000; // spec 09: about 20 to 30 seconds
const EYE = [1, 0.6, 0.3, 0.1, 0]; // its error, by how often it has repeated a shot
const ROBUST_TOP = 6; // the best moves played out again with error
const CROSSING_SHARE = 0.8; // of what the building after a Pontoon adds
const CROSSING_MAX = 400; // px of water a crossing plan looks across
const CROSSING_DETOUR = 2; // how much longer the way round by land must be
const CHANCE_SPREAD = [-1, -0.5, 0, 0.5, 1]; // aim errors tried, as shares of the most it strays
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
    this.memory = new Memory(player, starts, { judgment: this.personality.judgment, random });
    this.last = null; // its last intended shot, and how often in a row
    this.recent = []; // its last few moves, to notice repeating itself
    this.misses = new Map(); // target id → attacks on it that did nothing
    this.lastAttack = null;
  }

  // Looks at a flight as it goes, every tick (decision D59).
  watch(game) {
    this.memory.watch(game);
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
    roverAlerts(belief, plan);
    const env = envFor(belief);
    let list = candidates(belief, plan, env, this.random);
    yield progress;
    // Poorer judgment looks at fewer moves.
    const share = 0.4 + 0.6 * j;
    if (share < 1) list = list.filter(() => this.random() < share);

    const passValue = this.playOut(belief, plan, pass);
    progress.passValue = passValue;
    this.passValue = passValue;
    for (const c of list) {
      const move = { type: 'launch', player, ...withoutTarget(c) };
      const v = this.score(belief, plan, move, c);
      if (v !== null) progress.scored.push({ c, move, v: v + this.habit(c) });
      yield progress;
    }

    // The best few, again with its own error.
    progress.scored.sort((a, b) => b.v - a.v);
    const p = this.personality;
    if (p.aim > 0 || p.power > 0) {
      for (const e of progress.scored.slice(0, ROBUST_TOP)) {
        // A Pontoon's chance of landing, and Charges' error, are in their
        // values already.
        if (e.c.cross || e.move.item === 'charges') continue;
        const vs = [e.v];
        for (let k = 0; k < 2; k++) {
          const v = this.score(belief, plan, this.stray(e.move, 0.7), e.c);
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

  score(belief, plan, move, c) {
    if (c.cross) return this.crossing(belief, plan, move);
    if (move.item === 'charges') return this.spread(belief, plan, move);
    return this.playOut(belief, plan, move);
  }

  // Charges go just clear of what they guard: a little short, and their
  // blast reaches it (spec 09, Proximity Charges). So they count as their
  // own aim would land them, short and long as well as true.
  spread(belief, plan, move) {
    const p = this.personality;
    const vs = [this.playOut(belief, plan, move)];
    if (vs[0] === null) return null;
    if (p.power > 0) {
      for (const w of [-0.7, 0.7]) {
        const power = Math.max(0, Math.min(POWER_MAX, move.power + Math.round(w * p.power * POWER_MAX)));
        const v = this.playOut(belief, plan, { ...move, power });
        vs.push(v ?? this.passValue - itemCost('charges'));
      }
    }
    return vs.reduce((a, b) => a + b, 0) / vs.length;
  }

  playOut(belief, plan, move) {
    const copy = played(belief, move);
    return copy && evaluate(copy, plan);
  }

  // A Pontoon is worth what it lets it build across the water (spec 09,
  // Planning ahead: water needs a Pontoon first). It plays the Pontoon
  // out; then, along the line from the launcher through it, it supposes
  // Pontoons on the rest of the water, and that it has its turn again
  // with enough for an Outpost; and plays out the best Outpost onto the
  // land past the water. A share of what that adds, over the best Outpost
  // this side of the water, counts now: less for every further Pontoon
  // the crossing needs, which it pays for too. Only water that land
  // doesn't go round, or goes a long way round, is worth crossing.
  //
  // Narrow water, such as a channel half a tile wide (spec 02,
  // Landforms), is easy to miss: the plan counts only as often as its
  // own aim would land the Pontoon, and the rest of the time it has
  // spent a Pontoon for nothing (decision D55).
  crossing(belief, plan, move) {
    const copy = played(belief, move);
    if (!copy) return null;
    const now = evaluate(copy, plan);
    const s = copy.state;
    const pontoon = s.units.find((u) => u.kind === 'pontoon' && u.owner === move.player && !belief.state.units.some((b) => b.id === u.id));
    const launcher = findUnit(s, move.launcher);
    if (!pontoon || !launcher || s.phase !== 'turn') return now;
    const chance = this.landChance(belief, move);
    const missed = (this.passValue ?? now) - itemCost('pontoon');
    const planned = this.crossingPlan(copy, plan, move, now, pontoon, launcher);
    return chance * planned + (1 - chance) * missed;
  }

  // How often a Pontoon launched as `move` would land on free water,
  // with this computer's aim error: over an even spread of the error it
  // may have, each shot flown as it aims them.
  landChance(belief, move) {
    const p = this.personality;
    if (p.aim === 0 && p.power === 0) return 1;
    const launcher = findUnit(belief.state, move.launcher);
    if (!launcher) return 0;
    const env = envFor(belief);
    const map = belief.map;
    const taken = new Set(belief.state.units.filter((u) => u.kind === 'pontoon' || u.kind === 'rover').map((u) => tileIndex(map, u.x, u.y)));
    let hits = 0;
    let shots = 0;
    for (const a of CHANCE_SPREAD) {
      for (const w of CHANCE_SPREAD) {
        const heading = (((move.heading + Math.round(a * p.aim)) % 360) + 360) % 360;
        const power = Math.max(0, Math.min(POWER_MAX, move.power + Math.round(w * p.power * POWER_MAX)));
        const at = landing(belief, env, launcher, heading, power);
        shots++;
        if (sampleTerrain(map, at.x, at.y).type === WET && !taken.has(tileIndex(map, at.x, at.y))) hits++;
      }
    }
    return hits / shots;
  }

  // What the crossing a Pontoon starts is worth, if it lands.
  crossingPlan(copy, plan, move, now, pontoon, launcher) {
    const s = copy.state;
    const next = { ...copy, state: structuredClone(s), events: [] };
    const t = next.state;
    const size = next.map.size;
    const a = Math.atan2(delta(launcher.y, pontoon.y, size), delta(launcher.x, pontoon.x, size));
    const along = (d) => ({ x: wrap(Math.round(pontoon.x + Math.cos(a) * d * PX), size), y: wrap(Math.round(pontoon.y + Math.sin(a) * d * PX), size) });
    t.turn = { ...t.turn, player: move.player, seat: t.seats.indexOf(move.player), launched: false };
    t.players[move.player].energy = Math.max(t.players[move.player].energy, itemCost('outpost'));
    const before = evaluate(next, plan);
    // The rest of the water on the way, as the map has it.
    let extra = 0;
    let shore = 0;
    for (let d = 15; d <= CROSSING_MAX; d += 15) {
      const p = along(d);
      if (sampleTerrain(next.map, p.x, p.y).type !== WET) {
        shore = d;
        break;
      }
      const c = tileCenter(next.map, tileIndex(next.map, p.x, p.y));
      if (t.units.some((u) => u.kind === 'pontoon' && u.x === c.x && u.y === c.y)) continue;
      addUnit(t, { kind: 'pontoon', owner: move.player, x: c.x, y: c.y, base: pontoon.base });
      extra += 1;
    }
    if (shore === 0) return now;
    // Water that land goes round, not far out of the way, is no reason
    // to cross (decision D58).
    const far = along(shore + 45);
    const straight = Math.hypot(delta(launcher.x, far.x, size), delta(launcher.y, far.y, size));
    if (landDistance(next.map, launcher, far) <= CROSSING_DETOUR * straight) return now;
    const env = envFor(next);
    const outpostAt = (d) => {
      const shot = solve(next, env, launcher, along(d));
      if (!shot || shot.miss > 20 * PX) return -Infinity;
      const after = played(next, { type: 'launch', player: move.player, launcher: launcher.id, item: 'outpost', heading: shot.heading, power: shot.power });
      return after ? evaluate(after, plan) : -Infinity;
    };
    // The Pontoons alone may be enough: something can be built across.
    let best = evaluate(next, plan);
    for (const d of [0, shore + 45, shore + 100, shore + 160]) best = Math.max(best, outpostAt(d));
    // What it could build this side of the water instead: the crossing
    // counts only for what it adds to that (decision D58).
    let home = before;
    for (const d of [-45, -100]) home = Math.max(home, outpostAt(d));
    const gain = best - home - extra * itemCost('pontoon');
    return now + CROSSING_SHARE ** (1 + extra) * Math.max(0, gain);
  }

  // Picks a move from what it weighed, and adds its error.
  finish(progress, player) {
    const pass = { type: 'pass', player };
    if (!progress || progress.passValue === undefined) return pass;
    const p = this.personality;
    const noise = (1 - p.judgment) * 20;
    // Poor judgment misranks the moves worth making; with dozens of
    // them, noise alone would always find one that seems to beat
    // passing, so it only reorders those that do.
    const worth = progress.scored.filter((e) => e.v > progress.passValue);
    const scored = worth.map((e) => ({ ...e, v: e.v + noise * gauss(this.random) }));
    scored.sort((a, b) => b.v - a.v);
    let choice = scored[0] ?? null;
    // A whim: something else that isn't a disaster.
    if (this.random() < p.whim) {
      // An item first, then one of its moves, so a cheap item with many
      // candidates doesn't crowd out the rest.
      const others = progress.scored.filter((e) => e.c !== choice?.c && e.v > progress.passValue - 5);
      const items = [...new Set(others.map((e) => e.c.item))];
      if (items.length > 0) {
        const item = items[Math.floor(this.random() * items.length)];
        const pick = others.filter((e) => e.c.item === item);
        choice = pick[Math.floor(this.random() * pick.length)];
      }
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
      // A guessed launcher: trusted less once it has been fired at.
      if (choice.c.target < 0) this.memory.tried(-choice.c.target);
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

function withoutTarget({ target, cross, ...rest }) {
  return rest;
}

// A copy of the game with a move played out, or null if it's refused.
function played(game, move) {
  const copy = { ...game, state: structuredClone(game.state), events: [] };
  try {
    if (!applyMove(copy, move).ok) return null;
    settle(copy);
  } catch {
    return null;
  }
  return copy;
}

function gauss(random) {
  return (random() + random() + random() - 1.5) * 1.15;
}
