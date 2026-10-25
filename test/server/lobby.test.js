// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The online lobby, setup screen and games on the server (spec 12;
// decision D52), with stand-in connections and timers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lobby } from '../../src/server/lobby.js';
import { encode, NOT_RESPONDING_MS, DISCONNECT_MS, PING_MS } from '../../src/net/protocol.js';
import { createGame, applyMove, settle } from '../../src/rules/game.js';
import { hashState } from '../../src/rules/hash.js';

// Timers that run when the test says time has passed.
function clock() {
  let t = 0;
  let timers = [];
  const deferred = [];
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      const timer = { at: t + ms, fn };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      timers = timers.filter((x) => x !== timer);
    },
    defer: (fn) => deferred.push(fn),
    pass(ms) {
      const end = t + ms;
      for (;;) {
        while (deferred.length) deferred.shift()();
        const next = timers.filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        timers = timers.filter((x) => x !== next);
        t = next.at;
        next.fn();
      }
      t = end;
    },
  };
}

function client(lobby, name) {
  const got = [];
  const conn = lobby.connect((text) => got.push(JSON.parse(text)));
  const c = {
    conn,
    got,
    say: (t, fields) => lobby.receive(conn, encode(t, fields)),
    last: (t) => [...got].reverse().find((m) => m.t === t),
    all: (t) => got.filter((m) => m.t === t),
  };
  c.say('hello', { name });
  return c;
}

const SETTINGS = { map: 'Quiet Basin', clock: 30, wind: 0, fog: true };

function twoPlayers(options = {}) {
  const time = clock();
  const lobby = new Lobby({ ...time, random: () => 0.5, ...options });
  const host = client(lobby, 'Ana');
  const guest = client(lobby, 'Bo');
  guest.say('lobby');
  host.say('host', { name: 'Evening game', settings: SETTINGS, me: { faction: 1, color: 2 } });
  return { time, lobby, host, guest };
}

test('the lobby lists hosted games, and keeps the list current', () => {
  const { lobby, host, guest } = twoPlayers();
  const [game] = guest.last('games').games;
  assert.equal(game.name, 'Evening game');
  assert.equal(game.map, 'Quiet Basin');
  assert.deepEqual([game.joined, game.needed, game.clock, game.wind, game.fog], [1, 2, 30, 0, true]);
  guest.say('join', { room: game.id });
  const watcher = client(lobby, 'Cy');
  watcher.say('lobby');
  assert.equal(watcher.last('games').games[0].joined, 2);
  host.say('leave');
  assert.deepEqual(watcher.last('games').games, []);
  assert.equal(guest.last('closed').reason, 'The host closed the game.');
});

test('a full game can\'t be joined; a started one is gone from the list', () => {
  const { lobby, host, guest } = twoPlayers();
  const id = guest.last('games').games[0].id;
  guest.say('join', { room: id });
  const third = client(lobby, 'Cy');
  third.say('join', { room: id });
  assert.equal(third.last('error').reason, 'That game is full.');
  guest.say('ready', { ready: true });
  host.say('start');
  assert.ok(host.last('start') && guest.last('start'));
  third.say('lobby');
  assert.deepEqual(third.last('games').games, []);
  third.say('join', { room: id });
  assert.equal(third.last('error').reason, 'That game has started or closed.');
});

test('a player asking for a taken color gets a free one; only the host changes the settings', () => {
  const { host, guest } = twoPlayers();
  guest.say('join', { room: guest.last('games').games[0].id, me: { faction: 0, color: 2 } });
  const seats = guest.last('room').room.seats;
  assert.equal(seats[0].color, 2);
  assert.notEqual(seats[1].color, 2);
  guest.say('setMe', { color: 2, faction: 3 });
  assert.notEqual(guest.last('room').room.seats[1].color, 2);
  assert.equal(guest.last('room').room.seats[1].faction, 3);
  guest.say('setHost', { settings: { ...SETTINGS, clock: 15 }, seats: [] });
  assert.equal(guest.last('room').room.settings.clock, 30);
  host.say('setHost', { settings: { ...SETTINGS, clock: 15 }, seats: [{}, {}, { kind: 'computer', personality: 'random' }] });
  const room = guest.last('room').room;
  assert.equal(room.settings.clock, 15);
  assert.equal(room.seats[2].kind, 'computer');
  assert.ok(![room.seats[0].color, room.seats[1].color].includes(room.seats[2].color));
});

test('the host starts once everyone is ready', () => {
  const { host, guest } = twoPlayers();
  guest.say('join', { room: guest.last('games').games[0].id });
  host.say('start');
  assert.equal(host.last('error').reason, 'Waiting for everyone to be ready.');
  assert.equal(host.last('start'), undefined);
  guest.say('ready', { ready: true });
  assert.equal(host.last('room').room.problem, null);
  host.say('start');
  const a = host.last('start');
  const b = guest.last('start');
  // Everyone gets the same setup, rolled once.
  assert.deepEqual(a.setup, b.setup);
  assert.deepEqual([a.you, b.you], [0, 1]);
});

