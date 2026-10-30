// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The server's side of online play (spec 12, The lobby, Setting up a
// game; decision D52): the players connected, the games waiting for
// players, and each game's setup screen. A game that starts becomes a
// NetGame (net-game.js).
//
// It doesn't touch sockets: each connection is { send(text) }, and the
// socket code hands it what arrives (tools/serve.js).
//
// It limits what anyone can ask of it (D67), so one person can't take
// the server over: connections, messages, games waiting and under way,
// and how often games start.
//
// Games under way survive the server restarting (D63): with a `store`
// (game-store.js), each game is written down as it's played, and
// `restoreGames()` takes them up again when the server starts. Setups
// that haven't started aren't kept: their players start again from the
// lobby.

import { randomBytes } from 'node:crypto';
import { encode, decode, GAME_NAME_MAX, NAME_MAX } from '../net/protocol.js';
import { MAPS } from '../maps/index.js';
import { computerLooks, claimColor, rollSetup, generatedMap, setupProblem } from '../client/core/newgame.js';
import { PERSONALITIES, RANDOM } from '../ai/personalities.js';
import { CHAT_MAX } from '../client/core/chat.js';
import { STYLES } from '../mapgen/generate.js';
import { PLANETS } from '../rules/terrain/planets.js';
import { MAX_PLAYERS, MAP_SIZES, FACTIONS, COLORS } from '../rules/constants.js';
import { RULES_VERSION } from '../rules/version.js';
import { NetGame } from './net-game.js';

export const GENERATED = 'Generated';
// `limits` in the constructor changes any of these.
export const LIMITS = Object.freeze({
  connections: 400, // at once, in all
  perAddress: 8, // at once, from one address
  messages: 20, // a second from one connection, once its burst is used
  burst: 60,
  rooms: 50, // setups waiting for players
  games: 20, // games under way
  startGapMs: 10000, // between games started from one address
});
const CLOCKS = [0, 15, 30, 60];
const TEAMS = [null, 'A', 'B', 'C'];
const GENERATOR_VALUES = {
  style: STYLES, tiles: MAP_SIZES, planet: Object.keys(PLANETS), energy: [0, 1, 2, 3, 4], terrain: [0, 1, 2, 3, 4], water: [0, 1, 2, 3, 4],
};

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
const index = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : null);

// The host's settings, from what a player sent.
function cleanSettings(s = {}) {
  const generator = {};
  for (const [key, values] of Object.entries(GENERATOR_VALUES)) generator[key] = pick(s.generator?.[key], values, 'random');
  return {
    map: MAPS.some((m) => m.name === s.map) ? s.map : GENERATED,
    generator,
    clock: pick(s.clock, CLOCKS, 60),
    wind: index(s.wind, 4) ?? 0,
    fog: s.fog !== false,
  };
}

export class Lobby {
  // `options` passes on to each game: timers and the clock, for tests,
  // and `onReplay(replay, name)`, called with each finished game's
  // replay (D62). `store` is where games under way are written down
  // (D63), or none.
  constructor({ store = null, limits = {}, ...options } = {}) {
    this.options = options;
    this.store = store;
    this.limits = { ...LIMITS, ...limits };
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.conns = new Set();
    this.addresses = new Map(); // connections from each address
    this.lastStart = new Map(); // when each address last started a game
    this.rooms = new Map();
    this.games = new Set();
    this.watching = new Set(); // connections on the lobby screen
    this.nextId = 1;
  }

  // A new connection. `close(reason)` closes its socket, and `address`
  // is where it's from (null for none). Past the limits it's closed at
  // once, saying why.
  connect(send, { close = () => {}, address = null } = {}) {
    const conn = { id: this.nextId++, send, close, address, name: 'Player', token: null, room: null, game: null, seat: null, budget: this.limits.burst, budgetAt: this.now() };
    const full = this.conns.size >= this.limits.connections ? 'The server is full. Try again later.'
      : address !== null && (this.addresses.get(address) ?? 0) >= this.limits.perAddress ? 'Too many connections from your address.'
        : null;
    if (full) {
      conn.refused = true;
      console.warn(`refused a connection${address ? ` from ${address}` : ''}: ${full}`);
      close(full);
      return conn;
    }
    this.conns.add(conn);
    if (address !== null) this.addresses.set(address, (this.addresses.get(address) ?? 0) + 1);
    return conn;
  }

  close(conn) {
    if (!this.conns.has(conn)) return;
    this.conns.delete(conn);
    if (conn.address !== null) {
      const n = this.addresses.get(conn.address) - 1;
      if (n > 0) this.addresses.set(conn.address, n);
      else this.addresses.delete(conn.address);
    }
    this.watching.delete(conn);
    if (conn.room) this.leaveRoom(conn);
    // A player in a game keeps their seat for now: they may come back
    // (spec 12, Losing touch).
    conn.game?.lostSocket(conn);
  }

