// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What a computer knows (spec 09, Playing fair): only what its side can
// see, and what it remembers from before the fog came back. Its plans
// run on a copy of the game holding just that: its side's own units and
// conduits, and the enemy units and conduit nodes it has seen.
//
// Which enemy Outpost is the Citadel is worked out, as a human would
// (decision D43): from the conduits seen running into Outposts, how
// early each was seen, the map's start positions, and the Outposts
// destroyed without ending the game.

import { PX, FOG_CELL } from '../rules/constants.js';
import { UNIT_KINDS, unitTop } from '../rules/units.js';
import { isGone } from '../rules/conduits.js';
import { wrap } from '../rules/math/wrap.js';

const lifted = (u, size) => wrap(u.y - Math.max(0, unitTop(u)) / 2, size);
const START_NEAR = 60 * PX; // a Citadel stands on its start position
const EARLY_ROUNDS = 2; // seen this early, before the enemy could expand

// Whether a point is visible to a player's side right now. With fog
// off, everything is. This reads the fog itself, not the screen: a side
// with no human on it would otherwise have the fog lifted (spec 08).
export function sees(game, player, x, y) {
  const fog = game.state.fog;
  if (!fog) return true;
  const n = fog.cells;
  const cx = Math.floor(wrap(x, game.map.size) / FOG_CELL) % n;
  const cy = Math.floor(wrap(y, game.map.size) / FOG_CELL) % n;
  return fog.counts[game.sides[player]][cy * n + cx] > 0;
}

export class Memory {
  // `starts` are the map's start positions, in pixels.
  constructor(player, starts = []) {
    this.player = player;
    this.starts = starts.map((p) => ({ x: p.x * PX, y: p.y * PX, seen: false }));
    this.units = new Map(); // enemy unit id → { unit, firstSeen, lastSeen }
    this.nodes = new Map(); // enemy conduit id → { owner, from, to, seen: Map(index → node) }
    this.notCitadel = new Set(); // enemy Outposts known not to be a Citadel
  }

  // Looks at the game as the computer's side sees it now.
  observe(game) {
    const s = game.state;
    const size = game.map.size;
    const side = game.sides[this.player];
    const seen = (x, y) => sees(game, this.player, x, y);
    const present = new Set(s.units.map((u) => u.id));
    for (const st of this.starts) if (seen(st.x, st.y)) st.seen = true;
    for (const u of s.units) {
      if (game.sides[u.owner] === side) continue;
      if (!seen(u.x, lifted(u, size))) continue;
      const known = this.units.get(u.id);
      const copy = { ...structuredClone(u), citadel: false };
      this.units.set(u.id, { unit: copy, firstSeen: known?.firstSeen ?? s.round, lastSeen: s.round });
    }
    // Remembered units whose place can be seen, but that aren't there,
    // are gone. An Outpost gone while its owner plays on wasn't the
    // Citadel.
    for (const [id, m] of this.units) {
      if (present.has(id) || !seen(m.unit.x, lifted(m.unit, size))) continue;
      if (m.unit.kind === 'outpost' && !s.players[m.unit.owner].knockedOut) this.notCitadel.add(id);
      this.units.delete(id);
    }
    for (const c of s.conduits) {
      if (game.sides[c.owner] === side) continue;
      let entry = this.nodes.get(c.id);
      c.nodes.forEach((n, i) => {
        if (isGone(s, n)) {
          entry?.seen.delete(i);
          return;
        }
        if (!n.resting || !seen(n.x, n.y)) return;
        if (!entry) {
          entry = { owner: c.owner, from: c.from, to: c.to, seen: new Map() };
          this.nodes.set(c.id, entry);
        }
        entry.to = c.to;
        entry.seen.set(i, { ...n });
      });
      // A conduit seen running into an Outpost: that Outpost was built,
      // so it isn't a Citadel (spec 09, Finding the enemy's Citadel).
      if (entry && entry.to !== null && entry.seen.size > 0) {
        const into = this.units.get(entry.to)?.unit;
        if (into && near(size, entry, into)) this.notCitadel.add(into.id);
      }
    }
    for (const [id, entry] of this.nodes) {
      if (!s.conduits.some((c) => c.id === id)) this.nodes.delete(id);
      else if (entry.seen.size === 0) this.nodes.delete(id);
    }
  }

