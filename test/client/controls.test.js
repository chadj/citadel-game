// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The aim, the meter and the camera (spec 01, Aiming, Power; spec 10,
// The camera).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AIM_FINE, AimTurner, PRESS_TURN, moveHeading, markHeading, wrapAim, aimFromHeading,
} from '../../src/client/core/aim.js';
import {
  Meter, meterPower, meterShown, meterRunOut, METER_FILL_TICKS, METER_STEPS,
} from '../../src/client/core/meter.js';
import { Camera, GLIDE_MS, wrapDelta } from '../../src/client/core/camera.js';

test('a press turns the aim about a degree; holding turns it faster and faster, up to about 150° a second, a tick at a time', () => {
  const t = new AimTurner();
  assert.ok(Math.abs(t.press(1) / AIM_FINE - 1) <= 0.25);
  // Rates over successive 3-tick (100 ms) windows rise, and level off
  // near 147°/s.
  const rates = [];
  for (let k = 0; k < 30; k++) rates.push(t.update(3) / AIM_FINE * 10);
  // (Within one fine step: the turn carries fractions of a step.)
  for (let k = 1; k < rates.length; k++) assert.ok(rates[k] >= rates[k - 1] - 10 / AIM_FINE);
  assert.ok(Math.abs(rates.at(-1) - 147) <= 2, `${rates.at(-1)}°/s`);
  t.release();
  assert.equal(t.update(100), 0);
  // Counterclockwise is negative.
  assert.equal(t.press(-1), -PRESS_TURN);
});

test('the heading wraps at 360°, and a shot follows the aim only to the whole degree', () => {
  assert.equal(wrapAim(-1), 360 * AIM_FINE - 1);
  assert.equal(wrapAim(360 * AIM_FINE + 3), 3);
  assert.equal(moveHeading(wrapAim(359.6 * AIM_FINE)), 0);
  assert.equal(moveHeading(10.4 * AIM_FINE), 10);
  assert.equal(aimFromHeading(90), 90 * AIM_FINE);
});

test('the marks show the heading only roughly: different whole degrees can look the same', () => {
  const a = Math.round(10.6 * AIM_FINE);
  const b = Math.round(12.4 * AIM_FINE);
  assert.equal(markHeading(a), markHeading(b));
  assert.notEqual(moveHeading(a), moveHeading(b));
});

test('the meter fills in about 1.25 s, runs back down at the same speed, and fires by itself at the bottom', () => {
  assert.equal(meterPower(0), 0);
  assert.equal(meterPower(METER_FILL_TICKS), 1000);
  assert.equal(meterPower(METER_FILL_TICKS * 1.5), 500);
  assert.ok(Math.abs(METER_FILL_TICKS / 30 - 1.25) < 0.05);
  assert.ok(!meterRunOut(METER_FILL_TICKS * 2 - 1));
  const m = new Meter();
  m.start();
  let fired = null;
  for (let t = 0; t < 90 && fired === null; t++) fired = m.update();
  assert.equal(fired, 0, 'the only way to the lowest power: all the way up and back down');
  assert.ok(!m.holding);
});

test('the meter moves a tick at a time, so a hold can give only a few dozen powers', () => {
  const powers = new Set();
  for (let ticks = 1; ticks < 2 * METER_FILL_TICKS; ticks++) powers.add(meterPower(ticks));
  assert.equal(powers.size, METER_FILL_TICKS); // up and back down give the same steps
  const m = new Meter();
  m.start();
  m.update(16);
  assert.equal(m.release(), meterPower(16));
});

test('the quickest tap fires a little above the lowest power', () => {
  const m = new Meter();
  m.start();
  const power = m.release();
  assert.ok(power > 0 && power < 60, `${power}`);
});

