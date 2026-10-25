// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Rolling a game's setup, chat routing, keys and preferences (spec 10,
// Chat, Keys, Options; spec 12, Setting up a game, When the game
// starts; decision D16).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../../src/client/core/maps.js';
import {
  rollSetup, rollStarts, rollOrder, teamLayout, computerLooks, claimColor,
} from '../../src/client/core/newgame.js';
import { routeChat, receives, chatLine, CHAT_MAX } from '../../src/client/core/chat.js';
import { rebind, actionFor, DEFAULT_KEYS } from '../../src/client/core/keys.js';
import { loadPrefs, savePrefs, mergePrefs, defaultPrefs } from '../../src/client/core/prefs.js';
import { createGame } from '../../src/rules/game.js';
import { checkSetup } from '../../src/rules/setup.js';
import { sampleTerrain } from '../../src/rules/terrain/terrain.js';
import { loadMap } from '../../src/rules/terrain/map.js';
import { FLAT, PX } from '../../src/rules/constants.js';
import { seededRandom } from '../helpers/setups.js';

const person = (name, team = null, computer = false) => ({ name, faction: 0, color: 0, team, computer });
const colored = (list) => list.map((p, i) => ({ ...p, color: i }));

test('every map loads, and its start positions are on flat ground for every layout', () => {
  for (const m of MAPS) {
    const map = loadMap({ ...m, starts: undefined });
    for (const byLayout of Object.values(m.starts)) {
      for (const groups of Object.values(byLayout)) {
        for (const p of groups.flat()) assert.equal(sampleTerrain(map, p.x * PX, p.y * PX).type, FLAT, `${m.name} ${p.x},${p.y}`);
      }
    }
  }
});

test('a rolled setup is valid and starts a game, for every player count and team layout', () => {
  const random = seededRandom(3);
  const layouts = [
    [person('a'), person('b')],
    [person('a'), person('b'), person('c')],
    [person('a'), person('b', 'x'), person('c', 'x')],
    [person('a'), person('b'), person('c'), person('d')],
    [person('a', 'x'), person('b', 'x'), person('c', 'y'), person('d', 'y')],
    [person('a'), person('b', 'x'), person('c', 'x'), person('d', 'x', true)],
  ];
  for (const players of layouts) {
    const setup = rollSetup({ map: MAPS[0], players: colored(players), clock: 30, wind: 2, fog: true }, random);
    checkSetup(setup);
    const game = createGame(setup);
    assert.equal(game.state.units.length, players.length);
  }
});

test('teammates get one group of starts; teams of two alternate in the order of play', () => {
  const players = colored([person('a', 'x'), person('b', 'y'), person('c', 'x'), person('d', 'y')]);
  assert.equal(teamLayout(players), '2+2');
  for (let seed = 0; seed < 20; seed++) {
    const random = seededRandom(seed);
    const starts = rollStarts(MAPS[0], players, random);
    // Group 1 is the top two corners, group 2 the bottom two.
    assert.equal(starts[0].y, starts[2].y);
    assert.equal(starts[1].y, starts[3].y);
    const order = rollOrder(players, random);
    for (let k = 0; k < 4; k++) assert.notEqual(players[order[k]].team, players[order[(k + 1) % 4]].team);
  }
});

test('a computer gets a free faction if there is one, and a free color', () => {
  const players = [{ faction: 0, color: 0 }, { faction: 1, color: 1 }];
  for (let seed = 0; seed < 10; seed++) {
    const looks = computerLooks(players, seededRandom(seed));
    assert.ok(looks.faction >= 2 && looks.color >= 2);
  }
  // A color someone else has gives a random free one instead.
  assert.equal(claimColor(players, 1, 1, seededRandom(1)), 1);
  assert.ok(claimColor(players, 1, 0, seededRandom(1)) >= 2);
});

