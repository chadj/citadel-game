// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// A duplicated tab's copy of the seat token (decision D56): before using
// a kept token, a tab asks whether another open tab holds it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heldElsewhere, answerAsks } from '../../src/client/core/net.js';

test('a token another open tab holds is not used again; one no tab holds is', async () => {
  let token = 'abc';
  const stop = answerAsks(() => token);
  try {
    assert.equal(await heldElsewhere('abc', 100), true, 'the original tab answers');
    assert.equal(await heldElsewhere('xyz', 100), false, 'nobody holds this one');
    token = null; // the original tab has no seat yet
    assert.equal(await heldElsewhere('abc', 100), false);
  } finally {
    stop();
  }
  assert.equal(await heldElsewhere('abc', 100), false, 'the original tab is gone: a reload takes the seat back');
  assert.equal(await heldElsewhere(null, 100), false);
});
