// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game: its state, the moves, turns and rounds (spec 03; spec 12,
// Every machine plays the same game).
//
// A game is { setup, map, wind, sides, state, events }. Only `state` is
// game state: plain data, hashed by the determinism checks. `events`
// tells the screen and sound what happened; it isn't part of the state.
//
// The game waits in the 'turn' phase for a move from the player whose
// turn it is. A launch moves it to 'flight', which runs a tick at a time
// (step) until everything has settled. Then the turn changes hands.
// Passes, timeouts and disconnects take effect at once.

import {
  POWER_MAX, START_ENERGY, MIN_TO_PLAY, TIMEOUT_COST, CLOCK_GRACE, CLOCK_SHRINK, CLOCK_MIN,
  NO_LAUNCHER_LIMIT, PX, PONTOON_FALL_DELAY, EXTRACTOR_BLAST, CHARGE_BLAST, ROVER_BLAST, CHARGE_TRIGGER,
  ROVER_UNDERWATER, CITADEL_BONUS,
} from './constants.js';
import { divRound } from './math/fixed.js';
import { loadMap } from './terrain/map.js';
import { sampleTerrain, tileIndex } from './terrain/terrain.js';
import { launch, makeWind } from './flight.js';
import { checkSetup } from './setup.js';
import { ITEMS, BUILDING, itemCost, canLaunch } from './items.js';
import {
  UNIT_KINDS, addUnit, findUnit, unitTop, isWorking, isLauncher, citadelOf, hasWorkingLauncher,
} from './units.js';
import { walkTo } from './effects.js';
import { payIncome, payCitadelBonus } from './energy.js';
import {
  createConduit, fallNodes, breakReason, burn, advanceBurns, conduitsBusy, conduitWarning, isGone,
} from './conduits.js';
import { stepShots, shotFields, failBuilding, endShot } from './shots.js';
import { createFog, updateFog, dropLingers } from './fog.js';
import { domesAround } from './barriers.js';
import { fireInterceptors, stepMissiles } from './interceptors.js';
import { runPending, scheduleBlast, armedChargeNear, setOff } from './combat.js';
import { wormsWearOff } from './worm.js';
import { roversToDrive, nextDrive, stepDrive } from './rovers.js';

const MAX_SETTLE_TICKS = 30 * 600;

export function createGame(setup) {
  const sides = checkSetup(setup);
  const map = loadMap(setup.map);
  const wind = makeWind(setup.wind.level, setup.wind.dir, setup.wind.variation);
  const n = setup.players.length;
  const state = {
    round: 1,
    phase: 'turn',
    seats: [...setup.order],
    starterSeat: 0,
    turnCount: 0,
    turn: null,
    cycle: { seat: 0, steps: 0 },
    players: Array.from({ length: n }, () => ({
      energy: START_ENERGY,
      aside: 0,
      salvaged: 0,
      passed: false,
      inRound: true,
      disconnected: false,
      knockedOut: false,
      mark: null, // the newest mark in the order of play: 'out' or 'left'
    })),
    tick: 0, // ticks of play so far; only moves while something is in motion
    units: [],
    conduits: [],
    shots: [],
    missiles: [], // Interceptor missiles in flight (interceptors.js)
    pending: [], // effects that wait: blasts, Pulses, Surges, Salvagers (combat.js)
    roverQueue: [], // Rovers still to drive at this round's end (rovers.js)
    drive: null, // the Rover driving now
    fog: null, // fog of war counts, with fog on (fog.js)
    lingers: [], // where weapons' views of the fog linger
    nextId: 1,
    result: null, // when the game is over: { winner }, a side or null
  };
  const game = { setup, map, wind, sides, state, events: [] };
  state.fog = createFog(game);

  // Each player's Citadel, at their start (spec 02, Start positions).
  setup.starts.forEach((start, player) => {
    const x = start.x * PX;
    const y = start.y * PX;
    addUnit(state, { kind: 'outpost', owner: player, x, y, base: sampleTerrain(map, x, y).alt, citadel: true });
  });

  beginTurn(game, 0, null);
  return game;
}

