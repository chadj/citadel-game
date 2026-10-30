// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// An online game on this machine (spec 12, Every machine plays the same
// game; decision D52). Like a Session, it runs the whole game here, a
// tick at a time. But its moves come from the server, in order: this
// player's own moves go to the server first, and are played when they
// come back. After each move has played out, it sends the server its
// state's hash.
//
// Its own events, besides a Session's (all `client: true`):
//   presence  { player, state }  'notResponding', 'back' or 'gone'
//   chat      { message }        { from, to, text }, or { system }
//   desync    { n }              some machine's game differs

import { Session, COMPUTER_MIN_MS } from './session.js';
import { applyMove, settle } from '../../rules/game.js';
import { hashState } from '../../rules/hash.js';

export class NetSession extends Session {
  // `me` is this machine's player. `moves` are the game's moves so far,
  // when taking back a seat: it catches up at once, without playing out
  // every shot (spec 12, Rejoining).
  constructor(setup, { net, me, moves = [] }) {
    super(setup, {});
    this.online = true;
    this.net = net;
    this.me = me;
    this.viewer = me;
    this.presence = new Map();
    for (const move of moves) {
      const result = applyMove(this.game, move);
      if (!result.ok) throw new Error(`move ${this.moves.length + 1} doesn't play: ${result.reason}`);
      settle(this.game);
      this.moves.push(move);
    }
    this.seen = this.game.events.length;
    this.hashed = this.moves.length;
    if (moves.length > 0) this.sendHash();
    this.startTurn();
    this.queue = (net.takeEarly?.() ?? []).filter((m) => m.n > moves.length);
    this.unsubscribe = [
      net.on('move', (m) => this.queue.push(m)),
      net.on('refused', (m) => {
        this.sent = false;
        this.clockStopped = false;
        this.clientEvent({ type: 'refused', reason: m.reason, player: this.me });
      }),
      net.on('presence', (m) => {
        if (m.state === 'back') this.presence.delete(m.player);
        else this.presence.set(m.player, m.state);
        this.clientEvent({ type: 'presence', player: m.player, state: m.state });
      }),
      net.on('chat', (m) => this.clientEvent({ type: 'chat', message: m })),
      net.on('desync', (m) => this.clientEvent({ type: 'desync', n: m.n })),
    ];
  }

  close() {
    for (const off of this.unsubscribe) off();
  }

  // The screen never changes hands online.
  takesScreen() {
    return false;
  }

  // The game never pauses for the menu online.
  get paused() {
    return false;
  }

  canAct(player) {
    return player === this.me && !this.sent && super.canAct(player);
  }

  // A move of this player's goes to the server; it's played when it
  // comes back.
  play(move) {
    if (move.player !== this.me || this.sent) return { ok: false, reason: 'wait for your move to arrive' };
    this.sent = true;
    this.net.send('move', { move });
    return { ok: true, pending: true };
  }

  // A move from the server.
  playFromServer(move) {
    const result = applyMove(this.game, move);
    if (!result.ok) {
      // The server played it, so this machine's game differs.
      this.clientEvent({ type: 'desync', n: this.moves.length + 1 });
      console.error('a move from the server was refused here:', result.reason, move);
      return;
    }
    this.moves.push(move);
    if (move.player === this.me) this.sent = false;
    this.flush();
  }

  advance(ms) {
    const s = this.game.state;
    if (s.phase === 'turn' && this.queue.length > 0) {
      const { move } = this.queue[0];
      // A computer waits a moment when its turn starts, so players can
      // see whose turn it is (spec 09, Playing fair).
      const early = move.type !== 'disconnect' && this.isComputer(move.player) && this.waitMs < COMPUTER_MIN_MS;
      if (!early) {
        this.queue.shift();
        this.playFromServer(move);
      }
    }
    super.advance(ms);
    // Once a move has played out, its hash goes to the server.
    const phase = this.game.state.phase;
    if (this.moves.length > this.hashed && (phase === 'turn' || phase === 'over')) {
      this.hashed = this.moves.length;
      this.sendHash();
    }
  }

  sendHash() {
    this.net.send('hash', { n: this.moves.length, hash: hashState(this.game.state) });
  }

  // Each player's machine keeps their own clock; the others' show it too.
  advanceClock(ms) {
    if (this.sent) return; // a move is on its way
    if (this.game.state.turn.player === this.me) {
      super.advanceClock(ms);
      // The server's backstop goes by this machine's clock (D65).
      if (!this.clockTold && !this.sent && this.clock().running) {
        this.clockTold = true;
        this.tellClock('start');
      }
      return;
    }
    if (!this.clockStopped) this.turnMs += ms;
  }

  pressLaunch(player) {
    const mine = this.canAct(player);
    super.pressLaunch(player);
    if (mine) this.tellClock('press');
  }

  tellClock(at) {
    if (this.game.state.turn.limit !== null) this.net.send('clock', { n: this.moves.length, at });
  }

  // Computers think on the server.
  advanceComputer(ms) {
    this.waitMs += ms;
  }

  startTurn() {
    super.startTurn();
    this.sent = false;
    this.clockTold = false;
  }

  chat(to, text) {
    this.net.send('chat', { to, text });
  }

  quit() {
    this.net.send('quit');
    this.close();
  }
}
