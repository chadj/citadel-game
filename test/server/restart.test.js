// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Online games surviving the server restarting (decision D63): written
// down as they're played, taken up again by a new lobby, and each
// player taking back their seat.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Lobby } from '../../src/server/lobby.js';
import { gameStore } from '../../src/server/game-store.js';
import { encode, DISCONNECT_MS } from '../../src/net/protocol.js';
import { createGame, applyMove, settle } from '../../src/rules/game.js';
import { hashState } from '../../src/rules/hash.js';
import { RULES_VERSION } from '../../src/rules/version.js';

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

function client(lobby, name, token = null) {
  const got = [];
  const conn = lobby.connect((text) => got.push(JSON.parse(text)));
  const c = {
    conn,
    got,
    say: (t, fields) => lobby.receive(conn, encode(t, fields)),
    last: (t) => [...got].reverse().find((m) => m.t === t),
    all: (t) => got.filter((m) => m.t === t),
  };
  c.say('hello', { name, token });
  return c;
}

const SETTINGS = { map: 'Quiet Basin', clock: 30, wind: 0, fog: true };

// A server's lobby, with games written down in `dir`.
function server(dir, kept = []) {
  const time = clock();
  const lobby = new Lobby({ ...time, random: () => 0.5, think: false, store: gameStore(dir), onReplay: (replay, name) => kept.push({ replay, name }) });
  return { time, lobby, kept };
}

// Two players start a game, and the first player passes.
function startedOn(dir) {
  const s = server(dir);
  const host = client(s.lobby, 'Ana');
  const guest = client(s.lobby, 'Bo');
  host.say('host', { name: 'Evening game', settings: SETTINGS, me: { faction: 1, color: 2 } });
  guest.say('lobby');
  guest.say('join', { room: guest.last('games').games[0].id });
  guest.say('ready', { ready: true });
  host.say('start');
  const setup = host.last('start').setup;
  const first = createGame(setup).state.turn.player;
  const players = [host, guest];
  players[first].say('move', { move: { type: 'pass', player: first } });
  return { ...s, host, guest, setup, first, players, tokens: [host.last('welcome').token, guest.last('welcome').token] };
}

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'lunar-citadel-games-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a game under way is written down, move by move, and carries on after a restart', () => withDir((dir) => {
  const before = startedOn(dir);
  const [file] = readdirSync(dir);
  const lines = readFileSync(join(dir, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].format, 'lunar-citadel-game');
  assert.equal(lines[0].rulesVersion, RULES_VERSION);
  assert.deepEqual(lines[0].tokens, before.tokens);
  assert.deepEqual(lines.slice(1), [{ type: 'pass', player: before.first }]);

  // The server restarts: a new lobby, from what was written.
  const after = server(dir);
  assert.deepEqual(after.lobby.restoreGames(), { resumed: ['Evening game'], ended: [] });
  // Each player takes back their seat with their token, and gets the
  // game so far.
  const host = client(after.lobby, 'Ana', before.tokens[0]);
  const guest = client(after.lobby, 'Bo', before.tokens[1]);
  assert.equal(host.last('welcome'), undefined);
  for (const [k, c] of [[0, host], [1, guest]]) {
    const start = c.last('start');
    assert.equal(start.you, k);
    assert.deepEqual(start.setup, before.setup);
    assert.deepEqual(start.moves, [{ type: 'pass', player: before.first }]);
  }
  // The game goes on, the same on every machine, and the next move is
  // written down too.
  const local = createGame(before.setup);
  applyMove(local, { type: 'pass', player: before.first });
  settle(local);
  const next = local.state.turn.player;
  [host, guest][next].say('move', { move: { type: 'pass', player: next } });
  assert.equal(host.last('move').n, 2);
  applyMove(local, { type: 'pass', player: next });
  settle(local);
  guest.say('hash', { n: 2, hash: hashState(local.state) });
  assert.equal(guest.last('desync'), undefined);
  assert.equal(readFileSync(join(dir, file), 'utf8').trim().split('\n').length, 3);
}));

test('after a restart, a player who doesn\'t come back is disconnected in the usual time', () => withDir((dir) => {
  const before = startedOn(dir);
  const after = server(dir);
  after.lobby.restoreGames();
  const host = client(after.lobby, 'Ana', before.tokens[0]);
  after.time.pass(DISCONNECT_MS - 10000);
  host.say('ping');
  assert.equal(host.all('presence').filter((m) => m.state === 'gone').length, 0);
  after.time.pass(20000);
  assert.deepEqual(host.last('presence'), { t: 'presence', player: 1, state: 'gone' });
  assert.deepEqual(host.last('move').move, { type: 'disconnect', player: 1 });
}));

test('a finished game\'s file goes once its replay is kept', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lunar-citadel-games-'));
  try {
    const { host, guest, kept } = startedOn(dir);
    guest.say('quit');
    host.say('quit');
    assert.equal(kept.length, 1);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a game from other rules isn\'t carried on: it ends, and its replay is kept as it was', () => withDir((dir) => {
  const before = startedOn(dir);
  const [file] = readdirSync(dir);
  const lines = readFileSync(join(dir, file), 'utf8').trim().split('\n');
  const head = { ...JSON.parse(lines[0]), rulesVersion: RULES_VERSION - 1 };
  writeFileSync(join(dir, file), [JSON.stringify(head), ...lines.slice(1)].join('\n') + '\n');
  const after = server(dir);
  const { resumed, ended } = after.lobby.restoreGames();
  assert.deepEqual(resumed, []);
  assert.equal(ended[0].name, 'Evening game');
  assert.match(ended[0].why, /rules version/);
  assert.equal(after.kept[0].replay.rulesVersion, RULES_VERSION - 1);
  assert.deepEqual(after.kept[0].replay.moves, [{ type: 'pass', player: before.first }]);
  // Its players aren't given a seat: they're welcomed afresh.
  const host = client(after.lobby, 'Ana', before.tokens[0]);
  assert.ok(host.last('welcome'));
}));

test('a move cut short as the server stopped is left out; a game whose moves no longer play ends', () => withDir((dir) => {
  const before = startedOn(dir);
  const [file] = readdirSync(dir);
  appendFileSync(join(dir, file), '{"type":"pa');
  const after = server(dir);
  assert.deepEqual(after.lobby.restoreGames().resumed, ['Evening game']);
  const host = client(after.lobby, 'Ana', before.tokens[0]);
  assert.equal(host.last('start').moves.length, 1);

  // A move the rules refuse (as if they'd changed without a new version).
  const dir2 = join(dir, 'other');
  const again = startedOn(dir2);
  const [file2] = readdirSync(dir2);
  appendFileSync(join(dir2, file2), `${JSON.stringify({ type: 'pass', player: again.first })}\n`);
  const later = server(dir2);
  const { resumed, ended } = later.lobby.restoreGames();
  assert.deepEqual(resumed, []);
  assert.match(ended[0].why, /doesn't play again/);
  assert.equal(later.kept.length, 1);
}));