// Applies a move. Returns { ok: true }, or { ok: false, reason } and
// leaves the game unchanged. A move is one of:
//   { type: 'launch', player, launcher, item, heading, power, override }
//   { type: 'pass', player }
//   { type: 'timeout', player }
//   { type: 'disconnect', player }
export function applyMove(game, move) {
  const s = game.state;
  if (s.phase === 'over') return refuse('the game is over');

  if (move?.type === 'disconnect') {
    const p = s.players[move.player];
    if (!p) return refuse('no such player');
    if (p.disconnected) return refuse('that player has already disconnected');
    p.disconnected = true;
    p.mark = 'left';
    emit(game, { type: 'disconnect', player: move.player });
    // If it was their turn, they pass (spec 03, Players who disconnect).
    if (s.phase === 'turn' && s.turn.player === move.player) {
      passTurn(game);
      changeTurn(game);
    }
    return { ok: true };
  }

  if (s.phase !== 'turn') return refuse('wait until the turn is over');
  if (move?.player !== s.turn.player) return refuse('it isn\'t that player\'s turn');

  switch (move.type) {
    case 'pass':
      passTurn(game);
      changeTurn(game);
      return { ok: true };
    case 'timeout': {
      const p = s.players[move.player];
      p.energy = Math.max(0, p.energy - TIMEOUT_COST);
      emit(game, { type: 'timeout', player: move.player });
      changeTurn(game);
      return { ok: true };
    }
    case 'launch':
      return launchMove(game, move);
    default:
      return refuse('unknown move');
  }
}

function refuse(reason) {
  return { ok: false, reason };
}

function emit(game, event) {
  game.events.push({ ...event, round: game.state.round, turn: game.state.turnCount, tick: game.state.tick });
}

function passTurn(game) {
  const p = game.state.players[game.state.turn.player];
  p.aside += p.energy;
  p.energy = 0;
  p.passed = true;
  emit(game, { type: 'pass', player: game.state.turn.player });
}

function launchMove(game, move) {
  const s = game.state;
  const player = move.player;
  const launcher = findUnit(s, move.launcher);
  if (!launcher || launcher.owner !== player || !isLauncher(launcher)) return refuse('that isn\'t one of your launchers');
  if (!isWorking(s, launcher)) return refuse('that launcher is disabled');
  if (!ITEMS[move.item]) return refuse('no such item');
  if (!canLaunch(launcher.kind, move.item)) return refuse('a Battery launches only the attacking weapons');
  const cost = itemCost(move.item);
  if (s.players[player].energy < cost) return refuse('not enough energy');
  if (!Number.isInteger(move.heading) || move.heading < 0 || move.heading >= 360) return refuse('the heading must be a whole degree from 0 to 359');
  if (!Number.isInteger(move.power) || move.power < 0 || move.power > POWER_MAX) return refuse(`the power must be a whole number from 0 to ${POWER_MAX}`);
  if (move.override !== undefined && typeof move.override !== 'boolean') return refuse('override must be true or false');
  const building = ITEMS[move.item].category === BUILDING;
  // Launch is refused for a building while the conduit warning shows,
  // unless the player overrides it (spec 05, Aiming along your own
  // conduit).
  if (building && !move.override && conduitWarning(s, launcher, move.heading, game.map.size).length > 0) {
    return refuse('the new conduit would start too close to one of this launcher\'s conduits');
  }

  s.players[player].energy -= cost;
  const flight = launch({
    x: launcher.x,
    y: launcher.y,
    top: unitTop(launcher),
    heading: move.heading,
    power: move.power,
    launcher: launcher.kind,
    windFromStart: !building,
  });
  const shot = {
    ...shotFields(game, {
      item: move.item, owner: player, launcher: launcher.id, heading: move.heading,
      startedIn: domesAround(game, game.sides[player], flight.x, flight.y, flight.z),
    }),
    ...flight,
  };
  s.shots.push(shot);
  if (building) shot.conduit = createConduit(s, { owner: player, launcher, shot }).id;
  s.phase = 'flight';
  s.turn.launched = true;
  emit(game, { type: 'launch', player, launcher: launcher.id, item: move.item });
  return { ok: true };
}

