// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Computer players (spec 09): fair play, personalities, getting its eye
// in, making a shot, being under attack, and whole games between
// computers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, applyMove, settle, step } from '../../src/rules/game.js';
import { updateFog } from '../../src/rules/fog.js';
import { citadelOf, UNIT_KINDS } from '../../src/rules/units.js';
import { hashState } from '../../src/rules/hash.js';
import { MIN_TO_PLAY, PX } from '../../src/rules/constants.js';
import { listJsFiles } from '../../tools/walk.js';
import { cornersFromTiles, sketchMapData } from '../../src/rules/terrain/map.js';
import { envFor, solve } from '../../src/ai/aim.js';
import { Brain, seeded } from '../../src/ai/brain.js';
import { PERSONALITIES, STYLE_WEIGHTS } from '../../src/ai/personalities.js';
import { PERSONALITIES as OFFERED, mapStarts, brainsFor } from '../../src/client/core/computers.js';
import { MAPS, mapData } from '../../src/client/core/maps.js';
import { Session, COMPUTER_MIN_MS } from '../../src/client/core/session.js';
import { makeSetup, makeGame, whoseTurn } from '../helpers/setups.js';
import { place, launchAt, builtUnit, richPlayers, aimAt } from '../helpers/build.js';
import { planFor, unitWorth, evaluate } from '../../src/ai/value.js';

const brain = (personality, player, seed = 1, starts = []) => new Brain(personality, player, { starts, random: seeded(seed) });

test('personalities: five to ten, each named, hardest to easiest, with every style', () => {
  assert.ok(PERSONALITIES.length >= 5 && PERSONALITIES.length <= 10);
  assert.equal(new Set(PERSONALITIES.map((p) => p.name)).size, PERSONALITIES.length);
  for (let k = 1; k < PERSONALITIES.length; k++) {
    const [a, b] = [PERSONALITIES[k - 1], PERSONALITIES[k]];
    assert.ok(b.aim >= a.aim && b.power >= a.power && b.judgment <= a.judgment && b.whim >= a.whim, `${b.name} is no easier than ${a.name}`);
  }
  const hardest = PERSONALITIES[0];
  assert.equal(hardest.aim, 0);
  assert.equal(hardest.power, 0);
  assert.ok(hardest.whim <= 0.05);
  const easiest = PERSONALITIES.at(-1);
  assert.equal(easiest.aim, 35);
  assert.equal(easiest.power, 0.25);
  assert.equal(easiest.whim, 0.5);
  assert.deepEqual(new Set(PERSONALITIES.map((p) => p.style)), new Set(Object.keys(STYLE_WEIGHTS)));
  // The setup screen offers them all, plus a random choice.
  assert.deepEqual(OFFERED.map((p) => p.id), ['random', ...PERSONALITIES.map((p) => p.id)]);
});

test('it sees only what its side sees, and remembers what the fog hides again', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  const enemy = place(game, 'battery', 0, 1300, 900);
  updateFog(game);
  const b = brain('warden', 1);
  b.observe(game);
  assert.ok(!b.memory.belief(game).state.units.some((u) => u.id === enemy.id), 'hidden in the fog');
  const spire = place(game, 'spire', 1, 1300, 700);
  updateFog(game);
  b.observe(game);
  assert.ok(b.memory.belief(game).state.units.some((u) => u.id === enemy.id), 'seen');
  game.state.units.splice(game.state.units.indexOf(spire), 1);
  updateFog(game);
  b.observe(game);
  assert.ok(b.memory.belief(game).state.units.some((u) => u.id === enemy.id), 'remembered');
});

test('it works out which Outpost is the Citadel: not one it saw a conduit run into', () => {
  const game = makeGame({ players: [{}, { computer: true }], fog: false });
  richPlayers(game);
  const built = builtUnit(game, launchAt(game, 'outpost', 300, 600).events);
  assert.ok(built);
  const b = brain('warden', 1, 1, [{ x: 300, y: 300 }, { x: 1300, y: 300 }]);
  b.observe(game);
  const odds = b.memory.citadelOdds(game);
  const citadel = citadelOf(game.state, 0);
  assert.equal(odds.get(built.id) ?? 0, 0);
  assert.ok(odds.get(citadel.id) > 0.5);
  // The copy it plans on doesn't take the real flag from the game.
  b.memory.notCitadel.add(citadel.id);
  const belief = b.memory.belief(game);
  assert.ok(!belief.state.units.find((u) => u.id === citadel.id).citadel);
});

test('thinking doesn\'t touch the real game, and a move is an ordinary, legal move', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  applyMove(game, { type: 'pass', player: 0 });
  settle(game);
  const before = hashState(game.state);
  const move = brain('lancer', 1).think(game, 1);
  assert.equal(hashState(game.state), before);
  assert.ok(applyMove(game, move).ok);
});

