// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// An online game on the server (spec 12, Every machine plays the same
// game, Dropping out; decision D52). The server runs the game too: it
// checks each move with the rules, numbers it and sends it to everyone,
// and compares every machine's state hash with its own. It thinks for
// the computers, keeps a backstop on the shot clock, and notices players
// who go silent. When the game ends, it hands its replay to `onReplay`,
// which the server uses to keep every finished game's replay (D62).
//
// To survive the server restarting (D63), a game can have a `journal`
// that each move is written to before anyone is told of it, and
// `NetGame.restore` builds a game again from what was written.

import { encode } from '../net/protocol.js';
import { PING_MS, NOT_RESPONDING_MS, DISCONNECT_MS, CLOCK_GRACE_MS } from '../net/protocol.js';
import { createGame, applyMove, step } from '../rules/game.js';
import { hashState } from '../rules/hash.js';
import { RULES_VERSION } from '../rules/version.js';
import { CLOCK_START_DELAY } from '../rules/constants.js';
import { CHAT_MAX, receives } from '../client/core/chat.js';
import { brainsFor } from '../client/core/computers.js';
import { TICK_MS, ROUND_ANNOUNCE_MS, COMPUTER_MIN_MS, COMPUTER_LIMIT_MS } from '../client/core/session.js';
import { METER_FILL_TICKS } from '../client/core/meter.js';

const MAX_SETTLE_TICKS = 30 * 60 * 10;
// The longest Launch can be held: the meter runs up and down, then fires.
const METER_HOLD_MS = 2 * METER_FILL_TICKS * TICK_MS;
const MAX_PRESSES = 10; // a turn's presses that each hold the backstop
const THINK_SLICE_MS = 20;
const ENDED_KEEP_MS = 60000; // a finished game stays a minute, for late hashes

export class NetGame {
  // `conns` has a connection for each human player, null for computers.
  // `name` is the game's name, for its replay. `journal` is
  // { move(move), finish() }, or null.
  constructor(setup, conns, { now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, defer = setImmediate, onEnd = () => {}, onReplay = () => {}, name = '', journal = null, think = true } = {}) {
    this.setup = setup;
    this.name = name;
    this.onReplay = onReplay;
    this.journal = journal;
    this.game = createGame(setup);
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.defer = defer;
    this.onEnd = onEnd;
    this.moves = [];
    this.hashes = [hashState(this.game.state)];
    this.brains = think ? brainsFor(setup) : {};
    for (const b of Object.values(this.brains)) b.observe?.(this.game);
    this.seats = conns.map((conn, i) => (conn ? { conn, token: conn.token, heard: now(), state: 'ok', player: i } : null));
    this.desynced = false;
    this.ended = false;
  }

  // A game written down before the server restarted (D63): `saved` is
  // { setup, name, tokens, moves }. Its moves are played again here, the
  // computers watching as they did, and it carries on from where it was
  // once `carryOn()` is called. No one is connected yet: each human
  // takes their seat back with their token, and has the usual two
  // minutes to come back before they're disconnected. Throws if a move
  // doesn't play again (the rules have changed).
  static restore(saved, options) {
    const stand = (token) => (token ? { token, send() {}, game: null } : null);
    const game = new NetGame(saved.setup, saved.tokens.map(stand), { ...options, name: saved.name });
    for (const s of game.seats) if (s) s.conn.game = game;
    saved.moves.forEach((move, k) => {
      const result = applyMove(game.game, move);
      if (!result.ok) throw new Error(`move ${k + 1} doesn't play again: ${result.reason}`);
      game.moves.push(move);
      game.settle();
      game.hashes.push(hashState(game.game.state));
      for (const b of Object.values(game.brains)) b.observe?.(game.game);
    });
    game.seats.forEach((seat, i) => {
      if (seat && game.game.state.players[i].disconnected) seat.state = 'gone';
    });
    return game;
  }

  // Carries on a restored game. The turn under way starts again, with
  // its full shot clock: no one could play while the server was away.
  carryOn() {
    this.watch = this.setTimer(() => this.checkPresence(), PING_MS);
    this.nextTurn(0);
  }

  begin() {
    this.seats.forEach((seat) => {
      if (!seat) return;
      seat.conn.game = this;
      seat.conn.player = seat.player;
      this.sendTo(seat.player, 'start', { setup: this.setup, you: seat.player, moves: [] });
    });
    this.watch = this.setTimer(() => this.checkPresence(), PING_MS);
    this.nextTurn(0);
  }

  sendTo(player, t, fields) {
    const seat = this.seats[player];
    if (seat?.conn && seat.state !== 'gone') seat.conn.send(encode(t, fields));
  }

  broadcast(t, fields) {
    this.seats.forEach((seat, i) => seat && this.sendTo(i, t, fields));
  }

  seatOf(conn) {
    return this.seats.find((s) => s && s.conn === conn) ?? null;
  }