  receive(conn, data) {
    if (conn.refused || !this.withinBudget(conn)) return;
    const m = decode(data);
    if (!m) return;
    if (conn.game) {
      conn.game.receive(conn, m);
      return;
    }
    const handler = this[`on_${m.t}`];
    if (handler) handler.call(this, conn, m);
  }

  // A connection sending more than its share of messages is closed. Its
  // player's tab connects again, and takes back their seat in a game.
  withinBudget(conn) {
    const t = this.now();
    conn.budget = Math.min(this.limits.burst, conn.budget + ((t - conn.budgetAt) * this.limits.messages) / 1000);
    conn.budgetAt = t;
    if (conn.budget >= 1) {
      conn.budget -= 1;
      return true;
    }
    conn.refused = true;
    console.warn(`closed a connection sending too many messages${conn.address ? `, from ${conn.address}` : ''}`);
    conn.close('Too many messages.');
    return false;
  }

  send(conn, t, fields) {
    conn.send(encode(t, fields));
  }

  // Who's there ---------------------------------------------------------

  on_hello(conn, m) {
    conn.name = text(m.name, NAME_MAX) || 'Player';
    // Taking back a seat in a game (spec 12, Rejoining).
    if (typeof m.token === 'string') {
      for (const game of this.games) {
        if (game.resume(conn, m.token)) {
          conn.token = m.token;
          return;
        }
      }
    }
    conn.token = randomBytes(12).toString('hex');
    this.send(conn, 'welcome', { token: conn.token });
  }

  on_ping() {}

  // The list of games ---------------------------------------------------

  on_lobby(conn) {
    this.watching.add(conn);
    this.send(conn, 'games', { games: this.listing() });
  }

  listing() {
    return [...this.rooms.values()].map((r) => {
      const used = r.seats.filter((s) => s.kind !== 'empty');
      return {
        id: r.id,
        name: r.name,
        map: r.settings.map,
        joined: used.filter((s) => s.kind !== 'open').length,
        needed: used.length,
        clock: r.settings.clock,
        wind: r.settings.wind,
        fog: r.settings.fog,
      };
    });
  }

  // The list keeps itself up to date (spec 12, Browsing).
  listChanged() {
    const games = this.listing();
    for (const c of this.watching) this.send(c, 'games', { games });
  }

  // Hosting and joining -------------------------------------------------

  on_host(conn, m) {
    if (conn.room?.host !== conn && this.rooms.size >= this.limits.rooms) {
      this.send(conn, 'error', { reason: 'The server has as many games waiting as it can take. Join one, or try again later.' });
      return;
    }
    if (conn.room) this.leaveRoom(conn);
    this.watching.delete(conn);
    const prefs = m.me ?? {};
    const room = {
      id: `${this.nextId++}`,
      name: text(m.name, GAME_NAME_MAX) || `${conn.name}'s game`,
      settings: cleanSettings(m.settings),
      seats: [
        { kind: 'human', conn, name: conn.name, faction: index(prefs.faction, FACTIONS) ?? 0, color: index(prefs.color, COLORS) ?? 0, team: null, ready: false },
        { kind: 'open', team: null },
        { kind: 'empty', team: null },
        { kind: 'empty', team: null },
      ],
      host: conn,
      chat: [],
    };
    this.rooms.set(room.id, room);
    conn.room = room;
    conn.seat = 0;
    this.roomChanged(room);
    this.listChanged();
  }

  on_join(conn, m) {
    const room = this.rooms.get(m.room);
    // Once a game starts, no one new can join it (spec 12, Joining).
    if (!room) {
      this.send(conn, 'error', { reason: 'That game has started or closed.' });
      return;
    }
    const seat = room.seats.findIndex((s) => s.kind === 'open');
    if (seat < 0) {
      this.send(conn, 'error', { reason: 'That game is full.' });
      return;
    }
    if (conn.room) this.leaveRoom(conn);
    this.watching.delete(conn);
    const others = room.seats.filter((s) => s.kind === 'human' || s.kind === 'computer');
    const prefs = m.me ?? {};
    const wanted = index(prefs.color, COLORS) ?? 0;
    room.seats[seat] = {
      kind: 'human', conn, name: uniqueName(conn.name, this.players(room).map((p) => p.name)), faction: index(prefs.faction, FACTIONS) ?? 0, team: room.seats[seat].team, ready: false,
      color: claimColor([...others, { color: wanted }], others.length, wanted, this.random),
    };
    conn.room = room;
    conn.seat = seat;
    this.system(room, `${room.seats[seat].name} joined.`);
    this.roomChanged(room);
    this.listChanged();
  }

