// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Online games on the players' machines (spec 12, Every machine plays
// the same game, Rejoining; decision D52): two NetSessions and the
// server's NetGame, joined in-process.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NetSession } from '../../src/client/core/net-session.js';
import { NetGame } from '../../src/server/net-game.js';
import { encode, decode } from '../../src/net/protocol.js';
import { hashState } from '../../src/rules/hash.js';
import { citadelOf } from '../../src/rules/units.js';
import { makeSetup } from '../helpers/setups.js';

// A stand-in for the connection: messages go straight to the game, and
// come back through on().
function link(game, token) {
  const handlers = new Map();
  const net = {
    sent: [],
    send: (t, fields = {}) => {
      net.sent.push({ t, ...fields });
      game.receive(net.conn, decode(encode(t, fields)));
    },
    on: (t, fn) => {
      if (!handlers.has(t)) handlers.set(t, new Set());
      handlers.get(t).add(fn);
      return () => handlers.get(t).delete(fn);
    },
    got: [],
  };
  net.conn = {
    token,
    send: (text) => {
      const m = decode(text);
      net.got.push(m);
      for (const fn of handlers.get(m.t) ?? []) fn(m);
    },
  };
  return net;
}

function online(setup) {
  const timers = [];
  const game = new NetGame(setup, [], { setTimer: (fn) => timers.push(fn), clearTimer: () => {}, defer: () => {} });
  const nets = [link(game, 'a'), link(game, 'b')];
  game.seats = nets.map((net, i) => ({ conn: net.conn, token: net.conn.token, heard: 0, state: 'ok', player: i }));
  game.begin();
  const sessions = nets.map((net, i) => new NetSession(setup, { net, me: i }));
  const run = (ms) => {
    for (let t = 0; t < ms; t += 50) sessions.forEach((s) => s.advance(50));
  };
  return { game, nets, sessions, run };
}

test('a move goes to the server, and is played on every machine when it comes back', () => {
  const setup = makeSetup({ players: 2, clock: 0 });
  const { game, sessions, run } = online(setup);
  const first = sessions[0].state.turn.player;
  const mover = sessions[first];
  const other = sessions[1 - first];
  // The other player can't act.
  assert.equal(other.canAct(1 - first), false);
  const launcher = citadelOf(mover.state, first).id;
  const result = mover.launch({ player: first, launcher, item: 'shell', heading: 270, power: 0 });
  assert.deepEqual(result, { ok: true, pending: true });
  assert.equal(mover.canAct(first), false); // it's on its way
  assert.equal(game.moves.length, 1);
  run(15000);
  for (const s of sessions) {
    assert.equal(s.moves.length, 1);
    assert.equal(s.state.phase, 'turn');
    assert.equal(hashState(s.state), game.hashes[1]);
  }
  // Each machine told the server its hash, and they agreed.
  assert.equal(game.desynced, false);
});

test('a refused move comes back refused, and the player can try again', () => {
  const setup = makeSetup({ players: 2, clock: 0 });
  const { sessions } = online(setup);
  const first = sessions[0].state.turn.player;
  const mover = sessions[first];
  const refused = [];
  mover.on((e) => e.type === 'refused' && refused.push(e.reason));
  mover.launch({ player: first, launcher: 999, item: 'shell', heading: 0, power: 0 });
  assert.equal(refused.length, 1);
  assert.equal(mover.canAct(first), true);
});

test('a player taking back their seat catches up at once, and agrees with everyone', () => {
  const setup = makeSetup({ players: 2, clock: 0 });
  const { game, sessions, run } = online(setup);
  for (let k = 0; k < 3; k++) {
    const p = sessions[0].state.turn.player;
    sessions[p].pass(p);
    run(3000);
  }
  const caughtUp = new NetSession(setup, { net: link(game, 'b'), me: 1, moves: game.moves });
  assert.equal(caughtUp.moves.length, 3);
  assert.equal(hashState(caughtUp.state), game.hashes[3]);
  assert.equal(hashState(caughtUp.state), hashState(sessions[0].state));
});

test('the turn\'s player\'s own machine says when its time is up', () => {
  const setup = makeSetup({ players: 2, clock: 15 });
  const { game, sessions, run } = online(setup);
  const first = sessions[0].state.turn.player;
  run(20000);
  assert.deepEqual(game.moves[0], { type: 'timeout', player: first });
  assert.equal(sessions[1 - first].moves.length, 1);
});