// One tick of play. Does nothing unless something is in motion. Within
// a tick, in this order (spec 01, The flight: every client uses the same
// order; decision D32):
//   1. shots move, and end where they meet something or land;
//   2. Interceptors fire at shots that have come into range;
//   3. missiles move, and catch what they reach;
//   4. conduit nodes fall and settle;
//   5. burns move on;
//   6. waiting effects whose time has come go off;
//   7. buildings that burning conduits have reached are destroyed.
// The turn passes once everything has settled (spec 06, The turn
// waits).
//
// At the end of a round, the game is in the 'rovers' phase instead: the
// Rover whose turn it is to drive moves after the missiles, and the next
// one starts once everything has settled (spec 07, When Rovers drive).
export function step(game) {
  const s = game.state;
  if (s.phase !== 'flight' && s.phase !== 'rovers') return;
  s.tick += 1;
  const ctx = context(game);
  stepShots(ctx);
  fireInterceptors(ctx);
  stepMissiles(ctx, (missile) => caught(ctx, missile));
  stepDrive(ctx);

  for (const [conduit, index, groundType] of fallNodes(s, ctx.terrain)) {
    const node = conduit.nodes[index];
    if (isGone(s, node)) continue;
    // A node near an armed Charge breaks the conduit, and sets it off.
    const charge = armedChargeNear(game, node.x, node.y, node.z, CHARGE_TRIGGER);
    if (charge) setOff(ctx, charge, creditNow(game));
    const reason = charge ? 'charge' : breakReason(s, conduit, node, groundType, game.map.size);
    emit(game, { type: 'nodeSettled', conduit: conduit.id, index, broke: reason });
    if (reason) burn(conduit, index, s.tick, 'break', creditNow(game));
  }

  const doomed = advanceBurns(s, (conduit, index) => emit(game, { type: 'nodeBurnt', conduit: conduit.id, index }));
  runPending(ctx);
  for (const [unitId, credit, fails] of doomed) {
    const unit = findUnit(s, unitId);
    if (unit) destroyUnit(game, unit, credit, fails ? 'failed' : 'destroyed', { burnt: true });
  }

  dropLingers(s);
  if (game.liveFog) updateFog(game);
  const busy = s.shots.length > 0 || s.missiles.length > 0 || s.pending.length > 0 || conduitsBusy(s)
    || (s.drive !== null && !s.drive.done) || s.lingers.length > 0;
  if (busy) return;
  if (s.phase === 'flight') changeTurn(game);
  else if (!nextDrive(s)) finishRound(game);
}

// What the parts of a tick share: the terrain as it stands, with any
// Pontoons on it, and the ways to report and destroy things.
function context(game) {
  const tops = pontoonTops(game);
  const terrain = (x, y) => sampleTerrain(game.map, x, y, tops);
  return {
    game,
    terrain,
    env: { size: game.map.size, altitude: (x, y) => terrain(x, y).alt },
    emit: (event) => emit(game, event),
    credit: () => creditNow(game),
    destroy: (unit, credit, how) => destroyUnit(game, unit, credit, how),
  };
}

// A missile reached what it chased. A shot is destroyed where it is and
// does nothing; a unit that was still landing is destroyed, its landing
// failed (spec 06, The chase, When the chase fails).
function caught(ctx, missile) {
  const s = ctx.game.state;
  const shot = s.shots.find((sh) => sh.id === missile.shot);
  if (shot) {
    endShot(ctx.game, shot);
    ctx.emit({ type: 'caught', shot: shot.id, item: shot.item, x: shot.x, y: shot.y, z: shot.z });
    if (ITEMS[shot.item].category === BUILDING) failBuilding(ctx, shot, 'caught');
    return;
  }
  const unit = missile.unit !== null ? findUnit(s, missile.unit) : null;
  if (!unit) return;
  // A Rover on land has landed and is working, so it explodes (spec 06).
  if (unit.kind === 'rover') unit.landing = false;
  destroyUnit(ctx.game, unit, creditNow(ctx.game), unit.kind === 'rover' ? 'destroyed' : 'failed');
}

// Each Pontoon's tile, and the altitude of its top.
function pontoonTops(game) {
  const tops = new Map();
  for (const u of game.state.units) {
    if (u.kind === 'pontoon') tops.set(tileIndex(game.map, u.x, u.y), u.base + UNIT_KINDS.pontoon.height);
  }
  return tops;
}

// Runs ticks until the game waits for a move, or is over.
export function settle(game) {
  for (let k = 0; game.state.phase === 'flight' || game.state.phase === 'rovers'; k++) {
    if (k >= MAX_SETTLE_TICKS) throw new Error('the turn never settled');
    step(game);
  }
}

// The player out for the rest of the round (spec 03, Out for the round).
function updateInRound(s) {
  s.players.forEach((p, i) => {
    if (p.passed || p.energy < MIN_TO_PLAY || !citadelOf(s, i) || p.disconnected) p.inRound = false;
  });
}

// The first seat after `from` whose player is still in the round: at
// least one seat on, and `from` itself last. null if nobody is.
function nextSeatInRound(s, from) {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n;
    if (s.players[s.seats[seat]].inRound) return seat;
  }
  return null;
}

