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
import { playReplay } from '../../src/rules/replay.js';
import { RULES_VERSION } from '../../src/rules/version.js';
import { replayKeeper } from '../../src/server/replay-files.js';
import { replayFromText } from '../../src/client/core/replay-store.js';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

test('the host chooses a computer\'s faction and color; a taken color gets a free one', () => {
  const { host, guest } = twoPlayers();
  guest.say('join', { room: guest.last('games').games[0].id, me: { faction: 0, color: 3 } });
  host.say('setHost', { settings: SETTINGS, seats: [{}, {}, { kind: 'computer', personality: 'random' }] });
  const added = host.last('room').room.seats[2];
  const free = [0, 1, 4, 5].find((c) => c !== added.color);
  host.say('setHost', { settings: SETTINGS, seats: [{}, {}, { kind: 'computer', personality: 'random', faction: 2, color: free }] });
  let seats = guest.last('room').room.seats;
  assert.deepEqual([seats[2].faction, seats[2].color], [2, free]);
  // The guest's color is taken: the computer gets a free one instead.
  host.say('setHost', { settings: SETTINGS, seats: [{}, {}, { kind: 'computer', personality: 'random', faction: 2, color: 3 }] });
  seats = guest.last('room').room.seats;
  assert.ok(![seats[0].color, seats[1].color].includes(seats[2].color));
  // Only the host: a guest's message changes nothing.
  guest.say('setHost', { settings: SETTINGS, seats: [{}, {}, { kind: 'computer', faction: 0, color: 0 }] });
  assert.equal(guest.last('room').room.seats[2].faction, 2);
});