test('the meter shows the power only coarsely, in about 20 steps (19), and keeps showing the last shot', () => {
  const shown = new Set();
  for (let p = 0; p <= 1000; p++) shown.add(meterShown(p));
  assert.equal(shown.size, METER_STEPS + 1);
  assert.equal(meterShown(530), meterShown(560));
  const m = new Meter();
  m.start();
  m.update(18);
  const power = m.release();
  assert.equal(m.shown, power);
  m.clear();
  assert.equal(m.shown, null);
});

test('centering glides over about 0.7 s, speeding up then slowing down, the short way around', () => {
  const cam = new Camera(1920, 100, 100);
  cam.centerOn(1820, 100);
  const xs = [];
  for (let t = 0; t < GLIDE_MS; t += 70) {
    cam.update(70);
    xs.push(cam.x);
  }
  assert.ok(!cam.gliding);
  assert.equal(cam.x, 1820);
  // The short way: from 100 back across the edge to 1820, 200 px.
  const steps = xs.map((x, k) => Math.abs(wrapDelta(k === 0 ? 100 : xs[k - 1], x, 1920)));
  assert.ok(steps.reduce((a, b) => a + b, 0) < 201);
  assert.ok(steps[0] < steps[4] && steps.at(-1) < steps[5], 'eases in and out');
});

test('scrolling stops a glide and a tracking camera', () => {
  const cam = new Camera(1920, 0, 0);
  cam.centerOn(500, 500);
  cam.update(100);
  cam.scrollBy(10, 0);
  assert.ok(!cam.gliding);
  cam.follow(() => ({ x: 900, y: 900 }));
  cam.scrollBy(1, 0);
  assert.ok(!cam.tracking);
});

test('tracking follows smoothly, catches up quickly, then finishes at the end and stops', () => {
  const cam = new Camera(1920, 0, 0);
  let p = { x: 100, y: 0 };
  cam.follow(() => p);
  let biggest = 0;
  for (let k = 0; k < 20; k++) {
    const before = cam.x;
    p = { x: p.x + 10, y: 0 };
    cam.update(33);
    biggest = Math.max(biggest, cam.x - before);
  }
  assert.ok(biggest < 50, 'no jump');
  assert.ok(Math.abs(cam.x - p.x) < 60, 'keeps near');
  cam.endFollow(p);
  for (let k = 0; k < 100 && cam.tracking; k++) cam.update(33);
  assert.ok(!cam.tracking);
  assert.equal(cam.x, p.x);
});

test('a tracking camera waits while its target is hidden', () => {
  const cam = new Camera(1920, 0, 0);
  let visible = false;
  cam.follow(() => (visible ? { x: 300, y: 0 } : null));
  cam.update(100);
  assert.equal(cam.x, 0);
  visible = true;
  cam.update(100);
  assert.ok(cam.x > 0);
});

test('Steady Camera keeps still until the target is near the edge of the view', () => {
  const cam = new Camera(1920, 0, 0);
  cam.setView(800, 600);
  let p = { x: 100, y: 0 };
  cam.follow(() => p, { steady: true });
  cam.update(33);
  assert.equal(cam.x, 0);
  p = { x: 380, y: 0 };
  cam.update(33);
  assert.ok(cam.x > 0);
  // A short shot that stays on screen doesn't move the view at all.
  const still = new Camera(1920, 0, 0);
  still.setView(800, 600);
  still.follow(() => ({ x: 100, y: 50 }), { steady: true });
  still.update(33);
  still.endFollow();
  still.update(33);
  assert.equal(still.x, 0);
  assert.ok(!still.tracking);
});

test('Snap Back returns the view after tracking moved it, unless the player scrolled in between', () => {
  const cam = new Camera(1920, 0, 0);
  cam.follow(() => ({ x: 400, y: 0 }));
  for (let k = 0; k < 10; k++) cam.update(33);
  cam.endFollow();
  for (let k = 0; k < 100 && cam.tracking; k++) cam.update(33);
  assert.ok(cam.snapBack(true));
  for (let k = 0; k < 30; k++) cam.update(33);
  assert.equal(cam.x, 0);

  cam.follow(() => ({ x: 400, y: 0 }));
  for (let k = 0; k < 10; k++) cam.update(33);
  cam.scrollBy(5, 0);
  assert.ok(!cam.snapBack(true));
});