test('with too little to launch anything, it passes', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  applyMove(game, { type: 'pass', player: 0 });
  settle(game);
  game.state.players[1].energy = MIN_TO_PLAY - 1;
  assert.deepEqual(brain('warden', 1).think(game, 1), { type: 'pass', player: 1 });
});

test('getting its eye in: the same shot again strays less each time, down to none', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  const b = brain('drifter', 1, 5);
  b.game = game;
  const launcher = citadelOf(game.state, 1).id;
  const move = { type: 'launch', player: 1, launcher, item: 'shell', heading: 90, power: 500 };
  const c = { launcher, item: 'shell', heading: 90, power: 500, target: null };
  const offs = [];
  for (let k = 0; k < 6; k++) {
    const m = b.finish({ passValue: 0, scored: [{ c, move, v: 100 }] }, 1);
    offs.push(Math.abs(m.heading - 90) + Math.abs(m.power - 500) / 10);
  }
  assert.ok(offs[0] > 0, 'it strays at first');
  assert.equal(offs[4], 0);
  assert.equal(offs[5], 0);
});

test('the hardest computer destroys an exposed enemy Battery in reach', () => {
  const game = makeGame({ players: [{}, { computer: true }], fog: false });
  applyMove(game, { type: 'pass', player: 0 });
  settle(game);
  const battery = place(game, 'battery', 0, 1300, 680);
  const move = brain('warden', 1).think(game, 1);
  assert.equal(move.type, 'launch');
  assert.ok(applyMove(game, move).ok);
  settle(game);
  assert.ok(!game.state.units.includes(battery), `it launched ${move.item} and missed`);
});

test('it thinks in slices; the session waits about 1.5 s before its move', () => {
  const setup = makeSetup({ players: [{}, { computer: true, personality: 'mason' }] });
  const session = new Session(setup, { computers: brainsFor(setup) });
  session.pass(0);
  assert.equal(session.state.turn.player, 1);
  for (let t = 0; t < COMPUTER_MIN_MS - 100; t += 50) session.advance(50);
  assert.equal(session.moves.length, 1, 'still waiting');
  for (let t = 0; t < 30000 && session.moves.length === 1; t += 50) session.advance(50);
  assert.equal(session.moves.length, 2);
  assert.ok(['launch', 'pass'].includes(session.moves[1].type));
});

test('a game between computers on a real map: every move is accepted, and none times out', () => {
  const map = MAPS[0];
  const setup = makeSetup({ players: 2, fog: true });
  setup.map = mapData(map);
  setup.starts = map.starts[2][''].map((g) => g[0]);
  // The rules see both seats as human, so the game goes on.
  const game = createGame(setup);
  const starts = mapStarts(setup.map);
  assert.ok(starts.length >= 2);
  const brains = [brain('warden', 0, 2, starts), brain('drifter', 1, 3, starts)];
  let launched = 0;
  for (let turns = 0; game.state.phase !== 'over' && game.state.round <= 6 && turns < 200; turns++) {
    const p = whoseTurn(game);
    const move = brains[p].think(game, p);
    assert.notEqual(move.type, 'timeout');
    const result = applyMove(game, move);
    assert.ok(result.ok, result.reason);
    if (move.type === 'launch') launched += 1;
    settle(game);
  }
  assert.ok(launched >= 6, 'they played');
});

test('computer players are plain JavaScript, with no Phaser or browser', () => {
  for (const file of listJsFiles('src/ai')) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from 'phaser'|\bwindow\.|\bdocument\.|\/client\//, file);
  }
});

test('fenced in by water, it lays Pontoons and builds across', () => {
  // An island, ringed by water about a tile wide, across two tiles; the
  // vents and the enemy are beyond it.
  const rows = [];
  for (let y = 0; y < 48; y++) {
    let row = '';
    for (let x = 0; x < 48; x++) row += [5, 6].includes(Math.max(Math.abs(x - 8), Math.abs(y - 8))) ? '~' : '.';
    rows.push(row);
  }
  const setup = makeSetup({ players: [{}, { computer: true }], fog: false });
  setup.map = { name: 'Fenced', players: 2, planet: 'tundra', corners: cornersFromTiles(rows), vents: [{ x: 1020, y: 510, size: 'large' }, { x: 510, y: 1020, size: 'large' }] };
  setup.starts = [{ x: 1950, y: 1950 }, { x: 510, y: 510 }];
  const game = createGame(setup);
  const b = brain('warden', 1, 3, setup.starts);
  const across = () => game.state.units.some((u) => u.owner === 1 && u.kind !== 'pontoon' && u.kind !== 'rover'
    && Math.max(Math.abs(Math.floor(u.x / PX / 60) - 8), Math.abs(Math.floor(u.y / PX / 60) - 8)) > 6);
  while (game.state.round <= 8 && !across()) {
    const p = whoseTurn(game);
    assert.ok(applyMove(game, p === 0 ? { type: 'pass', player: 0 } : b.think(game, 1)).ok);
    settle(game);
  }
  assert.ok(game.state.units.some((u) => u.owner === 1 && u.kind === 'pontoon'));
  assert.ok(across(), 'a building stands beyond the water');
});

