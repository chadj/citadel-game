// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listJsFiles } from '../tools/walk.js';

// Every source file carries the license header (CLAUDE.md, Conventions).
const HEADER = [
  '// SPDX-License-Identifier: AGPL-3.0-or-later',
  '// Copyright (C) 2026 Chad Johnson',
];

test('every source file starts with the license header', () => {
  const files = ['src', 'server', 'test', 'tools'].flatMap(listJsFiles);
  assert.ok(files.length > 0);
  const missing = files.filter((file) => {
    const lines = readFileSync(file, 'utf8').split('\n');
    return HEADER.some((line, k) => lines[k] !== line);
  });
  assert.deepEqual(missing, []);
});
