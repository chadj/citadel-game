// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Which land joins up, and how far it is round by land (decision D58).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PX } from '../../src/rules/constants.js';
import { sketchMap } from '../../src/rules/terrain/map.js';
import { landAt, landDistance, sameLand } from '../../src/ai/land.js';

const at = (x, y) => ({ x: x * PX, y: y * PX });

test('a channel that ends doesn\'t part the land: the way round is longer', () => {
  // A channel down tile column 8, from the middle of row 0 to the middle
  // of row 9.
  const map = sketchMap({ water: Array(9).fill('........1'), at: [0, 1] });
  const [a, b] = [at(450, 300), at(570, 300)];
  assert.ok(sameLand(map, a, b));
  const round = landDistance(map, a, b) / PX;
  assert.ok(round > 600, `round by land: ${round}`);
  assert.ok(landDistance(map, at(450, 900), at(570, 900)) / PX < 130, 'past its end, straight across');
});

test('channels the length of the map part the land', () => {
  // Down tile columns 8 and 20: the map wraps, so it takes two.
  const map = sketchMap({ water: Array(32).fill('........1...........1') });
  const [a, b] = [at(450, 150), at(570, 150)];
  assert.ok(!sameLand(map, a, b));
  assert.equal(landDistance(map, a, b), Infinity);
  assert.ok([landAt(map, a.x, a.y), landAt(map, b.x, b.y)].includes(landAt(map, 510 * PX, 150 * PX)), 'in the channel, the land beside it');
});