  receive(conn, m) {
    const seat = this.seatOf(conn);
    if (!seat || seat.state === 'gone') return;
    this.heard(seat);
    switch (m.t) {
      case 'move':
        this.fromPlayer(seat, m.move);
        break;
      case 'hash':
        this.checkHash(seat, m.n, m.hash);
        break;
      case 'clock':
        this.clockFrom(seat, m);
        break;
      case 'chat':
        this.chat(seat, m);
        break;
      case 'quit':
        // A player who quits is disconnected at once (spec 12).
        this.disconnect(seat.player);
        break;
      default:
        break;
    }
  }

  // Moves ---------------------------------------------------------------

  // A move only counts if it's from the player whose turn it is (spec
  // 12). A player can only move for themselves.
  fromPlayer(seat, move) {
    if (!move || typeof move !== 'object' || !['launch', 'pass', 'timeout'].includes(move.type)) return;
    if (move.player !== seat.player) return;
    const clean = move.type === 'launch'
      ? { type: 'launch', player: move.player, launcher: move.launcher, item: move.item, heading: move.heading, power: move.power, override: !!move.override }
      : { type: move.type, player: move.player };
    const result = this.play(clean);
    if (!result.ok) this.sendTo(seat.player, 'refused', { reason: result.reason });
  }

  // Plays a move here, and sends it to everyone.
  play(move) {
    if (this.ended) return { ok: false, reason: 'the game is over' };
    const result = applyMove(this.game, move);
    if (!result.ok) return result;
    const n = this.moves.length + 1;
    this.moves.push(move);
    // On disk before anyone is told (D63). If it can't be written, the
    // game goes on, but won't survive a restart.
    try {
      this.journal?.move(move);
    } catch (e) {
      console.error('a move could not be written down:', e.message);
      this.journal = null;
    }
    const before = this.game.events.length;
    const ticks = this.settle();
    this.hashes.push(hashState(this.game.state));
    this.broadcast('move', { n, move });
    for (const b of Object.values(this.brains)) b.observe?.(this.game);
    // How long the others take to show the move: the flight, and the
    // pause after each round's end.
    const rounds = this.game.events.slice(before).filter((e) => e.type === 'roundOver').length;
    this.nextTurn(ticks * TICK_MS + rounds * ROUND_ANNOUNCE_MS);
    return result;
  }

  settle() {
    let ticks = 0;
    while (this.game.state.phase === 'flight' || this.game.state.phase === 'rovers') {
      if (ticks >= MAX_SETTLE_TICKS) throw new Error('the turn never settled');
      step(this.game);
      for (const b of Object.values(this.brains)) b.watch?.(this.game);
      ticks++;
    }
    return ticks;
  }

  // After a move: the game is over, or the next turn starts on each
  // screen about `showMs` from now.
  nextTurn(showMs) {
    this.clearTimer(this.clockTimer);
    this.backstop = null;
    this.thinking = null;
    const s = this.game.state;
    if (s.phase === 'over') {
      this.end();
      return;
    }
    const player = s.turn.player;
    const n = this.moves.length;
    if (this.setup.players[player].computer) {
      this.think(player, n);
      return;
    }
    // The turn's player's machine says when time is up; this is only a
    // backstop, in case it never does (spec 12: the shot clock must be
    // fair, so a slow connection gets the benefit).
    if (s.turn.limit !== null) {
      const at = this.now() + showMs + CLOCK_START_DELAY + s.turn.limit + CLOCK_GRACE_MS;
      this.backstop = { player, n, limit: s.turn.limit, at, latest: at + DISCONNECT_MS, started: false, presses: 0 };
      this.armBackstop();
    }
  }

  armBackstop() {
    const b = this.backstop;
    this.clearTimer(this.clockTimer);
    this.clockTimer = this.setTimer(() => {
      if (this.moves.length === b.n && this.game.state.turn.player === b.player) this.play({ type: 'timeout', player: b.player });
    }, Math.max(0, b.at - this.now()));
  }

  // The turn's player's machine says when its clock started, and when
  // Launch was pressed, which stops it (spec 03, The shot clock;
  // decision D65). The backstop then goes by that machine's clock, not
  // by when the turn should have shown there: a phone that fell behind
  // (in the background, say) isn't cut short. It only ever moves later,
  // and no more than a disconnection's wait.
  clockFrom(seat, m) {
    const b = this.backstop;
    if (!b || seat.player !== b.player || m.n !== this.moves.length) return;
    if (m.at === 'start' && !b.started) {
      b.started = true;
      b.at = Math.min(b.latest, Math.max(b.at, this.now() + b.limit + CLOCK_GRACE_MS));
    } else if (m.at === 'press' && b.presses < MAX_PRESSES) {
      // A press holds the clock for as long as the meter can run.
      b.presses += 1;
      b.at = Math.min(b.latest, b.at + METER_HOLD_MS);
    } else {
      return;
    }
    this.armBackstop();
  }