  on_leave(conn) {
    if (conn.room) this.leaveRoom(conn);
  }

  leaveRoom(conn) {
    const room = conn.room;
    conn.room = null;
    conn.seat = null;
    if (!this.rooms.has(room.id)) return;
    if (room.host === conn) {
      this.rooms.delete(room.id);
      for (const s of room.seats) {
        if (s.conn && s.conn !== conn) {
          s.conn.room = null;
          s.conn.seat = null;
          this.send(s.conn, 'closed', { reason: 'The host closed the game.' });
        }
      }
    } else {
      const k = room.seats.findIndex((s) => s.conn === conn);
      const name = k >= 0 ? room.seats[k].name : conn.name;
      if (k >= 0) room.seats[k] = { kind: 'open', team: room.seats[k].team };
      this.system(room, `${name} left.`);
      this.roomChanged(room);
    }
    this.listChanged();
  }

  // The setup screen ----------------------------------------------------

  // Everything but the faction and color of the humans who joined is the
  // host's (spec 12, What each player chooses).
  on_setHost(conn, m) {
    const room = conn.room;
    if (!room || room.host !== conn) return;
    room.settings = cleanSettings(m.settings);
    const wanted = Array.isArray(m.seats) ? m.seats : [];
    room.seats.forEach((seat, i) => {
      const w = wanted[i] ?? {};
      if (TEAMS.includes(w.team)) seat.team = w.team;
      if (seat.kind === 'human') return; // a player's seat is theirs
      const kind = i === 0 ? seat.kind : pick(w.kind, ['empty', 'open', 'computer'], seat.kind);
      if (kind !== seat.kind) {
        room.seats[i] = { kind, team: seat.team };
        if (kind === 'computer') {
          // A computer gets a random free faction and color (spec 12).
          const others = room.seats.filter((s, k) => k !== i && (s.kind === 'human' || s.kind === 'computer'));
          Object.assign(room.seats[i], computerLooks(others, this.random), { personality: RANDOM });
        }
      }
      if (room.seats[i].kind === 'computer') {
        room.seats[i].personality = pick(w.personality, [RANDOM, ...PERSONALITIES.map((p) => p.id)], room.seats[i].personality);
        // A computer's faction and color are the host's too, once it has
        // its own (not in the message that adds it). A taken color gets a
        // random free one, as for a player.
        if (kind === seat.kind) {
          const f = index(w.faction, FACTIONS);
          if (f !== null) room.seats[i].faction = f;
          const c = index(w.color, COLORS);
          if (c !== null && c !== room.seats[i].color) {
            room.seats[i].color = claimColor(room.seats.map((s) => (s.kind === 'human' || s.kind === 'computer' ? s : {})), i, c, this.random);
          }
        }
      }
    });
    this.roomChanged(room);
    this.listChanged();
  }

  on_setMe(conn, m) {
    const room = conn.room;
    if (!room) return;
    const seat = room.seats[conn.seat];
    const f = index(m.faction, FACTIONS);
    if (f !== null) seat.faction = f;
    const c = index(m.color, COLORS);
    // Asking for a taken color gets a random free one. Messages are
    // handled one at a time, so of two asking at once, only the first
    // gets it.
    if (c !== null && c !== seat.color) seat.color = claimColor(room.seats.map((s) => (s.kind === 'human' || s.kind === 'computer' ? s : {})), conn.seat, c, this.random);
    this.roomChanged(room);
  }

  on_ready(conn, m) {
    const room = conn.room;
    if (!room) return;
    room.seats[conn.seat].ready = !!m.ready;
    this.roomChanged(room);
  }

  on_chat(conn, m) {
    const room = conn.room;
    const body = text(m.text, CHAT_MAX);
    if (!room || !body) return;
    const name = room.seats[conn.seat]?.name ?? conn.name;
    for (const s of room.seats) if (s.conn) this.send(s.conn, 'chat', { name, text: body });
  }

  system(room, line) {
    for (const s of room.seats) if (s.conn) this.send(s.conn, 'chat', { system: line });
  }

  // The players the setup would have, from the seats in use.
  players(room) {
    let k = 0;
    return room.seats.filter((s) => s.kind === 'human' || s.kind === 'computer').map((s) => {
      k++;
      return {
        name: s.kind === 'computer' ? `Computer ${k}` : s.name,
        faction: s.faction,
        color: s.color,
        team: s.team,
        computer: s.kind === 'computer',
        ...(s.kind === 'computer' ? { personality: s.personality } : {}),
      };
    });
  }