function started(options) {
  const t = twoPlayers(options);
  t.guest.say('join', { room: t.guest.last('games').games[0].id });
  t.guest.say('ready', { ready: true });
  t.host.say('start');
  t.setup = t.host.last('start').setup;
  return t;
}

test('moves go to everyone, numbered, only from the player whose turn it is', () => {
  const { host, guest, setup } = started();
  const local = createGame(setup);
  const first = local.state.turn.player;
  const [mover, other] = first === 0 ? [host, guest] : [guest, host];
  other.say('move', { move: { type: 'pass', player: 1 - first } });
  assert.match(other.last('refused').reason, /turn/);
  // A player can't move for another.
  other.say('move', { move: { type: 'pass', player: first } });
  assert.equal(host.all('move').length, 0);
  mover.say('move', { move: { type: 'pass', player: first } });
  assert.deepEqual(host.last('move'), guest.last('move'));
  assert.equal(host.last('move').n, 1);
  // Each machine plays it, and sends its state's hash.
  applyMove(local, host.last('move').move);
  settle(local);
  host.say('hash', { n: 1, hash: hashState(local.state) });
  assert.equal(host.last('desync'), undefined);
  guest.say('hash', { n: 1, hash: 'not it' });
  assert.equal(host.last('desync').n, 1);
});

test('chat goes only to the players who get it', () => {
  const { host, guest } = started();
  host.say('chat', { to: 'all', text: 'good luck' });
  assert.equal(guest.last('chat').text, 'good luck');
  host.say('chat', { to: 0, text: 'note to self' });
  assert.equal(guest.last('chat').text, 'good luck');
});

test('a silent player is warned about, then disconnected; one who quits is at once', () => {
  const { time, host, guest } = started();
  time.pass(NOT_RESPONDING_MS - PING_MS);
  host.say('ping');
  time.pass(PING_MS * 2);
  assert.deepEqual(host.last('presence'), { t: 'presence', player: 1, state: 'notResponding' });
  guest.say('ping');
  assert.equal(host.last('presence').state, 'back');
  for (let k = 0; k < DISCONNECT_MS / PING_MS + 2; k++) {
    host.say('ping');
    time.pass(PING_MS);
  }
  assert.deepEqual(host.all('move').map((m) => m.move).filter((m) => m.type === 'disconnect'), [{ type: 'disconnect', player: 1 }]);
});

test('a player who quits is disconnected at once, and the game goes on without them', () => {
  const { host, guest } = started();
  guest.say('quit');
  const move = host.last('move').move;
  assert.deepEqual(move, { type: 'disconnect', player: 1 });
  assert.equal(host.last('presence').state, 'gone');
});

test('a player who reconnects in time takes back their seat and gets the game so far', () => {
  const { lobby, host, guest, setup } = started();
  const first = createGame(setup).state.turn.player;
  const token = guest.last('welcome').token;
  lobby.close(guest.conn);
  // The game goes on meanwhile.
  if (first === 0) host.say('move', { move: { type: 'pass', player: first } });
  const again = client(lobby, 'Bo');
  lobby.receive(again.conn, encode('hello', { name: 'Bo', token }));
  const start = again.last('start');
  assert.equal(start.you, 1);
  assert.deepEqual(start.moves.length, first === 0 ? 1 : 0);
});

test('the server keeps a backstop on the shot clock', () => {
  const { time, host, setup } = started();
  const first = createGame(setup).state.turn.player;
  time.pass(5000);
  host.say('ping');
  time.pass(40000);
  const timeout = host.all('move').find((m) => m.move.type === 'timeout');
  assert.deepEqual(timeout?.move, { type: 'timeout', player: first });
});

test('the server thinks for computers, and sends their moves like anyone\'s', () => {
  const time = clock();
  const lobby = new Lobby({ ...time, random: () => 0.3 });
  const host = client(lobby, 'Ana');
  host.say('host', { name: 'Practice', settings: SETTINGS });
  host.say('setHost', { settings: SETTINGS, seats: [{}, { kind: 'computer', personality: 'random' }] });
  host.say('start');
  const { setup, you } = host.last('start');
  assert.equal(setup.players[1].computer, true);
  const game = createGame(setup);
  if (game.state.turn.player === you) host.say('move', { move: { type: 'pass', player: you } });
  time.pass(30000);
  const theirs = host.all('move').find((m) => m.move.player === 1);
  assert.ok(theirs, 'the computer moved');
});
