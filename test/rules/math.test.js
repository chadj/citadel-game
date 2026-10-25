// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { divRound, mulFrac, isqrt, ONE } from '../../src/rules/math/fixed.js';
import { sinDeg, cosDeg, normDeg } from '../../src/rules/math/trig.js';
import { SIN_TABLE } from '../../src/rules/math/trig-table.js';
import { wrap, delta, dist2 } from '../../src/rules/math/wrap.js';

test('divRound rounds to nearest, halves away from zero, symmetrically', () => {
  assert.equal(divRound(7, 2), 4);
  assert.equal(divRound(-7, 2), -4);
  assert.equal(divRound(7, -2), -4);
  assert.equal(divRound(-7, -2), 4);
  assert.equal(divRound(5, 3), 2);
  assert.equal(divRound(4, 3), 1);
  assert.equal(divRound(-4, 3), -1);
  assert.equal(divRound(0, 5), 0);
  for (let a = -50; a <= 50; a++) {
    for (const b of [1, 2, 3, 7, 64, -5]) assert.equal(divRound(-a, b), -divRound(a, b));
  }
});

test('divRound is exact for large values', () => {
  const b = 65536;
  const a = 2 ** 50 + 3 * b + b / 2; // a tie, with a dividend near the 2^53 limit
  assert.equal(divRound(a, b), 2 ** 50 / b + 4);
});

test('mulFrac scales by a fraction', () => {
  assert.equal(mulFrac(1000, ONE / 2), 500);
  assert.equal(mulFrac(-1000, ONE / 4), -250);
});

test('isqrt is the exact floor of the square root', () => {
  for (let n = 0; n < 2000; n++) {
    const s = isqrt(n);
    assert.ok(s * s <= n && (s + 1) * (s + 1) > n, `isqrt(${n}) = ${s}`);
  }
  const big = 94906265; // its square is just below 2^53
  assert.equal(isqrt(big * big), big);
  assert.equal(isqrt(big * big - 1), big - 1);
  assert.throws(() => isqrt(-1));
});

test('the trig table matches sin to within one unit, and is exactly symmetric', () => {
  assert.equal(SIN_TABLE.length, 360);
  for (let d = 0; d < 360; d++) {
    const expected = Math.sin((d * Math.PI) / 180) * ONE;
    assert.ok(Math.abs(SIN_TABLE[d] - expected) <= 1, `sin ${d}°`);
    assert.equal(sinDeg(180 - d), sinDeg(d));
    assert.ok(sinDeg(-d) === -sinDeg(d), `sin -${d}°`); // === counts 0 and -0 as equal
    assert.equal(cosDeg(-d), cosDeg(d));
  }
  assert.equal(sinDeg(90), ONE);
  assert.equal(cosDeg(0), ONE);
  assert.equal(cosDeg(90), 0);
  assert.equal(normDeg(-1), 359);
  assert.equal(normDeg(725), 5);
});

test('headings follow spec 01: 0° east, 90° south', () => {
  assert.equal(cosDeg(0), ONE); // +x is east
  assert.equal(sinDeg(90), ONE); // +y is south
});

test('wrap and the short way around', () => {
  assert.equal(wrap(-1, 100), 99);
  assert.equal(wrap(100, 100), 0);
  assert.equal(wrap(250, 100), 50);
  assert.equal(delta(10, 90, 100), -20);
  assert.equal(delta(90, 10, 100), 20);
  assert.equal(delta(0, 50, 100), 50);
  assert.equal(delta(50, 0, 100), 50);
  assert.equal(dist2(5, 5, 95, 98, 100), 10 * 10 + 7 * 7);
});
