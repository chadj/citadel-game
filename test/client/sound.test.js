// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Where sounds are heard, which events make which sounds, the aide and
// what the music follows (spec 11; decisions D49, D50, D51).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeSound, cuesFor, interfaceCues, HEAR_PX } from '../../src/client/core/sound-cues.js';
import { Aide, aideKeysFor, AIDE_EVENTS, AIDE_WAIT_MS, AIDE_PAUSE_MS } from '../../src/client/core/aide.js';
import { MoodTracker, moodOf } from '../../src/client/core/mood.js';
import { SOUNDS } from '../../src/client/audio/sounds.js';
import { RECIPES } from '../../src/client/audio/synth.js';
import { PX } from '../../src/rules/constants.js';
import { citadelOf } from '../../src/rules/units.js';
import { makeGame, pass, whoseTurn } from '../helpers/setups.js';
import { launchAt, builtUnit, destroyAndSettle, richPlayers, pos } from '../helpers/build.js';

const SIZE = 4096 * PX;

test('effects fade with distance, the short way around, and lean to their side', () => {
  const at = (x, y) => ({ x: x * PX, y: y * PX });
  const here = at(100, 100);
  assert.equal(placeSound(here, here, SIZE, true).gain, 1);
  assert.equal(placeSound(here, at(100 + HEAR_PX, 100), SIZE, true).gain, 0);
  const near = placeSound(here, at(400, 100), SIZE, true);
  assert.ok(near.gain > 0 && near.gain < 1 && near.pan > 0);
  // 200 px to the left, across the map's edge.
  const across = placeSound(here, at(3996, 100), SIZE, true);
  assert.ok(across.gain > 0.5 && across.pan < 0);
});

test('a sound in the fog plays at half volume, from the middle', () => {
  assert.deepEqual(placeSound({ x: 0, y: 0 }, { x: 900 * PX, y: 0 }, SIZE, false), { gain: 0.5, pan: 0 });
});

const look = (more = {}) => ({
  where: () => ({ x: 0, y: 0 }),
  shotFrom: () => 7,
  kindOf: () => 'outpost',
  wet: () => false,
  blasts: (e) => ['extractor', 'charge', 'rover'].includes(e.kind),
  ...more,
});

test('every cue names a sound, and every sound has a recipe', () => {
  for (const [name, def] of Object.entries(SOUNDS)) assert.ok(def.files || RECIPES[def.synth], name);
  const events = [
    { type: 'launch', launcher: 1 }, { type: 'seekerLocked', shot: 2 }, { type: 'explosion', radius: 20 * PX },
    { type: 'blast', radius: 150 * PX }, { type: 'destroy', how: 'destroyed', kind: 'spire' }, { type: 'built', kind: 'barrier' },
    { type: 'nodeSettled', broke: false }, { type: 'splash', item: 'scatter' }, { type: 'lost' }, { type: 'buildingFailed', reason: 'caught' },
    { type: 'domeFlicker' }, { type: 'roverDome' }, { type: 'roverDrives', unit: 3 }, { type: 'pulseLanded' }, { type: 'pulse' },
    { type: 'surge' }, { type: 'surgeNode', strength: 12 }, { type: 'infected' }, { type: 'repairLanded' }, { type: 'salvage' },
    { type: 'interceptorFired', missile: 4 }, { type: 'missileMiss' }, { type: 'caught' }, { type: 'disabled' }, { type: 'barrierUp' },
  ];
  for (const e of events) {
    const cues = cuesFor(e, look());
    assert.ok(cues.length > 0, e.type);
    for (const c of cues) assert.ok(SOUNDS[c.sound], c.sound);
  }
});

test('a Battery and an Outpost launch differently, and the launch follows its shot', () => {
  const [outpost] = cuesFor({ type: 'launch', launcher: 1 }, look());
  const [battery] = cuesFor({ type: 'launch', launcher: 1 }, look({ kindOf: () => 'battery' }));
  assert.notEqual(outpost.sound, battery.sound);
  assert.deepEqual(outpost.follow, { shot: 7 });
});

test('bigger blasts sound bigger; units that blast can be told apart', () => {
  const ex = (r) => cuesFor({ type: 'explosion', radius: r * PX }, look())[0].sound;
  assert.deepEqual([ex(15), ex(30), ex(60)], ['explosion.small', 'explosion.medium', 'explosion.large']);
  const blast = (r) => cuesFor({ type: 'blast', radius: r * PX }, look())[0].sound;
  assert.equal(new Set([blast(60), blast(130), blast(200)]).size, 3);
});