  // The chance that each known enemy Outpost is its owner's Citadel, as
  // a Map of id → chance. Some of the chance is left for Outposts not
  // seen yet.
  citadelOdds(game) {
    const s = game.state;
    const odds = new Map();
    const byOwner = new Map();
    for (const { unit, firstSeen } of this.units.values()) {
      if (unit.kind !== 'outpost' || this.notCitadel.has(unit.id)) continue;
      if (s.players[unit.owner].knockedOut) continue;
      let w = 1;
      if (this.starts.some((st) => close(game.map.size, st, unit, START_NEAR))) w += 4;
      if (firstSeen <= EARLY_ROUNDS) w += 2;
      if (!byOwner.has(unit.owner)) byOwner.set(unit.owner, []);
      byOwner.get(unit.owner).push([unit.id, w]);
    }
    const unseen = s.fog ? 2 : 0.25;
    for (const list of byOwner.values()) {
      const total = list.reduce((a, [, w]) => a + w, 0) + unseen;
      for (const [id, w] of list) odds.set(id, w / total);
    }
    return odds;
  }

  // The copy of the game the computer plans on. Each enemy's likeliest
  // Outpost stands in for its Citadel, so the copy plays on as the real
  // game does; the computer's own odds decide what a hit on it is worth.
  belief(game, odds = this.citadelOdds(game)) {
    const s = game.state;
    const side = game.sides[this.player];
    const own = (owner) => game.sides[owner] === side;
    const state = structuredClone({ ...s, units: [], conduits: [], shots: [], missiles: [] });
    state.units = s.units.filter((u) => own(u.owner)).map((u) => structuredClone(u));
    const best = new Map();
    for (const { unit } of this.units.values()) {
      const copy = structuredClone(unit);
      state.units.push(copy);
      const p = odds.get(copy.id) ?? 0;
      if (p > (best.get(copy.owner)?.[0] ?? 0)) best.set(copy.owner, [p, copy]);
    }
    for (const [, u] of best.values()) u.citadel = true;
    state.units.sort((a, b) => a.id - b.id);
    state.conduits = s.conduits.filter((c) => own(c.owner)).map((c) => structuredClone(c));
    for (const [id, entry] of this.nodes) {
      const nodes = [...entry.seen.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => ({ ...n }));
      state.conduits.push({
        id, owner: entry.owner, from: entry.from, to: entry.to, shot: null, started: true, nextAt: 0, path: [],
        broken: false, doomAt: null, doomCredit: null, doomFails: false, nodes,
      });
    }
    state.conduits.sort((a, b) => a.id - b.id);
    state.pending = state.pending.filter((e) => e.owner === undefined || own(e.owner));
    return { setup: game.setup, map: game.map, wind: game.wind, sides: game.sides, state, events: [] };
  }

  // The map's start positions not yet seen.
  unseenStarts() {
    return this.starts.filter((st) => !st.seen);
  }
}

function close(size, a, b, r) {
  let dx = Math.abs(a.x - b.x) % size;
  let dy = Math.abs(a.y - b.y) % size;
  dx = Math.min(dx, size - dx);
  dy = Math.min(dy, size - dy);
  return dx * dx + dy * dy <= r * r;
}

// Whether any seen node of a conduit lies by the unit, so the conduit
// was seen reaching it.
function near(size, entry, unit) {
  const r = UNIT_KINDS[unit.kind].radius + 30 * PX;
  for (const n of entry.seen.values()) if (close(size, n, unit, r)) return true;
  return false;
}