function walk(game, seat) {
  walkTo(game.state, seat, (steps) => {
    wormsWearOff(game, steps, (event) => emit(game, event));
    for (const u of game.state.units) {
      if (u.disabledUntil === steps) emit(game, { type: 'recover', unit: u.id });
    }
  });
}

// At every change of turn (spec 03, A turn, The end of the game).
function changeTurn(game) {
  const s = game.state;
  s.phase = 'turn';
  // Everything has settled: new Barriers come up (decision D12), and
  // new Charges are armed (spec 04, Proximity Charges).
  for (const u of s.units) {
    if (u.kind === 'barrier' && !u.up) {
      u.up = true;
      emit(game, { type: 'barrierUp', unit: u.id });
    }
    if (u.kind === 'charge') u.armed = true;
  }
  if (checkGameOver(game)) return;
  updateInRound(s);
  const seat = nextSeatInRound(s, s.turn.seat);
  if (seat === null) {
    endRound(game);
    return;
  }
  const previous = s.turn;
  walk(game, seat);
  const backToBack = s.seats[seat] === previous.player;
  beginTurn(game, seat, backToBack ? previous.limit : null);
}

// The end of a round (spec 03, The end of a round). Rovers drive first,
// one at a time, in the 'rovers' phase; then income is paid; then
// effects due at the change of round wear off, and the next round starts
// with the shifted order.
function endRound(game) {
  const s = game.state;
  emit(game, { type: 'roundOver' });
  s.roverQueue = roversToDrive(s);
  if (nextDrive(s)) {
    s.phase = 'rovers';
    return;
  }
  finishRound(game);
}

function finishRound(game) {
  const s = game.state;
  s.phase = 'turn';
  s.drive = null;
  const gains = payIncome(s);
  emit(game, { type: 'income', gains });
  s.players.forEach((p) => {
    p.passed = false;
    p.inRound = true;
  });
  updateInRound(s);

  // The next player after this round's first, skipping players out of
  // the game.
  const n = s.seats.length;
  let starter = null;
  for (let k = 1; k <= n; k++) {
    const seat = (s.starterSeat + k) % n;
    if (citadelOf(s, s.seats[seat])) {
      starter = seat;
      break;
    }
  }
  const first = starter === null ? null
    : s.players[s.seats[starter]].inRound ? starter : nextSeatInRound(s, starter);
  if (first !== null) walk(game, first);
  if (checkGameOver(game)) return;
  if (first === null) throw new Error('nobody can play in the new round');
  s.round += 1;
  s.starterSeat = starter;
  emit(game, { type: 'roundStart' });
  beginTurn(game, first, null);
}

// Starts the turn of the player at `seat`. `previousLimit` is the last
// turn's limit when this turn follows the same player's own, or null.
function beginTurn(game, seat, previousLimit) {
  const s = game.state;
  const player = s.seats[seat];
  const noLauncher = !hasWorkingLauncher(s, player);
  s.turn = {
    seat,
    player,
    limit: turnLimit(game.setup.clock, noLauncher, previousLimit),
    noLauncher,
    launched: false,
  };
  s.turnCount += 1;
  s.phase = 'turn';
  updateFog(game);
  emit(game, { type: 'turnStart', player, limit: s.turn.limit, noLauncher });
}

// A turn's time limit in milliseconds, or null for none (spec 03, The
// shot clock; decision D28).
export function turnLimit(clock, noLauncher, previousLimit) {
  if (noLauncher) return NO_LAUNCHER_LIMIT;
  if (clock === 0) return null;
  if (previousLimit !== null) return Math.max(CLOCK_MIN, divRound(previousLimit * CLOCK_SHRINK, 100));
  return divRound(clock * 1000 * CLOCK_GRACE, 100);
}

// The game is over when fewer than two sides are left, or when no
// connected human is left in it (spec 03, The end of the game).
function checkGameOver(game) {
  const s = game.state;
  const alive = s.players.map((_, i) => i).filter((i) => !s.players[i].knockedOut);
  const sides = [...new Set(alive.map((i) => game.sides[i]))];
  let winner;
  if (sides.length < 2) winner = sides.length === 1 ? sides[0] : null;
  else if (!alive.some((i) => !game.setup.players[i].computer && !s.players[i].disconnected)) winner = null;
  else return false;
  s.phase = 'over';
  s.result = { winner };
  // The fog as at a turn's start, so the final state is the same on
  // every machine, whether it kept the fog up during the flight or not.
  updateFog(game);
  emit(game, { type: 'gameOver', winner });
  return true;
}