  problem(room) {
    if (room.seats.some((s) => s.kind === 'open')) return 'Waiting for players to join the open seats.';
    const map = MAPS.find((x) => x.name === room.settings.map) ?? null;
    const p = setupProblem({ ...room.settings, map, players: this.players(room) });
    if (p) return p;
    if (room.seats.some((s, i) => i > 0 && s.kind === 'human' && !s.ready)) return 'Waiting for everyone to be ready.';
    return null;
  }

  roomChanged(room) {
    const view = {
      id: room.id,
      name: room.name,
      settings: room.settings,
      seats: room.seats.map(({ conn, ...s }) => s),
      problem: this.problem(room),
    };
    room.seats.forEach((s, i) => {
      if (s.conn) this.send(s.conn, 'room', { room: view, you: i, host: i === 0 });
    });
  }

  // The host starts the game once everyone is ready (spec 12, Starting).
  on_start(conn) {
    const room = conn.room;
    if (!room || room.host !== conn) return;
    const problem = this.problem(room);
    if (problem) {
      this.send(conn, 'error', { reason: problem });
      return;
    }
    if (this.games.size >= this.limits.games) {
      this.send(conn, 'error', { reason: 'The server is running as many games as it can. Try again in a while.' });
      return;
    }
    // A game's map can take the server a moment to make.
    const t = this.now();
    for (const [address, at] of this.lastStart) if (t - at >= this.limits.startGapMs) this.lastStart.delete(address);
    if (conn.address !== null) {
      if (this.lastStart.has(conn.address)) {
        this.send(conn, 'error', { reason: 'Wait a few seconds before starting another game.' });
        return;
      }
      this.lastStart.set(conn.address, t);
    }
    // The random choices are made once, here, and everyone gets them
    // (spec 12, When the game starts).
    const map = room.settings.map === GENERATED
      ? generatedMap(room.settings.generator, this.random)
      : MAPS.find((x) => x.name === room.settings.map);
    const setup = rollSetup({ ...room.settings, map, players: this.players(room) }, this.random);
    const seats = room.seats.filter((s) => s.kind === 'human' || s.kind === 'computer');
    const conns = seats.map((s) => s.conn ?? null);
    this.rooms.delete(room.id);
    this.listChanged();
    let journal = null;
    if (this.store) {
      try {
        journal = this.store.start(randomBytes(8).toString('hex'), { rulesVersion: RULES_VERSION, name: room.name, setup, tokens: conns.map((c) => c?.token ?? null) });
      } catch (e) {
        console.error('a new game could not be written down; it won\'t survive a restart:', e.message);
      }
    }
    const game = new NetGame(setup, conns, { ...this.options, name: room.name, journal, onEnd: () => this.games.delete(game) });
    this.games.add(game);
    for (const c of conns) {
      if (!c) continue;
      c.room = null;
      c.seat = null;
    }
    game.begin();
  }

  // Taking up the games written down before the server restarted (D63).
  // A game made under other rules, or whose moves no longer play the same,
  // can't carry on: it ends, and its replay is kept as it was. Returns
  // { resumed, ended }: the names of the games, and for those that ended,
  // why.
  restoreGames() {
    const resumed = [];
    const ended = [];
    if (!this.store) return { resumed, ended };
    for (const saved of this.store.load()) {
      const journal = this.store.journal(saved.id);
      if (saved.problem) {
        ended.push({ name: saved.id, why: saved.problem });
        continue;
      }
      const { head, moves } = saved;
      const stop = (why) => {
        ended.push({ name: head.name, why });
        Promise.resolve(this.options.onReplay?.({ rulesVersion: head.rulesVersion, setup: head.setup, moves }, head.name))
          .then(() => journal.finish(), () => {});
      };
      if (head.rulesVersion !== RULES_VERSION) {
        stop(`it was played under rules version ${head.rulesVersion}, and the server now has ${RULES_VERSION}`);
        continue;
      }
      let game;
      try {
        game = NetGame.restore({ ...head, moves }, { ...this.options, journal, onEnd: () => this.games.delete(game) });
      } catch (e) {
        stop(e.message);
        continue;
      }
      this.games.add(game);
      resumed.push(head.name);
      game.carryOn();
    }
    return { resumed, ended };
  }
}

// A player's name in a game, told apart from the names already there:
// a repeat gets the lowest free number, as "Player 2" (decision D56).
export function uniqueName(name, taken) {
  if (!taken.includes(name)) return name;
  for (let k = 2; ; k++) {
    const numbered = `${name.slice(0, NAME_MAX - String(k).length - 1)} ${k}`;
    if (!taken.includes(numbered)) return numbered;
  }
}