test('a Pontoon counts as often as its aim would land it: narrow water is a poorer bet', () => {
  // A channel 300 px east of the Citadel, and a wide lake as far south (spec 02, Landforms; decision D55).
  const setup = makeSetup({ players: [{}, { computer: true }], fog: false });
  setup.map = sketchMapData({ water: Array(32).fill('.......1'), rows: Array(6).fill('~~~~~~'), at: [0, 5] });
  setup.starts = [{ x: 1500, y: 1500 }, { x: 150, y: 150 }];
  const game = createGame(setup);
  const env = envFor(game);
  const citadel = citadelOf(game.state, 1);
  const move = (x, y) => {
    const shot = solve(game, env, citadel, { x: x * PX, y: y * PX });
    return { type: 'launch', player: 1, launcher: citadel.id, item: 'pontoon', heading: shot.heading, power: shot.power };
  };
  const channel = move(450, 150); // the channel down tile column 7
  const lake = move(150, 450); // the middle of the lake
  assert.equal(brain('warden', 1).landChance(game, channel), 1, 'the hardest never strays');
  const drifter = brain('drifter', 1);
  const [c, l] = [drifter.landChance(game, channel), drifter.landChance(game, lake)];
  assert.ok(c < l, `channel ${c}, lake ${l}`);
  assert.ok(c < 0.5 && l > 0.5, `channel ${c}, lake ${l}`);
});

// Player 0's Battery, hidden in the fog 600 px south of player 1's
// Citadel, shells it; the computer watches the flight tick by tick, as
// the game does (decision D59).
function shelledFromTheFog(b, item = 'shell') {
  const game = makeGame({ players: [{}, { computer: true }] });
  const battery = place(game, 'battery', 0, 1300, 900);
  updateFog(game);
  b.observe(game);
  const citadel = citadelOf(game.state, 1);
  const { heading, power } = aimAt(game, battery, citadel.x / PX, citadel.y / PX);
  assert.ok(applyMove(game, { type: 'launch', player: 0, launcher: battery.id, item, heading, power }).ok);
  while (game.state.phase === 'flight') {
    step(game);
    b.watch(game);
  }
  b.observe(game);
  return { game, battery, citadel };
}

const far = (game, a, b) => Math.hypot(a.x - b.x, a.y - b.y) / PX;

test('hit from the fog: it traces the shot back, and its Citadel is under attack', () => {
  const b = brain('warden', 1);
  const { game, battery, citadel } = shelledFromTheFog(b);
  assert.ok(citadel.armor < UNIT_KINDS.outpost.armor, 'the shell hit');
  const lead = b.memory.leads.find((l) => l.kind === 'shooter');
  assert.ok(lead && far(game, lead, battery) < 150, `traced to ${lead && [lead.x / PX, lead.y / PX]}`);
  assert.equal(b.memory.attacked(game.state).get(citadel.id), 1);
  // The Battery stays hidden; an Outpost stands in for it, guessed.
  const units = b.memory.belief(game).state.units;
  assert.ok(!units.some((u) => u.id === battery.id));
  const guess = units.find((u) => u.id < 0);
  assert.ok(guess && guess.kind === 'outpost' && guess.owner === 0 && guess.guess < 1);
});

test('it guesses where a shot came from as a person would: roughly, and the easier computers less closely', () => {
  const median = (who) => {
    const offs = Array.from({ length: 15 }, (_, k) => {
      const b = brain(who, 1, k + 1);
      const { game, battery } = shelledFromTheFog(b);
      const lead = b.memory.leads.find((l) => l.kind === 'shooter');
      return lead ? far(game, lead, battery) : Infinity;
    }).sort((a, b) => a - b);
    return offs[7];
  };
  const [hardest, easiest] = [median('warden'), median('drifter')];
  assert.ok(hardest > 20, `the hardest is ${hardest} px off: too exact`);
  assert.ok(easiest > hardest && easiest < 200, `${hardest} px, ${easiest} px`);
});

