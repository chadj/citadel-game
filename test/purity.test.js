// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listJsFiles } from '../tools/walk.js';
import { findViolations, strip } from '../tools/purity.js';

// Rules code: the game rules, and the map generator, which every client
// may run to rebuild a generated map (spec 02, Generated maps).
const ROOTS = ['src/rules', 'src/mapgen'];

test('rules code is deterministic plain JavaScript', () => {
  const files = ROOTS.flatMap(listJsFiles);
  assert.ok(files.length > 0, 'no rules files found');
  const problems = files.flatMap((file) =>
    findViolations(readFileSync(file, 'utf8'), file, ROOTS));
  assert.deepEqual(
    problems.map((p) => `${p.file}:${p.line}: ${p.message}`), []);
});

// The checker itself.

const FILE = 'src/rules/example.js';
const check = (source) =>
  findViolations(source, FILE, ROOTS).map((p) => [p.line, p.message]);

test('allows relative imports inside the rules code', () => {
  assert.deepEqual(check([
    "import { a } from './math/fixed.js';",
    "import * as b from '../mapgen/gen.js';",
    "export { c } from './c.js';",
  ].join('\n')), []);
});

test('refuses packages, built-ins and files outside the rules', () => {
  const problems = check([
    "import Phaser from 'phaser';",
    "import { readFileSync } from 'node:fs';",
    "import { draw } from '../client/draw.js';",
    "export * from '../../server/x.js';",
    "const m = await import('./late.js');",
    'const n = await import(name);',
  ].join('\n'));
  // Line 1 twice: the package, and the Phaser name. Line 5 is fine.
  assert.deepEqual(problems.map(([line]) => line), [1, 1, 2, 3, 4, 6]);
});

test('refuses unsafe Math and the ** operator', () => {
  const problems = check([
    'const a = Math.sin(x);',
    'const b = Math . random();',
    "const c = Math['cos'](x);",
    'const d = x ** 2;',
    'const e = Math.sqrt(x) + Math.floor(y) + Math.imul(p, q);',
  ].join('\n'));
  assert.deepEqual(problems.map(([line]) => line), [1, 2, 3, 4]);
});

test('refuses time, platform and engine globals', () => {
  const problems = check([
    'const t = Date.now();',
    'const u = performance.now();',
    'window.x = 1;',
    'const s = new Phaser.Scene();',
    'setTimeout(f, 1);',
  ].join('\n'));
  assert.deepEqual(problems.map(([line]) => line), [1, 2, 3, 4, 5]);
});

test('allows the same names as properties and inside strings or comments', () => {
  assert.deepEqual(check([
    'state.window = 3;',
    'unit.process();',
    "const label = 'Date: Math.sin(x) ** 2';",
    '// Math.random() would break replays',
    '/* window, document */',
    'const updated = lastDate + 1;',
  ].join('\n')), []);
});

test('sees code inside template literal expressions', () => {
  const problems = check([
    'const a = `angle ${Math.sin(x)} and ${ { k: 1 }.k }`;',
    'const b = `Math.cos(y) is only text`;',
  ].join('\n'));
  assert.deepEqual(problems.map(([line]) => line), [1]);
});

test('strip keeps line numbers', () => {
  const source = 'a /* one\ntwo */ b\n"x\\"y" // z\n`t\n${c}`';
  const { code, bare } = strip(source);
  assert.equal(code.split('\n').length, source.split('\n').length);
  assert.equal(bare.split('\n').length, source.split('\n').length);
  assert.match(bare, /\$\{c\}/);
});
