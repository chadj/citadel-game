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

import { POWER_MAX, START_ENERGY, MIN_TO_PLAY, TIMEOUT_COST, CLOCK_GRACE, CLOCK_SHRINK, CLOCK_MIN, NO_LAUNCHER_LIMIT, PX } from './constants.js';
import { divRound } from './math/fixed.js';
import { loadMap } from './terrain/map.js';
import { sampleTerrain } from './terrain/terrain.js';
import { launch, stepShot, makeWind } from './flight.js';
import { checkSetup } from './setup.js';
import { ITEMS, itemCost, canLaunch } from './items.js';
import { addUnit, findUnit, unitTop, isWorking, isLauncher, citadelOf, hasWorkingLauncher } from './units.js';
import { walkTo } from './effects.js';
import { payIncome, payCitadelBonus } from './energy.js';

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
    units: [],
    shots: [],
    nextId: 1,
    result: null, // when the game is over: { winner }, a side or null
  };
  const game = { setup, map, wind, sides, state, events: [] };

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
//   { type: 'launch', player, launcher, item, heading, power }
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
  game.events.push({ ...event, round: game.state.round, turn: game.state.turnCount });
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

  s.players[player].energy -= cost;
  const shot = launch({
    x: launcher.x,
    y: launcher.y,
    top: unitTop(launcher),
    heading: move.heading,
    power: move.power,
    launcher: launcher.kind,
  });
  s.shots.push({ id: s.nextId++, item: move.item, owner: player, ...shot });
  s.phase = 'flight';
  s.turn.launched = true;
  emit(game, { type: 'launch', player, launcher: launcher.id, item: move.item });
  return { ok: true };
}

// One tick of play. Does nothing unless something is in motion.
export function step(game) {
  const s = game.state;
  if (s.phase !== 'flight') return;
  const env = terrainEnv(game);
  for (const shot of [...s.shots]) {
    const landing = stepShot(shot, game.wind, env);
    if (landing) {
      s.shots.splice(s.shots.indexOf(shot), 1);
      emit(game, { type: 'land', shot: shot.id, item: shot.item, ...landing });
    }
  }
  if (s.shots.length === 0) changeTurn(game);
}

// Runs ticks until the game waits for a move, or is over.
export function settle(game) {
  for (let k = 0; game.state.phase === 'flight'; k++) {
    if (k >= MAX_SETTLE_TICKS) throw new Error('the turn never settled');
    step(game);
  }
}

function terrainEnv(game) {
  return { size: game.map.size, altitude: (x, y) => sampleTerrain(game.map, x, y).alt };
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
    for (const u of game.state.units) {
      if (u.disabledUntil === steps) emit(game, { type: 'recover', unit: u.id });
    }
  });
}

// At every change of turn (spec 03, A turn, The end of the game).
function changeTurn(game) {
  const s = game.state;
  s.phase = 'turn';
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

// The end of a round (spec 03, The end of a round). Rovers drive first
// (M5); then income is paid; then effects due at the change of round
// wear off, and the next round starts with the shifted order.
function endRound(game) {
  const s = game.state;
  emit(game, { type: 'roundOver' });
  payIncome(s);
  emit(game, { type: 'income' });
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
  emit(game, { type: 'gameOver', winner });
  return true;
}

// Removes a unit. `credited` is the player who gets the credit for it,
// or null (spec 06, Explosions and damage). Destroying a Citadel puts
// its owner out of the game, and may pay the Citadel bonus.
// Conduits and what burns after a building come in M3.
export function destroyUnit(game, unit, credited) {
  const s = game.state;
  s.units.splice(s.units.indexOf(unit), 1);
  emit(game, { type: 'destroy', unit: unit.id, kind: unit.kind });
  if (unit.citadel) {
    const p = s.players[unit.owner];
    p.knockedOut = true;
    p.mark = 'out';
    emit(game, { type: 'knockedOut', player: unit.owner });
    if (payCitadelBonus(s, game.sides, credited, unit.owner)) {
      emit(game, { type: 'citadelBonus', player: credited });
    }
  }
}

// The player whose turn it is gets the credit for what happens in it.
export function creditNow(game) {
  return game.state.turn?.player ?? null;
}