// Removes a unit. `credited` is the player who gets the credit for it,
// or null (spec 06, Explosions and damage). `how` is 'destroyed',
// 'failed' (its landing failed), 'salvaged' or 'sunk'.
// - An Extractor or a Charge that is destroyed while working explodes
//   a moment later (spec 04, When a unit is destroyed). One whose
//   landing failed, or that was salvaged or sank, doesn't.
// - A building's conduits burn: the one leading into it back toward its
//   launcher, which isn't harmed; each one leading out of it toward the
//   building at its far end, which goes when the burn reaches it
//   (spec 05, When a building is destroyed).
// - Destroying a Citadel puts its owner out of the game, and may pay
//   the Citadel bonus (spec 03).
// - A destroyed Pontoon's tile is water again (spec 02, Pontoons).
// `burnt` marks a unit destroyed by the burn reaching it along its
// conduit, not by a hit, for the screen (spec 11, the aide).
export function destroyUnit(game, unit, credited, how = 'destroyed', { burnt = false } = {}) {
  const s = game.state;
  const failed = how !== 'destroyed' || unit.landing;
  const working = isWorking(s, unit);
  s.units.splice(s.units.indexOf(unit), 1);
  emit(game, {
    type: 'destroy', unit: unit.id, kind: unit.kind, owner: unit.owner, how: failed && how === 'destroyed' ? 'failed' : how, by: credited,
    ...(burnt && { burnt: true }),
  });
  if (!failed && working) {
    if (unit.kind === 'extractor') scheduleBlast(s, unit, EXTRACTOR_BLAST, credited);
    if (unit.kind === 'charge' && !unit.triggered) scheduleBlast(s, unit, CHARGE_BLAST, credited);
    if (unit.kind === 'rover' && !unit.triggered) scheduleBlast(s, unit, ROVER_BLAST, credited);
  }
  for (const conduit of s.conduits) {
    if (conduit.to === unit.id) burn(conduit, conduit.nodes.length - 1, s.tick, 'child', credited);
    if (conduit.from === unit.id) burn(conduit, 0, s.tick, 'parent', credited);
  }
  if (unit.kind === 'pontoon') sinkPontoon(game, unit, credited);
  if (unit.citadel) {
    const p = s.players[unit.owner];
    p.knockedOut = true;
    p.mark = 'out';
    emit(game, { type: 'knockedOut', player: unit.owner, by: credited });
    if (payCitadelBonus(s, game.sides, credited, unit.owner)) {
      emit(game, { type: 'citadelBonus', player: credited, amount: CITADEL_BONUS });
    }
  }
}

// When a Pontoon is destroyed, its tile is water again at once. The
// buildings standing on it fall in and are destroyed, without exploding.
// A moment later, each conduit crossing it falls in, and burns both ways
// from there (spec 02, Pontoons; spec 05, Conduits across a Pontoon).
// Rovers on it drop into the water, and carry on underwater.
function sinkPontoon(game, pontoon, credited) {
  const s = game.state;
  const tile = tileIndex(game.map, pontoon.x, pontoon.y);
  for (const u of s.units) {
    if (u.kind === 'rover' && tileIndex(game.map, u.x, u.y) === tile) {
      u.base = -ROVER_UNDERWATER;
      emit(game, { type: 'splash', x: u.x, y: u.y, z: 0, unit: u.id });
    }
  }
  for (const u of [...s.units]) {
    if (ITEMS[u.kind]?.category === BUILDING && tileIndex(game.map, u.x, u.y) === tile && s.units.includes(u)) {
      destroyUnit(game, u, credited, 'sunk');
    }
  }
  for (const conduit of s.conduits) {
    conduit.nodes.forEach((node, index) => {
      if (node.resting && !isGone(s, node) && tileIndex(game.map, node.x, node.y) === tile) {
        burn(conduit, index, s.tick + PONTOON_FALL_DELAY, 'sink', credited);
      }
    });
  }
}

// The player whose turn it is gets the credit for what happens in it.
export function creditNow(game) {
  // While Rovers drive at the end of a round, it's nobody's turn: the
  // Rover's owner gets the credit (spec 07, When it explodes).
  if (game.state.phase === 'rovers') return game.state.drive?.owner ?? null;
  return game.state.turn?.player ?? null;
}