test('a name already in the game gets a number, in the seats, the chat and the game', () => {
  const time = clock();
  const lobby = new Lobby({ ...time, random: () => 0.5 });
  const host = client(lobby, 'Player');
  const guest = client(lobby, 'Player');
  host.say('host', { name: 'Same names', settings: SETTINGS, me: {} });
  guest.say('lobby');
  guest.say('join', { room: guest.last('games').games[0].id, me: {} });
  assert.deepEqual(guest.last('room').room.seats.slice(0, 2).map((x) => x.name), ['Player', 'Player 2']);
  assert.ok(host.all('chat').some((m) => m.system === 'Player 2 joined.'));
  guest.say('chat', { text: 'hi' });
  assert.equal(host.last('chat').name, 'Player 2');
  guest.say('ready', { ready: true });
  host.say('start');
  assert.deepEqual(guest.last('start').setup.players.map((p) => p.name), ['Player', 'Player 2']);
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

test('a launch with fields of the wrong kind is refused, and nothing is played', () => {
  const t = started();
  const local = createGame(t.setup);
  const first = local.state.turn.player;
  const mover = first === 0 ? t.host : t.guest;
  const launcher = local.state.units.find((u) => u.owner === first).id;
  const launch = { type: 'launch', player: first, launcher, item: 'shell', heading: 10, power: 500 };
  for (const odd of [{ item: 'toString' }, { item: ['shell'] }, { launcher: String(launcher) }, { heading: '10' }, { power: null }]) {
    mover.say('move', { move: { ...launch, ...odd } });
    assert.ok(mover.last('refused'), JSON.stringify(odd));
    mover.got.length = 0;
  }
  // The game goes on: the player's silence later is only a disconnect.
  t.time.pass(DISCONNECT_MS + 2 * PING_MS);
  assert.equal(t.host.all('move').length + t.guest.all('move').length > 0, true);
  assert.equal((first === 0 ? t.guest : t.host).last('move').move.type, 'disconnect');
});

test('an error in a game stops that game alone, and its replay is kept', () => {
  const kept = [];
  const t = started({ onReplay: (replay) => kept.push(replay) });
  const game = [...t.lobby.games][0];
  const first = game.game.state.turn.player;
  const mover = first === 0 ? t.host : t.guest;
  game.settle = () => {
    throw new Error('a bug');
  };
  const quiet = console.error;
  console.error = () => {};
  try {
    mover.say('move', { move: { type: 'pass', player: first } });
    assert.match(t.host.last('chat').system, /stopped this game/);
    assert.match(t.guest.last('chat').system, /stopped this game/);
    assert.equal(kept.length, 1);
    // Nothing more happens in it, and its timers don't throw.
    mover.say('move', { move: { type: 'pass', player: 1 - first } });
    t.time.pass(DISCONNECT_MS + 2 * PING_MS);
  } finally {
    console.error = quiet;
  }
  assert.equal(t.host.all('move').length, 0);
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

// The turn's player, and the other player.
function turnOf({ host, guest, setup }) {
  const first = createGame(setup).state.turn.player;
  return { first, mover: first === 0 ? host : guest, other: first === 0 ? guest : host };
}
const timedOut = (c) => c.all('move').some((m) => m.move.type === 'timeout');

test('the backstop goes by the player\'s own clock, so a machine that fell behind isn\'t cut short (D65)', () => {
  const t = started();
  const { mover, other } = turnOf(t);
  // The turn shows late on the player's machine (it was in the
  // background, say): its clock starts 30 s after the server expected.
  t.time.pass(31500);
  mover.say('clock', { n: 0, at: 'start' });
  other.say('ping');
  // The usual backstop (1.5 + 33 + 10 s) has passed; this one hasn't.
  t.time.pass(40000);
  mover.say('ping');
  other.say('ping');
  assert.equal(timedOut(t.host), false);
  // 33 s of the player's clock, and 10 s of grace.
  t.time.pass(3500);
  assert.equal(timedOut(t.host), true);
});

test('pressing Launch holds the backstop for as long as the meter can run (D65)', () => {
  const t = started();
  const { mover } = turnOf(t);
  t.time.pass(44000);
  mover.say('clock', { n: 0, at: 'press' });
  // The usual backstop (44.5 s), plus about 2.5 s.
  t.time.pass(2500);
  assert.equal(timedOut(t.host), false);
  t.time.pass(1000);
  assert.equal(timedOut(t.host), true);
});

test('a clock message never brings the backstop forward, and only the turn\'s player\'s counts (D65)', () => {
  const t = started();
  const { mover, other } = turnOf(t);
  mover.say('clock', { n: 0, at: 'start' }); // early: no change
  other.say('clock', { n: 0, at: 'press' }); // not their turn
  mover.say('clock', { n: 5, at: 'press' }); // not this turn
  t.time.pass(44000);
  assert.equal(timedOut(t.host), false);
  t.time.pass(1000);
  assert.equal(timedOut(t.host), true);
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

test('a finished game hands over its replay, which plays back to the same end', () => {
  const kept = [];
  const { host, guest, setup } = started({ onReplay: (replay, name) => kept.push({ replay, name }) });
  const first = createGame(setup).state.turn.player;
  (first === 0 ? host : guest).say('move', { move: { type: 'pass', player: first } });
  assert.equal(kept.length, 0, 'not before the game ends');
  // A player who quits leaves their side in play; with no one
  // connected left, the game ends.
  guest.say('quit');
  assert.equal(kept.length, 0);
  host.say('quit');
  assert.equal(kept.length, 1);
  const { replay, name } = kept[0];
  assert.equal(name, 'Evening game');
  assert.deepEqual(replay.setup, setup);
  assert.deepEqual(replay.moves.slice(-2), [{ type: 'disconnect', player: 1 }, { type: 'disconnect', player: 0 }]);
  assert.equal(playReplay(replay).game.state.phase, 'over');
});

test('kept replays are files the Replays screen opens, and never overwrite each other', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lunar-citadel-replays-'));
  try {
    const keep = replayKeeper(join(dir, 'replays'), { now: () => new Date(2026, 9, 28, 20, 15, 0) });
    const replay = { rulesVersion: RULES_VERSION, setup: { players: [{ name: 'Ana' }, { name: 'Bo' }] }, moves: [] };
    await keep(replay, 'Evening game');
    await keep(replay, 'Evening game');
    await keep(replay, '');
    const names = (await readdir(join(dir, 'replays'))).sort();
    assert.deepEqual(names, [
      'Ana vs Bo 2026-10-28 20-15-00.lcreplay.json',
      'Evening game 2026-10-28 20-15-00 2.lcreplay.json',
      'Evening game 2026-10-28 20-15-00.lcreplay.json',
    ]);
    const text = await readFile(join(dir, 'replays', names[2]), 'utf8');
    assert.equal(JSON.parse(text).format, 'lunar-citadel-replay');
    assert.deepEqual(replayFromText(text), { ok: true, replay });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