  // Only the server thinks for each computer (spec 12, Computers). It
  // thinks in slices, so other games carry on meanwhile.
  think(player, n) {
    const brain = this.brains[player];
    const started = this.now();
    const thinker = brain?.begin ? brain.begin(this.game, player) : null;
    const job = {};
    this.thinking = job;
    const slice = () => {
      if (this.thinking !== job || this.ended || this.moves.length !== n) return;
      let move = null;
      if (!brain) move = { type: 'pass', player };
      else if (!thinker) move = brain.think(this.game, player);
      else {
        move = thinker.work(THINK_SLICE_MS);
        if (!move && this.now() - started >= COMPUTER_LIMIT_MS - COMPUTER_MIN_MS) move = thinker.best();
      }
      if (!move) {
        this.defer(slice);
        return;
      }
      this.thinking = null;
      // A computer whose move is refused passes, so the game goes on.
      if (!this.play(move).ok) this.play({ type: 'pass', player });
    };
    this.defer(slice);
  }

  // Determinism checks (spec 12): every machine's state after each move
  // must be the server's.
  checkHash(seat, n, hash) {
    if (!Number.isInteger(n) || n < 0 || n >= this.hashes.length) return;
    if (this.hashes[n] === hash) return;
    if (!this.desynced) console.warn(`game state differs: player ${seat.player} after move ${n}`);
    this.desynced = true;
    this.broadcast('desync', { n, player: seat.player });
  }

  chat(seat, m) {
    const text = typeof m.text === 'string' ? m.text.trim().slice(0, CHAT_MAX) : '';
    if (!text) return;
    const to = m.to === 'all' || m.to === 'team' ? m.to : Number.isInteger(m.to) && this.setup.players[m.to] ? m.to : 'all';
    const message = { from: seat.player, to, text };
    this.seats.forEach((s, i) => {
      if (s && receives(message, i, this.setup.players, this.game.sides)) this.sendTo(i, 'chat', message);
    });
  }

  // Losing touch (spec 12) ---------------------------------------------

  heard(seat) {
    seat.heard = this.now();
    if (seat.state === 'notResponding') {
      seat.state = 'ok';
      this.broadcast('presence', { player: seat.player, state: 'back' });
    }
  }

  checkPresence() {
    if (this.ended) return;
    const t = this.now();
    for (const seat of this.seats) {
      if (!seat || seat.state === 'gone') continue;
      const silent = t - seat.heard;
      if (silent >= DISCONNECT_MS) this.disconnect(seat.player);
      else if (silent >= NOT_RESPONDING_MS && seat.state === 'ok') {
        seat.state = 'notResponding';
        this.broadcast('presence', { player: seat.player, state: 'notResponding' });
      }
    }
    if (!this.ended) this.watch = this.setTimer(() => this.checkPresence(), PING_MS);
  }

  // The socket closed: the player goes silent, and may come back.
  lostSocket(conn) {
    const seat = this.seatOf(conn);
    if (seat) seat.conn = { send() {}, game: this };
  }

  disconnect(player) {
    const seat = this.seats[player];
    if (!seat || seat.state === 'gone') return;
    seat.state = 'gone';
    seat.conn.game = null;
    this.broadcast('presence', { player, state: 'gone' });
    // A disconnect is a move, so every machine, and the replay, has it
    // at the same point.
    if (!this.ended && !this.game.state.players[player].disconnected) {
      this.thinking = null;
      this.play({ type: 'disconnect', player });
    }
  }

  // A player who reconnects before they're disconnected carries on: they
  // get the game so far, and catch up at once (spec 12, Rejoining).
  resume(conn, token) {
    const seat = this.seats.find((s) => s && s.token === token);
    if (!seat || seat.state === 'gone' || this.ended) return false;
    seat.conn.game = null;
    seat.conn = conn;
    conn.game = this;
    conn.player = seat.player;
    const was = seat.state;
    seat.heard = this.now();
    seat.state = 'ok';
    this.sendTo(seat.player, 'start', { setup: this.setup, you: seat.player, moves: this.moves });
    if (was === 'notResponding') this.broadcast('presence', { player: seat.player, state: 'back' });
    return true;
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.clearTimer(this.clockTimer);
    // The replay is the setup and every move that counted, disconnects
    // included: what a player saves from the summary (spec 12, Saving a
    // replay). Keeping it mustn't stop the game ending.
    // The game's file goes once its replay is kept; if that fails, the
    // file stays, and the replay is kept when the server next starts.
    try {
      Promise.resolve(this.onReplay({ rulesVersion: RULES_VERSION, setup: this.setup, moves: this.moves.slice() }, this.name))
        .then(() => this.journal?.finish(), () => {})
        .catch((e) => console.error('a finished game\'s file could not be removed:', e.message));
    } catch (e) {
      console.error('the replay could not be kept:', e);
    }
    this.setTimer(() => {
      this.clearTimer(this.watch);
      for (const s of this.seats) if (s?.conn?.game === this) s.conn.game = null;
      this.onEnd();
    }, ENDED_KEEP_MS);
  }
}
