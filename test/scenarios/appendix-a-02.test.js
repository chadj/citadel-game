// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Appendix A, 02 — The map and terrain.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { px } from '../../src/rules/math/fixed.js';
import { sketchMapData } from '../../src/rules/terrain/map.js';
import { sampleTerrain } from '../../src/rules/terrain/terrain.js';
import { roundIncome } from '../../src/rules/energy.js';
import { citadelOf, findUnit } from '../../src/rules/units.js';
import { FLAT, SLOPE, PX } from '../../src/rules/constants.js';
import { fly, raisedLauncher } from '../helpers/flight-cases.js';
import { makeGame, pass } from '../helpers/setups.js';
import { launchAt, builtUnit, destroyAndSettle, richPlayers, pos } from '../helpers/build.js';

test('a full-power shot from ground about 75 px above the target lands about 540 px away', () => {
  const { distance } = fly({ env: raisedLauncher(px(75)) });
  assert.ok(Math.abs(distance - 540) <= 30, `got ${distance.toFixed(1)}`);
});

test('a building whose landing point is on a slope fails; one on flat ground with only its edge over the slope lands', () => {
  // A Plateau ridge from x = 600 to 660 px; its slope runs from 560 to 600.
  const map = sketchMapData({ rows: Array(32).fill('+'), at: [10, 0] });
  const onSlope = makeGame({ map });
  assert.equal(sampleTerrain(onSlope.map, px(580), px(300)).type, SLOPE);
  const failed = launchAt(onSlope, 'spire', 580, 300);
  assert.equal(failed.events.find((e) => e.type === 'buildingFailed')?.reason, 'slope');
  assert.equal(builtUnit(onSlope, failed.events), undefined);

  const edge = makeGame({ map });
  const { events } = launchAt(edge, 'spire', 552, 300);
  const unit = builtUnit(edge, events);
  assert.ok(unit, 'it lands');
  const { x } = pos(unit);
  assert.equal(sampleTerrain(edge.map, unit.x, unit.y).type, FLAT);
  assert.ok(x < 560 && x + 15 > 560, `its footprint (${x} ± 15) reaches over the slope's foot at 560`);
});

test('a building that comes down on water sinks; a Pontoon moves to the center of its tile, and a building launched onto it lands', () => {
  // A lake from x = 480 to 780 px.
  const map = sketchMapData({ rows: Array(32).fill('~~~~~'), at: [8, 0] });
  const game = makeGame({ map });
  richPlayers(game);
  const sunk = launchAt(game, 'spire', 660, 300);
  assert.ok(sunk.events.some((e) => e.type === 'buildingFailed'));
  assert.equal(builtUnit(game, sunk.events), undefined);
  pass(game);

  const pontoon = builtUnit(game, launchAt(game, 'pontoon', 520, 315).events);
  assert.equal(pontoon?.kind, 'pontoon');
  assert.deepEqual(pos(pontoon), { x: 510, y: 330 }, 'the center of tile (8, 5)');

  const { events } = launchAt(game, 'spire', 510, 330);
  const spire = builtUnit(game, events);
  assert.ok(spire, 'the building lands on the Pontoon');
  assert.equal(spire.base, pontoon.base + px(10));
});

test('an Extractor just overlapping a vent earns 3 a round; one well clear earns 1', () => {
  // A small vent is 45 px across; an Extractor is 40 px across.
  const map = sketchMapData({ vents: [{ x: 600, y: 300, size: 'small' }] });
  const game = makeGame({ map });
  richPlayers(game);
  const near = builtUnit(game, launchAt(game, 'extractor', 559, 300).events);
  pass(game);
  const gap = Math.hypot(near.x / PX - 600, near.y / PX - 300);
  assert.ok(gap < 42.5 && gap > 38, `it just overlaps the vent (${gap.toFixed(1)} px apart)`);
  assert.equal(near.onVent, true);

  const far = builtUnit(game, launchAt(game, 'extractor', 300, 550).events);
  assert.equal(far.onVent, false);
  assert.equal(roundIncome(game.state, 0), 70 + 30 + 10);
});

test('a Pontoon destroyed under a conduit burns it both ways; the far building goes, the launcher survives', () => {
  // A lake one tile wide, from x = 480 to 540 px.
  const map = sketchMapData({ rows: Array(32).fill('~'), at: [8, 0] });
  const game = makeGame({ map });
  richPlayers(game);
  const pontoon = builtUnit(game, launchAt(game, 'pontoon', 520, 315).events);
  assert.deepEqual(pos(pontoon), { x: 510, y: 330 });
  pass(game);
  const across = builtUnit(game, launchAt(game, 'outpost', 650, 330).events);
  assert.ok(across, 'the conduit crosses the Pontoon');
  const beyond = builtUnit(game, launchAt(game, 'spire', 900, 330, { launcher: across }).events);
  assert.ok(beyond);
  const conduit = game.state.conduits.find((c) => c.to === across.id);
  const onPontoon = conduit.nodes.findIndex((n) => n.x >= px(480) && n.x < px(540));
  assert.ok(onPontoon > 0 && onPontoon < conduit.nodes.length - 1);

  const events = destroyAndSettle(game, pontoon);
  const burnt = events.filter((e) => e.type === 'nodeBurnt' && e.conduit === conduit.id).map((e) => e.index);
  assert.equal(burnt[0], onPontoon, 'it burns from the water');
  assert.ok(burnt.includes(0) && burnt.includes(conduit.nodes.length - 1), 'both ways');
  assert.equal(findUnit(game.state, across.id), null, 'the far building goes');
  assert.equal(findUnit(game.state, beyond.id), null, 'with everything built from it');
  assert.ok(citadelOf(game.state, 0), 'the launcher survives');
  assert.equal(game.state.conduits.length, 0);
});