test('shots from the same place sharpen its guess', () => {
  const b = brain('warden', 1, 2);
  const { game, battery, citadel } = shelledFromTheFog(b);
  const first = far(game, b.memory.leads.find((l) => l.kind === 'shooter'), battery);
  for (let k = 0; k < 5; k++) {
    Object.assign(game.state, { phase: 'turn' });
    game.state.turn.player = 0;
    // Beside the Citadel, in its sight, so the game goes on.
    const { heading, power } = aimAt(game, battery, citadel.x / PX + (k % 2 ? 150 : -150), citadel.y / PX + 60);
    assert.ok(applyMove(game, { type: 'launch', player: 0, launcher: battery.id, item: 'shell', heading, power }).ok);
    while (game.state.phase === 'flight') {
      step(game);
      b.watch(game);
    }
    b.observe(game);
  }
  const leads = b.memory.leads.filter((l) => l.kind === 'shooter');
  assert.equal(leads.length, 1, 'one launcher');
  assert.equal(game.state.phase, 'turn');
  assert.equal(leads[0].seen, 6);
  assert.ok(far(game, leads[0], battery) < first, `${first} px, then ${far(game, leads[0], battery)} px`);
});

test('with its Citadel hit from the fog, the harder computers defend it before anything else', () => {
  for (const [who, seed] of [['warden', 4], ['forge', 1], ['sentry', 1]]) {
    const b = brain(who, 1, seed);
    const { game, citadel } = shelledFromTheFog(b);
    const move = b.think(game, 1);
    assert.ok(['interceptor', 'charges', 'barrier'].includes(move.item), `${who} launched ${move.item}`);
    assert.equal(move.launcher, citadel.id);
  }
});

test('without watching the flight, the old way, it still knows it was hit', () => {
  const b = brain('warden', 1, 4);
  const { game, citadel } = shelledFromTheFog({ observe: (g) => b.observe(g), watch() {} });
  assert.equal(b.memory.leads.length, 0);
  assert.ok(b.memory.attacked(game.state).has(citadel.id));
});

test('an attack keeps a building on alert for three turn cycles, then wears off', () => {
  const b = brain('warden', 1);
  const { game, citadel } = shelledFromTheFog(b);
  const seats = game.state.seats.length;
  game.state.cycle.steps += 3 * seats;
  assert.ok(b.memory.attacked(game.state).has(citadel.id), 'still on alert');
  game.state.cycle.steps += 1;
  assert.ok(!b.memory.attacked(game.state).has(citadel.id), 'worn off');
});

test('its own Citadel counts for as much however hurt it is', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  const b = brain('warden', 1);
  b.observe(game);
  const plan = planFor(game, 1, b.personality, b.weights, b.memory);
  const citadel = citadelOf(game.state, 1);
  const whole = unitWorth(plan, citadel, true);
  assert.equal(unitWorth(plan, { ...citadel, armor: 10 }, true), whole);
});

test('the sign of damage on an enemy unit in the fog is a lead, but shows nothing else', () => {
  const game = makeGame({ players: [{}, { computer: true }] });
  const hidden = place(game, 'outpost', 0, 1300, 1000, { armor: 20 });
  updateFog(game);
  const b = brain('warden', 1);
  b.observe(game);
  const lead = b.memory.leads.find((l) => l.kind === 'sign');
  assert.ok(lead && far(game, lead, hidden) < 1);
  assert.ok(!b.memory.belief(game).state.units.some((u) => u.id === hidden.id || u.id < 0));
});

// Player 1's Citadel, with player 0's Outpost 400 px south of it, in
// reach; and Charges of player 1's at the given points, in pixels.
function chargesBy(points) {
  const game = makeGame({ players: [{}, { computer: true }], fog: false });
  const citadel = citadelOf(game.state, 1);
  const [cx, cy] = [citadel.x / PX, citadel.y / PX];
  place(game, 'outpost', 0, cx, cy + 400);
  for (const [dx, dy] of points) place(game, 'charge', 1, cx + dx, cy + dy);
  const b = brain('warden', 1);
  b.observe(game);
  return evaluate(game, planFor(game, 1, b.personality, b.weights, b.memory));
}

test('Charges within each other\'s blast count as one shot stopped', () => {
  const none = chargesBy([]);
  const one = chargesBy([[100, 0]]);
  const three = chargesBy([[100, 0], [100, 50], [100, -50]]);
  const apart = chargesBy([[100, 0], [-100, 0], [0, -100]]);
  assert.ok(one > none, 'one Charge covers it a little');
  // Two more beside it add less than the 2 energy they'd cost.
  assert.ok(three - one < 20, `three together ${three}, one ${one}`);
  assert.ok(apart > one, `three apart ${apart}, one ${one}`);
});

test('its own Charges in the way of its fire at the enemy count against them', () => {
  // The same distance from the Citadel: toward the enemy Outpost, or away.
  assert.ok(chargesBy([[0, 100]]) < chargesBy([[0, -100]]));
});
