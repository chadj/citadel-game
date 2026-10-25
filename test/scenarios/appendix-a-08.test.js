// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 08 — Fog of war.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, step } from '../../src/rules/game.js';
import { updateFog, canSee, fogLifted, revealers } from '../../src/rules/fog.js';
import { citadelOf } from '../../src/rules/units.js';
import { LINGER_TICKS, NODE_SIGHT, PX } from '../../src/rules/constants.js';
import { makeGame, pass } from '../helpers/setups.js';
import { place, launchAt, builtUnit, destroyAndSettle } from '../helpers/build.js';

const sees = (game, player, x, y) => canSee(game, player, x * PX, y * PX);

// How far east of (x, y) a player sees, in whole fog cells' worth.
function reachEast(game, player, x, y) {
  let d = 0;
  while (d < 1000 && sees(game, player, x + d + 15, y)) d += 30;
  return d;
}

test('how far things see: an Outpost on Ground about 200 px, a Spire about 500 px', () => {
  const game = makeGame();
  // P1's Citadel is drawn 10 px up the screen: what it sees is centered there.
  const outpost = reachEast(game, 0, 300, 290);
  assert.ok(outpost >= 180 && outpost <= 220, `${outpost} px`);
  place(game, 'spire', 0, 300, 900);
  updateFog(game);
  const spire = reachEast(game, 0, 300, 850);
  assert.ok(spire >= 470 && spire <= 520, `${spire} px`);
});

test('the fog comes back: when the Spire is destroyed, the area only it revealed is hidden again', () => {
  const game = makeGame();
  const spire = place(game, 'spire', 0, 300, 900);
  updateFog(game);
  assert.equal(sees(game, 0, 700, 850), true);
  destroyAndSettle(game, spire);
  assert.equal(sees(game, 0, 700, 850), false);
  assert.equal(sees(game, 0, 300, 290), true, 'the Citadel still sees its own area');
});

test('teams: a teammate\'s Spire reveals the area for the whole team', () => {
  const game = makeGame({ players: [{ team: 'red' }, { team: 'blue' }, { team: 'red' }, { team: 'blue' }] });
  place(game, 'spire', 2, 900, 900);
  updateFog(game);
  assert.equal(sees(game, 0, 1300, 850), true);
  assert.equal(sees(game, 2, 1300, 850), true);
  assert.equal(sees(game, 1, 1300, 850), false);
});

test('conduits: a long conduit reveals small patches along its length, one node in five', () => {
  const game = makeGame();
  builtUnit(game, launchAt(game, 'spire', 300, 790).events);
  const conduit = game.state.conduits[0];
  const nodes = revealers(game).filter((r) => r[3] === NODE_SIGHT);
  const expected = conduit.nodes.filter((_, i) => (i + 1) % 5 === 0);
  assert.equal(nodes.length, expected.length);
  assert.ok(nodes.every((r, k) => r[1] === expected[k].x && r[2] === expected[k].y));
  // Beside a revealing node, well away from either end, it's visible.
  const mid = expected[Math.floor(expected.length / 2)];
  assert.equal(canSee(game, 0, mid.x + 100 * PX, mid.y), true);
});

test('shots: a shot reveals around it as it flies; after a weapon lands, its area stays revealed about a second', () => {
  const game = makeGame();
  game.liveFog = true;
  applyMove(game, { type: 'launch', player: 0, launcher: citadelOf(game.state, 0).id, item: 'shell', heading: 0, power: 1000 });
  let sawShot = false;
  let landedAt = null;
  let landing = null;
  while (game.state.phase === 'flight') {
    const before = game.events.length;
    step(game);
    const shot = game.state.shots[0];
    if (shot && shot.x / PX > 600) sawShot ||= canSee(game, 0, shot.x, shot.y);
    const crater = game.events.slice(before).find((e) => e.type === 'crater');
    if (crater) {
      landedAt = crater.tick;
      landing = crater;
    }
    if (landing && game.state.phase === 'flight') {
      assert.equal(canSee(game, 0, landing.x, landing.y), true, 'it lingers');
    }
  }
  assert.ok(sawShot, 'beyond the Citadel\'s own sight, the shot shows what\'s around it');
  assert.equal(game.state.tick - landedAt, LINGER_TICKS, 'the turn waits for it');
  assert.equal(canSee(game, 0, landing.x, landing.y), false, 'then it\'s gone');
});

test('out of the game: without teams, when a player\'s Citadel is destroyed, the fog lifts on their screen', () => {
  const game = makeGame({ players: 3 });
  assert.equal(fogLifted(game, 0), false);
  destroyAndSettle(game, citadelOf(game.state, 0));
  assert.equal(fogLifted(game, 0), true);
  assert.equal(sees(game, 0, 1300, 1300), true);
  assert.equal(fogLifted(game, 1), false);
  pass(game);
});