test('a salvaged unit goes quietly; one that blasts is heard in its blast', () => {
  assert.deepEqual(cuesFor({ type: 'destroy', how: 'salvaged', kind: 'outpost' }, look()), []);
  assert.deepEqual(cuesFor({ type: 'destroy', how: 'destroyed', kind: 'extractor' }, look()), []);
  assert.equal(cuesFor({ type: 'destroy', how: 'destroyed', kind: 'outpost' }, look())[0].sound, 'destroy.large');
});

test('a Surge crackles more weakly as its damage fades', () => {
  const g = (strength) => cuesFor({ type: 'surgeNode', strength }, look())[0].gain;
  assert.ok(g(30) > g(10));
});

test('the turn sound is for everyone but the player whose turn it is; the buzzer for the one who timed out', () => {
  assert.deepEqual(interfaceCues({ type: 'turnStart', player: 1 }, 0), ['ui.turn']);
  assert.deepEqual(interfaceCues({ type: 'turnStart', player: 0 }, 0), []);
  assert.deepEqual(interfaceCues({ type: 'timeUp', player: 0 }, 0), ['ui.buzzer']);
  assert.deepEqual(interfaceCues({ type: 'timeUp', player: 1 }, 0), []);
});

// The aide ------------------------------------------------------------

const said = (aide, ms = 5000, step = 50) => {
  const out = [];
  for (let t = 0; t < ms; t += step) {
    const line = aide.update(step, false);
    if (line) out.push(line);
  }
  return out;
};

test('the aide waits a moment, then speaks; it never talks over itself', () => {
  const aide = new Aide({ random: () => 0 });
  aide.add('yourTurn');
  assert.equal(aide.update(AIDE_WAIT_MS - 100, false), null);
  const line = aide.update(150, false);
  assert.equal(line.id, 'aide.yourTurn.1');
  assert.equal(line.text, AIDE_EVENTS.yourTurn[1][0]);
  aide.add('roundOver');
  aide.update(1000, true); // still speaking
  assert.equal(aide.update(AIDE_PAUSE_MS - 100, false), null); // the pause after a line
  assert.equal(aide.update(150, false).key, 'roundOver');
});

test('more important news wins; less important news is dropped', () => {
  const aide = new Aide();
  aide.add('hitEnemy');
  aide.add('knockedOut');
  assert.deepEqual(aide.queue.map((q) => q.key), ['knockedOut']);
  aide.add('hitEnemy');
  assert.deepEqual(aide.queue.map((q) => q.key), ['knockedOut']);
});

test('the aide doesn\'t repeat a line twice in a row for an event', () => {
  let k = 0;
  const aide = new Aide({ random: () => [0.1, 0.1, 0.1, 0.1][k++ % 4] });
  const lines = [];
  for (let i = 0; i < 6; i++) lines.push(aide.line('hitEnemy').id);
  for (let i = 1; i < lines.length; i++) assert.notEqual(lines[i], lines[i - 1]);
});

test('with chatter off, the aide says only the essentials', () => {
  const aide = new Aide({ chatter: false });
  aide.add('hitEnemy');
  aide.add('clockWarning');
  assert.deepEqual(said(aide).map((l) => l.key), ['clockWarning']);
});

test('once its Citadel is lost, the aide says only the round\'s end and the result', () => {
  const aide = new Aide();
  aide.add('citadelLost');
  said(aide);
  for (const key of ['yourTurn', 'hitEnemy', 'knockedOut', 'roundOver']) {
    aide.add(key);
    said(aide).forEach((l) => assert.equal(l.key, 'roundOver'));
  }
  aide.add('defeat');
  assert.deepEqual(said(aide).map((l) => l.key), ['defeat']);
});

test('a stale reminder is dropped', () => {
  const aide = new Aide();
  let stale = false;
  aide.add('reminder', () => stale);
  stale = true;
  assert.deepEqual(said(aide), []);
});

