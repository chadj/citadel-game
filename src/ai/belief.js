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
//
// It also watches every turn, not just its own, for what a human would
// notice (decision D59):
//   - attacks on its buildings: damage, near misses, shots its
//     Interceptors catch, Pulses, Worms and Surges, but not conduit
//     burns. A building attacked stays on alert for a few turn cycles,
//     since an attacker may wait for the Interceptors to reload;
//   - leads to the enemy: where an enemy shot it saw in flight came
//     from, traced back along its arc; explosions in the fog; and the
//     sign of damage on enemy units it can't see (spec 08). The place a
//     shot came from stands in for an enemy launcher in its plans.
// Poorer judgment notices less, and guesses the places less closely.

import { PX, FOG_CELL, GRAVITY, DRAG } from '../rules/constants.js';
import { UNIT_KINDS, unitTop, isLauncher, findUnit } from '../rules/units.js';
import { ITEMS, WEAPON } from '../rules/items.js';
import { isGone } from '../rules/conduits.js';
import { ONE, VEL_PER_POS } from '../rules/math/fixed.js';
import { wrap, delta } from '../rules/math/wrap.js';
import { sampleTerrain } from '../rules/terrain/terrain.js';

const lifted = (u, size) => wrap(u.y - Math.max(0, unitTop(u)) / 2, size);
const START_NEAR = 60 * PX; // a Citadel stands on its start position
const EARLY_ROUNDS = 2; // seen this early, before the enemy could expand
const ALERT_CYCLES = 3; // turn cycles a building stays on alert
const LEAD_CYCLES = 6; // turn cycles a lead to the enemy is followed
const NEAR_MISS = 130 * PX; // a blast this close to a building attacks it
const LEAD_NEAR = 150 * PX; // a known launcher this close explains a lead
const TRACE_FAR = 1100 * PX; // no shot comes from further than this
const AIM_ERROR = 8; // degrees: how far off the way a shot came is judged, at best
const FAR_ERROR = 0.3; // how far off its distance is judged, as a share, at best
const SAME_SHOOTER = 250 * PX; // guesses this close are taken as one launcher
const GUESS = 0.7; // how far a launcher guessed from a shot's arc is trusted
const PRECIOUS = new Set(['outpost', 'battery', 'extractor']);
// Events that show where an enemy shot came down.
const LANDED = new Set(['explosion', 'blast', 'pulse', 'hit', 'lost', 'stopped', 'caught', 'roverExplodes']);

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
  // `starts` are the map's start positions, in pixels. `judgment` is
  // the personality's, from 0 to 1.
  constructor(player, starts = [], { judgment = 1, random = Math.random } = {}) {
    this.player = player;
    this.judgment = judgment;
    this.random = random;
    this.starts = starts.map((p) => ({ x: p.x * PX, y: p.y * PX, seen: false }));
    this.units = new Map(); // enemy unit id → { unit, firstSeen, lastSeen }
    this.nodes = new Map(); // enemy conduit id → { owner, from, to, seen: Map(index → node) }
    this.notCitadel = new Set(); // enemy Outposts known not to be a Citadel
    this.flying = new Map(); // enemy shot id → where it was first seen, and how it moved
    this.alerts = new Map(); // own unit id → { heat, until }
    this.leads = []; // { id, x, y, owner, kind: 'shooter' | 'blast' | 'sign', until, tries }
    this.nextLead = 1;
    this.places = new Map(); // own unit id → { x, y }, for units destroyed since
    this.read = 0; // game events looked at so far
    this.mover = null; // the player whose launch the events come from
  }

  // Looks at the game during a flight, every tick: the enemy shots its
  // side can see.
  watch(game) {
    const s = game.state;
    const side = game.sides[this.player];
    for (const shot of s.shots) {
      if (game.sides[shot.owner] === side || this.flying.has(shot.id)) continue;
      if (!sees(game, this.player, shot.x, shot.y)) continue;
      const { x, y, z, vx, vy, vz } = shot;
      this.flying.set(shot.id, { owner: shot.owner, x, y, z, vx, vy, vz });
    }
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
    this.readEvents(game);
    this.followLeads(game);
    this.places = new Map(s.units.filter((u) => game.sides[u.owner] === side).map((u) => [u.id, { x: u.x, y: u.y }]));
  }

  // What happened since it last looked: attacks on its buildings, and
  // blasts in the fog.
  readEvents(game) {
    const s = game.state;
    const side = game.sides[this.player];
    const enemy = (p) => p !== null && p !== undefined && game.sides[p] !== side;
    const j = this.judgment;
    const events = game.events;
    for (; this.read < events.length; this.read++) {
      const e = events[this.read];
      if (e.type === 'launch') this.mover = e.player;
      else if (e.type === 'roundOver' || e.type === 'turnStart') this.mover = null;
      else if (e.type === 'damage' || e.type === 'disabled' || e.type === 'infected') {
        // Hit: it notices, mostly.
        const unit = findUnit(s, e.unit);
        const at = unit ?? this.places.get(e.unit);
        const owner = unit?.owner ?? e.owner;
        if (!at || owner === undefined || game.sides[owner] !== side) continue;
        const by = e.type === 'infected' ? e.owner : e.by ?? unit?.worm?.owner;
        if (enemy(by) && this.random() < 0.6 + 0.4 * j) this.alert(game, at, 1);
      } else if (LANDED.has(e.type) && enemy(this.mover)) {
        if (e.item && ITEMS[e.item]?.category !== WEAPON && e.item !== 'rover') continue;
        // A near miss, or a shot caught on the way: noticed less surely.
        if (this.random() < 0.3 + 0.7 * j) this.alert(game, e, 0.7);
        // A blast in the fog shows where there's something to hit.
        if (!sees(game, this.player, e.x, e.y)) this.addLead(game, { x: e.x, y: e.y, owner: this.mover, kind: 'blast' });
      }
    }
  }

  // Its precious buildings near a point are under attack.
  alert(game, at, heat) {
    const s = game.state;
    const size = game.map.size;
    const side = game.sides[this.player];
    const until = s.cycle.steps + ALERT_CYCLES * s.seats.length + 1;
    for (const u of s.units) {
      if (game.sides[u.owner] !== side || !PRECIOUS.has(u.kind) || !close(size, u, at, NEAR_MISS)) continue;
      const was = this.alerts.get(u.id);
      this.alerts.set(u.id, { heat: Math.max(heat, was?.heat ?? 0), until });
    }
  }

  // Its own units under attack now, as a Map of id → heat (0 to 1).
  attacked(state) {
    const out = new Map();
    for (const [id, a] of this.alerts) {
      if (a.until <= state.cycle.steps || !state.units.some((u) => u.id === id)) this.alerts.delete(id);
      else out.set(id, a.heat);
    }
    return out;
  }

  // Where a shot came from, as a person watching would judge it from
  // where they saw it: the way it came, a few degrees off, and how far,
  // a good share off, since distance is harder to judge by eye. Poorer
  // judgment is further off either way.
  judged(seen, from, size) {
    const j = this.judgment;
    const spread = () => this.random() + this.random() - 1; // -1 to 1, mostly near 0
    const dx = delta(seen.x, from.x, size);
    const dy = delta(seen.y, from.y, size);
    const a = Math.atan2(dy, dx) + spread() * ((AIM_ERROR + 12 * (1 - j)) * Math.PI) / 180;
    const d = Math.hypot(dx, dy) * (1 + spread() * (FAR_ERROR + 0.3 * (1 - j)));
    return { x: seen.x + Math.cos(a) * d, y: seen.y + Math.sin(a) * d };
  }

  // A lead to the enemy; one close to another of the same kind renews it.
  // Shots from the same place sharpen the guess: it moves to the average
  // of what it has judged.
  addLead(game, { x, y, owner, kind }) {
    const s = game.state;
    const size = game.map.size;
    const until = s.cycle.steps + LEAD_CYCLES * s.seats.length + 1;
    const near = kind === 'shooter' ? SAME_SHOOTER : LEAD_NEAR / 2;
    const same = this.leads.find((l) => l.kind === kind && l.owner === owner && close(size, l, { x, y }, near));
    if (!same) {
      this.leads.push({ id: this.nextLead++, x: wrap(x, size), y: wrap(y, size), owner, kind, until, tries: 0, seen: 1 });
      return;
    }
    same.until = until;
    if (kind !== 'shooter') return;
    same.seen += 1;
    same.x = wrap(same.x + delta(same.x, x, size) / same.seen, size);
    same.y = wrap(same.y + delta(same.y, y, size) / same.seen, size);
  }

  // Turns the shots seen in flight into leads, adds the signs of damage
  // in the fog, and drops leads it has since seen the place of, or that
  // a known enemy launcher explains.
  followLeads(game) {
    const s = game.state;
    const size = game.map.size;
    const side = game.sides[this.player];
    for (const [id, f] of this.flying) {
      if (s.shots.some((sh) => sh.id === id)) continue;
      this.flying.delete(id);
      const from = traceBack(f, size);
      if (!from) continue;
      this.addLead(game, { ...this.judged(f, from, size), owner: f.owner, kind: 'shooter' });
    }
    for (const u of s.units) {
      if (game.sides[u.owner] === side || u.armor >= UNIT_KINDS[u.kind].armor) continue;
      if (!sees(game, this.player, u.x, lifted(u, size))) this.addLead(game, { x: u.x, y: u.y, owner: u.owner, kind: 'sign' });
    }
    const launchers = [...this.units.values()].map((m) => m.unit).filter((u) => isLauncher(u));
    this.leads = this.leads.filter((l) => l.until > s.cycle.steps && !sees(game, this.player, l.x, l.y)
      && !(l.kind === 'shooter' && launchers.some((u) => close(size, u, l, LEAD_NEAR))));
  }

  // It has fired at the place a lead points to: it trusts it less.
  tried(leadId) {
    const l = this.leads.find((x) => x.id === leadId);
    if (l) l.tries += 1;
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
    // The places shots came from: an Outpost stands in for the launcher
    // there, trusted less each time it fires there without result. Its
    // id is the lead's, made negative.
    for (const l of this.leads) {
      if (l.kind !== 'shooter' || state.players[l.owner]?.knockedOut) continue;
      if (state.units.some((u) => !own(u.owner) && isLauncher(u) && close(game.map.size, u, l, LEAD_NEAR))) continue;
      state.units.push({
        id: -l.id, kind: 'outpost', owner: l.owner, x: l.x, y: l.y, base: sampleTerrain(game.map, l.x, l.y).alt,
        armor: UNIT_KINDS.outpost.armor, citadel: false, disabledUntil: 0, worm: null, wormsHad: [], landing: false,
        guess: GUESS * 0.5 ** l.tries,
      });
    }
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

// Where a shot seen in flight came from: its arc followed back to where
// it left at 45°, as every launch does (spec 01), not allowing for the
// wind. Null if that's further than any launcher reaches.
function traceBack(f, size) {
  let { x, y, z, vx, vy, vz } = f;
  const keep = 1 - DRAG / ONE;
  let gone = 0;
  for (let k = 0; k < 2000; k++) {
    if (vz >= Math.hypot(vx, vy) * 0.995) return { x: wrap(Math.round(x), size), y: wrap(Math.round(y), size), z };
    const dx = vx / VEL_PER_POS;
    const dy = vy / VEL_PER_POS;
    x -= dx;
    y -= dy;
    z -= vz / VEL_PER_POS;
    gone += Math.hypot(dx, dy);
    if (gone > TRACE_FAR) return null;
    vx /= keep;
    vy /= keep;
    vz += GRAVITY;
  }
  return null;
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
