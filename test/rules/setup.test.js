// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSetup } from '../../src/rules/setup.js';
import { WIND_MEDIUM, WIND_STRONG } from '../../src/rules/constants.js';
import { makeSetup } from '../helpers/setups.js';

const fails = (options, pattern) => assert.throws(() => checkSetup(makeSetup(options)), pattern);

test('a valid setup gives each player their side', () => {
  assert.deepEqual(checkSetup(makeSetup({ players: 3 })), [0, 1, 2]);
  const teams = makeSetup({ players: [{ team: 'a' }, { team: 'b' }, { team: 'a' }, { team: 'b' }], order: [0, 1, 2, 3] });
  assert.deepEqual(checkSetup(teams), [0, 1, 0, 1]);
});

test('2 to 4 players, up to three computers, at least one human', () => {
  fails({ players: 1 }, /2 to 4 players/);
  fails({ players: 5 }, /2 to 4 players/);
  fails({ players: [{ computer: true }, { computer: true }] }, /one player must be human/);
  assert.doesNotThrow(() => checkSetup(makeSetup({ players: [{}, { computer: true }, { computer: true }, { computer: true }] })));
});

test('every player has a different color', () => {
  fails({ players: [{ color: 2 }, { color: 2 }] }, /color is already taken/);
  fails({ players: [{ color: 6 }, {}] }, /no color/);
  fails({ players: [{ faction: 4 }, {}] }, /no faction/);
});

test('only the supported team layouts', () => {
  // A player alone on a team is on no team.
  assert.doesNotThrow(() => checkSetup(makeSetup({ players: [{ team: 'a' }, { team: 'b' }] })));
  fails({ players: [{ team: 'a' }, { team: 'a' }] }, /teams of 2/);
  assert.doesNotThrow(() => checkSetup(makeSetup({ players: [{ team: 'a' }, { team: 'a' }, {}] })));
  assert.doesNotThrow(() => checkSetup(makeSetup({ players: [{ team: 'a' }, { team: 'a' }, { team: 'a' }, {}] })));
  fails({ players: [{ team: 'a' }, { team: 'a' }, {}, {}] }, /teams of 2 aren't/);
});

test('two teams of two alternate in the order of play', () => {
  const players = [{ team: 'a' }, { team: 'a' }, { team: 'b' }, { team: 'b' }];
  fails({ players, order: [0, 1, 2, 3] }, /alternate/);
  assert.doesNotThrow(() => checkSetup(makeSetup({ players, order: [0, 2, 1, 3] })));
});

test('the order of play lists every player once', () => {
  fails({ players: 3, order: [0, 0, 1] }, /every player once/);
  fails({ players: 3, order: [0, 1] }, /every player once/);
});

test('the host\'s settings', () => {
  fails({ clock: 45 }, /shot clock/);
  fails({ wind: { level: WIND_STRONG, dir: 0, variation: 100 } }, /only a Medium wind varies/);
  fails({ wind: { level: WIND_MEDIUM, dir: 0.5, variation: 0 } }, /direction/);
  fails({ fog: 'yes' }, /fog of war/);
});