// The build menu and launcher selection (spec 10, Selecting a launcher,
// The build menu, The launching view).

import { PlayerControls, ITEMS_BY_LEVEL } from '../../src/client/core/controls.js';
import { makeGame } from '../helpers/setups.js';
import { place } from '../helpers/build.js';

test('items are grouped by level, 1, 3 and 7; a Battery offers only the attacking weapons; a disabled launcher none', () => {
  assert.equal(Object.values(ITEMS_BY_LEVEL).flat().length, 18);
  const game = makeGame();
  const c = new PlayerControls(game, 0);
  assert.equal(c.items(1).length, 6);
  const battery = place(game, 'battery', 0, 600, 300);
  c.select(battery.id);
  assert.deepEqual(c.items(1), ['shell', 'scatter']);
  assert.deepEqual(c.items(7), ['rover', 'worm']);
  battery.disabledUntil = 99;
  assert.deepEqual(c.items(1), []);
});

test('levels the player can\'t afford are disabled; the open level drops; with no energy the menu closes', () => {
  const game = makeGame();
  const c = new PlayerControls(game, 0);
  game.state.players[0].energy = 110;
  assert.ok(c.openLevel(7));
  game.state.players[0].energy = 50;
  c.checkLevel();
  assert.equal(c.level, 3);
  assert.ok(!c.levelOpen(7));
  game.state.players[0].energy = 5;
  assert.ok(!c.menuOpen);
});

test('next and previous go through the launchers in build order; a lost selected launcher passes to the next', () => {
  const game = makeGame();
  const c = new PlayerControls(game, 0);
  const citadel = c.selected;
  const a = place(game, 'outpost', 0, 600, 300);
  const b = place(game, 'battery', 0, 900, 300);
  assert.equal(c.step(1).id, a.id);
  assert.equal(c.step(1).id, b.id);
  assert.equal(c.step(1).id, citadel);
  assert.equal(c.step(-1).id, b.id);
  c.select(a.id);
  game.state.units.splice(game.state.units.indexOf(a), 1);
  c.onDestroyed(a.id);
  assert.equal(c.selected, b.id);
  game.state.units.splice(game.state.units.indexOf(b), 1);
  c.onDestroyed(b.id);
  assert.equal(c.selected, citadel, 'wrapping round');
});

test('each launcher remembers its own heading; a new building starts with the heading it was launched at', () => {
  const game = makeGame();
  const c = new PlayerControls(game, 0);
  c.setAim(100);
  const a = place(game, 'outpost', 0, 600, 300);
  c.onBuilt(a, 45, false);
  assert.notEqual(c.selected, a.id);
  c.select(a.id);
  assert.equal(c.aim(), 45 * 8);
  c.step(-1);
  assert.equal(c.aim(), 100);
  const b = place(game, 'outpost', 0, 900, 300);
  c.onBuilt(b, 10, true);
  assert.equal(c.selected, b.id, 'Select New Launchers');
});

test('changing launcher keeps the launching view only for the same kind, both working; Cancel only until Launch', () => {
  const game = makeGame();
  const c = new PlayerControls(game, 0);
  const a = place(game, 'outpost', 0, 600, 300);
  const b = place(game, 'battery', 0, 900, 300);
  assert.ok(c.pick('shell'));
  c.select(a.id);
  assert.equal(c.item, 'shell');
  c.select(b.id);
  assert.equal(c.item, null);
  c.pick('shell');
  c.launched = true;
  assert.ok(!c.cancel());
  c.launched = false;
  assert.ok(c.cancel());
  assert.equal(c.item, null);
});