test('chat goes to everyone, the team or one player, by prefix; a prefix that matches nobody is just text', () => {
  const players = [person('Alice', 'x'), person('Bob', 'x'), person('Bea'), person('Cy', null, true)];
  const sides = [0, 0, 2, 3];
  assert.deepEqual(routeChat('hello', 0, players, sides), { to: 'all', text: 'hello' });
  assert.deepEqual(routeChat('/team go left', 0, players, sides), { to: 'team', text: 'go left' });
  assert.deepEqual(routeChat('@bo hi', 0, players, sides), { to: 1, text: 'hi' });
  assert.deepEqual(routeChat('@b hi', 0, players, sides), { to: 'all', text: '@b hi' }, 'two players match');
  assert.deepEqual(routeChat('@zed hi', 0, players, sides), { to: 'all', text: '@zed hi' });
  assert.deepEqual(routeChat('@cy hi', 0, players, sides), { to: 'all', text: '@cy hi' }, 'computers get no messages');
  assert.equal(routeChat('x'.repeat(500), 0, players, sides).text.length, CHAT_MAX);

  const team = { from: 0, to: 'team', text: 'go' };
  assert.ok(receives(team, 1, players, sides));
  assert.ok(!receives(team, 2, players, sides));
  assert.ok(!receives({ from: 0, to: 'all', text: 'x' }, 3, players, sides));
  assert.equal(chatLine({ from: 0, to: 1, text: 'hi' }, 0, players), 'Alice: [to Bob] hi');
  assert.equal(chatLine({ from: 0, to: 1, text: 'hi' }, 1, players), 'Alice: [just for you] hi');
});

test('every letter key can be changed, and a letter only ever does one thing', () => {
  const keys = rebind(DEFAULT_KEYS, 'center', DEFAULT_KEYS.next);
  assert.equal(keys.center, DEFAULT_KEYS.next);
  assert.equal(keys.next, DEFAULT_KEYS.center);
  assert.equal(new Set(Object.values(keys)).size, Object.keys(keys).length);
  assert.equal(actionFor(keys, keys.chat.toLowerCase()), 'chat');
  assert.equal(rebind(keys, 'chat', '1'), keys);
});

test('preferences: all four camera preferences off by default; saved and loaded; bad storage is harmless', () => {
  const d = defaultPrefs();
  assert.deepEqual([d.edgeScroll, d.selectNew, d.steadyCamera, d.snapBack, d.chaseCam, d.watchCam], [false, false, false, false, false, false]);
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  savePrefs({ ...d, snapBack: true, name: 'Zed' }, storage);
  const back = loadPrefs(storage);
  assert.equal(back.snapBack, true);
  assert.equal(back.name, 'Zed');
  const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
  assert.deepEqual(loadPrefs(broken), d);
  assert.equal(savePrefs(d, broken), false);
  assert.equal(mergePrefs({ snapBack: 'yes', volumes: { music: 5 } }).snapBack, false);
  assert.equal(mergePrefs({ volumes: { music: 5 } }).volumes.music, 5);
});

// Saved replays (spec 12, Saving a replay, Watching a replay).

import { listReplays, saveReplay, deleteReplay, replayToText, replayFromText } from '../../src/client/core/replay-store.js';
import { RULES_VERSION } from '../../src/rules/version.js';

test('replays are saved under a name, listed, deleted, and saved to and read from files', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const replay = { rulesVersion: RULES_VERSION, setup: { fog: true }, moves: [{ type: 'pass', player: 0 }] };
  assert.ok(saveReplay('First', replay, storage));
  assert.ok(saveReplay('Second', replay, storage));
  const list = listReplays(storage);
  assert.deepEqual(list.map((r) => r.name), ['First', 'Second']);
  deleteReplay(list[0].id, storage);
  assert.deepEqual(listReplays(storage).map((r) => r.name), ['Second']);

  const back = replayFromText(replayToText(replay));
  assert.ok(back.ok);
  assert.deepEqual(back.replay, replay);
  assert.ok(!replayFromText('nonsense').ok);
  const other = replayFromText(replayToText({ ...replay, rulesVersion: RULES_VERSION + 1 }));
  assert.ok(!other.ok && /rules version/.test(other.reason), 'a replay from other rules is refused');
});
