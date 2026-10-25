// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, hashState } from '../../src/rules/hash.js';

test('the same state hashes the same, whatever order its keys were added in', () => {
  const a = { round: 3, players: [{ energy: 110, out: false }], winner: null };
  const b = { winner: null, players: [{ out: false, energy: 110 }], round: 3 };
  assert.equal(canonical(a), canonical(b));
  assert.equal(hashState(a), hashState(b));
  assert.match(hashState(a), /^[0-9a-f]{16}$/);
});

test('any difference changes the hash', () => {
  const base = { units: [{ x: 1024, y: 2048, armor: 50 }], turn: 1 };
  const seen = new Set([hashState(base)]);
  for (const variant of [
    { units: [{ x: 1025, y: 2048, armor: 50 }], turn: 1 },
    { units: [{ x: 1024, y: 2048, armor: 49 }], turn: 1 },
    { units: [{ x: 1024, y: 2048, armor: 50 }], turn: 2 },
    { units: [], turn: 1 },
    { units: [{ x: 1024, y: 2048, armor: 50 }], turn: '1' },
    { units: [{ x: 1024, y: 2048, armor: 50 }, null], turn: 1 },
  ]) {
    const h = hashState(variant);
    assert.ok(!seen.has(h), JSON.stringify(variant));
    seen.add(h);
  }
});

test('strings can\'t be mistaken for structure', () => {
  assert.notEqual(canonical(['ab', 'c']), canonical(['a', 'bc']));
  assert.notEqual(canonical({ a: 's1:b' }), canonical({ a: 's', b: 1 }));
});

test('floats and non-plain values are refused', () => {
  assert.throws(() => hashState({ x: 1.5 }), /\$\.x is 1\.5/);
  assert.throws(() => hashState([NaN]), /whole numbers/);
  assert.throws(() => hashState({ big: 2 ** 60 }), /whole numbers/);
  assert.throws(() => hashState({ when: new Date(0) }), /plain data/);
  assert.throws(() => hashState({ f: () => 1 }), /plain data/);
  assert.throws(() => hashState({ m: new Map() }), /plain data/);
});

test('-0 and undefined fields don\'t change the hash', () => {
  assert.equal(hashState({ v: -0 }), hashState({ v: 0 }));
  assert.equal(hashState({ a: 1, b: undefined }), hashState({ a: 1 }));
});

test('typed arrays hash like arrays', () => {
  assert.equal(hashState(new Uint8Array([1, 2, 3])), hashState([1, 2, 3]));
});