test('what the aide comments on, from its player\'s point of view', () => {
  const ctx = (more = {}) => ({
    me: 0, sides: [0, 1, 0], turnPlayer: 0, onScreen: () => true, ventExtractor: () => true, kindOf: () => 'barrier', ...more,
  });
  assert.deepEqual(aideKeysFor({ type: 'turnStart', player: 0 }, ctx()), ['yourTurn']);
  assert.deepEqual(aideKeysFor({ type: 'turnStart', player: 0, noLauncher: true }, ctx()), ['noLauncher']);
  assert.deepEqual(aideKeysFor({ type: 'turnStart', player: 1 }, ctx()), []);
  assert.deepEqual(aideKeysFor({ type: 'damage', by: 0, owner: 1, unit: 5 }, ctx()), ['hitEnemy']);
  assert.deepEqual(aideKeysFor({ type: 'damage', by: 0, owner: 2, unit: 5 }, ctx()), ['hitOwn']);
  assert.deepEqual(aideKeysFor({ type: 'damage', by: 1, owner: 0, unit: 5 }, ctx({ turnPlayer: 1, onScreen: () => false })), ['attackedOffscreen']);
  assert.deepEqual(aideKeysFor({ type: 'damage', by: 1, owner: 0, unit: 5 }, ctx({ turnPlayer: 1 })), []);
  assert.deepEqual(aideKeysFor({ type: 'knockedOut', player: 1, by: 2 }, ctx()), ['weKnockedOut']);
  assert.deepEqual(aideKeysFor({ type: 'knockedOut', player: 2 }, ctx()), ['teammateOut']);
  assert.deepEqual(aideKeysFor({ type: 'knockedOut', player: 0 }, ctx()), ['citadelLost']);
  assert.deepEqual(aideKeysFor({ type: 'gameOver', winner: 0 }, ctx()), ['victory']);
  assert.deepEqual(aideKeysFor({ type: 'gameOver', winner: 1 }, ctx()), ['defeat']);
  assert.deepEqual(aideKeysFor({ type: 'disabled', owner: 1, by: 2, unit: 5 }, ctx()), ['enemyBarrierDown']);
  assert.deepEqual(aideKeysFor({ type: 'built', owner: 0, kind: 'extractor', unit: 5 }, ctx()), ['ventExtractor']);
  // Taken down by the burn along a conduit: not a hit, but still a loss.
  assert.deepEqual(aideKeysFor({ type: 'destroy', how: 'destroyed', burnt: true, by: 0, owner: 1, unit: 5 }, ctx()), []);
  assert.deepEqual(aideKeysFor({ type: 'destroy', how: 'destroyed', burnt: true, by: 1, owner: 0, unit: 5 },
    ctx({ turnPlayer: 1, onScreen: () => false })), ['attackedOffscreen']);
});

test('in a chain, only the building that was hit counts as a hit; those the burn takes down are marked', () => {
  const game = makeGame({ players: 2 });
  richPlayers(game);
  const me = whoseTurn(game);
  let from = citadelOf(game.state, me);
  const chain = [];
  for (let k = 0; k < 3; k++) {
    const { x, y } = pos(from);
    from = builtUnit(game, launchAt(game, 'outpost', x + 250, y, { launcher: from }).events);
    chain.push(from);
    while (whoseTurn(game) !== me) pass(game);
    richPlayers(game);
  }
  const destroys = destroyAndSettle(game, chain[0]).filter((e) => e.type === 'destroy');
  assert.deepEqual(destroys.map((e) => [e.unit, !!e.burnt]), chain.map((u, k) => [u.id, k > 0]));
});

// The music ------------------------------------------------------------

test('the music grows more intense near the action, then calms', () => {
  const m = new MoodTracker();
  assert.equal(m.intensity, 0);
  m.feel({ excite: 0.5, near: 1 });
  m.feel({ excite: 0.5, near: 1 });
  assert.equal(m.intensity, 3);
  m.feel({ excite: 5, near: 0 });
  m.update(60000);
  assert.equal(m.intensity, 0);
});

test('the music turns upbeat as things go well, darker as they go badly, then drifts back', () => {
  const m = new MoodTracker();
  const ctx = { me: 0, sides: [0, 1], kindOf: () => 'outpost' };
  m.feel(moodOf({ type: 'destroy', how: 'destroyed', kind: 'outpost', owner: 1, by: 0 }, ctx));
  assert.equal(m.tone, 'upbeat');
  m.update(120000);
  assert.equal(m.tone, 'neutral');
  m.feel(moodOf({ type: 'destroy', how: 'destroyed', kind: 'outpost', owner: 0, by: 1 }, ctx));
  assert.equal(m.tone, 'dark');
  // An enemy defense coming up is bad news.
  const m2 = new MoodTracker();
  m2.feel(moodOf({ type: 'built', owner: 1, kind: 'barrier' }, { ...ctx, kindOf: () => 'barrier' }));
  assert.ok(m2.mood < 0);
});
