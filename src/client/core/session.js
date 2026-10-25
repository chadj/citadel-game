// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// A game played on this machine: hot seat, against computers, or a
// replay played back (spec 10, Hot seat; spec 12, Replays). It runs the
// rules a tick at a time in real time, keeps the shot clock, asks
// computer players for their moves, and records the replay.
//
// The screen listens for what happens: every rules event, in order, as
// it happens, and these of its own, marked `client: true`:
//   viewer       the screen now shows another human's view
//   clockWarning about three quarters of the turn's time is gone
//   clockReminder with the clock off, another 30 seconds have gone
//   timeUp       the turn's time ran out
//   refused      a move was refused, with its reason

import { createGame, applyMove, step } from '../../rules/game.js';
import { RULES_VERSION } from '../../rules/version.js';
import { TICKS_PER_SECOND, CLOCK_START_DELAY, CLOCK_WARNING } from '../../rules/constants.js';

export const TICK_MS = 1000 / TICKS_PER_SECOND;
// The end of the round is announced before Rovers drive (spec 03, What
// players see): they wait this long after the announcement appears.
export const ROUND_ANNOUNCE_MS = 1200;
// A computer waits about 1.5 seconds when its turn starts, so players
// can see whose turn it is (spec 09, Playing fair).
export const COMPUTER_MIN_MS = 1500;
// It thinks in slices of about this much of each frame, and makes the
// best move it has at its limit (spec 09: about 20 to 30 seconds).
export const THINK_SLICE_MS = 8;
export const COMPUTER_LIMIT_MS = 25000;
// With the clock off, a reminder about every 30 seconds (spec 03).
export const REMINDER_MS = 30000;
// A replay plays each move after this pause.
export const REPLAY_MOVE_MS = 700;
// At most this many ticks run in one frame, so a slow frame can't snowball.
const MAX_TICKS_PER_ADVANCE = 8;

export class Session {
  // `computers` maps a computer player's index to its brain:
  // { think(game, player) → move }, and optionally
  // { begin(game, player) → { work(ms) → move or null, best() → move },
  //   observe(game) } to think in slices and to look at every turn.
  // `replay` plays a replay back.
  constructor(setup, { computers = {}, replay = null } = {}) {
    this.setup = setup;
    this.game = createGame(setup);
    // The screen shows the fog as shots fly (fog.js).
    this.game.liveFog = true;
    this.computers = computers;
    this.replayMoves = replay ? [...replay.moves] : null;
    this.moves = [];
    this.listeners = [];
    this.seen = 0; // events passed to listeners so far
    this.acc = 0;
    this.hold = 0;
    this.menuOpen = false;
    this.replayPaused = false;
    this.turnMs = 0;
    this.clockStopped = false;
    this.warned = false;
    this.reminders = 0;
    this.waitMs = 0;
    this.viewer = this.firstHuman();
    this.startTurn();
  }

  get state() {
    return this.game.state;
  }

  get watching() {
    return this.replayMoves !== null;
  }

  isComputer(player) {
    return this.setup.players[player].computer;
  }

  firstHuman() {
    const s = this.game.state;
    const turn = s.turn.player;
    if (!this.isComputer(turn)) return turn;
    return s.seats.find((p) => !this.isComputer(p)) ?? 0;
  }

  on(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  // The game pauses while the menu is open, when every other player is
  // a computer (spec 10, The game menu). Shots already in the air carry
  // on; nothing new starts.
  get paused() {
    if (this.watching) return this.replayPaused;
    if (!this.menuOpen) return false;
    return this.setup.players.every((p, i) => i === this.viewer || p.computer);
  }

  // The replay: the setup and the moves so far (spec 12, Replays).
  replay() {
    return { rulesVersion: RULES_VERSION, setup: this.setup, moves: [...this.moves] };
  }

  // The shot clock as it stands: the turn's limit in ms (null for
  // none), how much of it has gone, and whether it's running.
  clock() {
    const s = this.game.state;
    if (s.phase !== 'turn' || this.watching || this.isComputer(s.turn.player)) {
      return { limit: s.turn?.limit ?? null, gone: 0, running: false };
    }
    const gone = Math.max(0, this.turnMs - CLOCK_START_DELAY);
    return { limit: s.turn.limit, gone, running: !this.clockStopped && this.turnMs >= CLOCK_START_DELAY };
  }

  // Whether this player can act now: it's their turn, they haven't
  // launched, and their time hasn't run out.
  canAct(player) {
    const s = this.game.state;
    return !this.watching && s.phase === 'turn' && s.turn.player === player && !this.isComputer(player);
  }

  // Launch was pressed, and the meter started: the clock stops.
  pressLaunch(player) {
    if (this.canAct(player)) this.clockStopped = true;
  }

  // The meter was let go without a launch.
  releaseWithoutLaunch(player) {
    if (this.canAct(player)) this.clockStopped = false;
  }

  launch(move) {
    return this.play({ type: 'launch', ...move });
  }

  pass(player) {
    return this.play({ type: 'pass', player });
  }

  // Plays a move. Returns what the rules said.
  play(move) {
    const result = applyMove(this.game, move);
    if (result.ok) {
      this.moves.push(move);
    } else {
      this.clientEvent({ type: 'refused', reason: result.reason, player: move.player });
      if (move.type === 'launch') this.clockStopped = false;
    }
    this.flush();
    return result;
  }

  // Real time passes.
  advance(ms) {
    const s = this.game.state;
    if (s.phase === 'over') return;
    if (this.watching && this.replayPaused) return;

    if (s.phase === 'turn') {
      this.acc = 0;
      if (this.watching) this.advanceReplay(ms);
      else if (this.isComputer(s.turn.player)) this.advanceComputer(ms);
      else this.advanceClock(ms);
      return;
    }

    if (this.hold > 0) {
      if (!this.paused) this.hold -= ms;
      return;
    }
    this.acc += ms;
    let ticks = 0;
    while (this.acc >= TICK_MS && (s.phase === 'flight' || s.phase === 'rovers')) {
      if (ticks >= MAX_TICKS_PER_ADVANCE) {
        this.acc = 0;
        break;
      }
      this.acc -= TICK_MS;
      step(this.game);
      ticks += 1;
      this.flush();
      if (this.hold > 0) break;
    }
  }

  advanceClock(ms) {
    const s = this.game.state;
    if (this.paused || this.clockStopped) return;
    this.turnMs += ms;
    const { limit, gone } = this.clock();
    if (limit === null) {
      const due = Math.floor(gone / REMINDER_MS);
      if (due > this.reminders) {
        this.reminders = due;
        this.clientEvent({ type: 'clockReminder', player: s.turn.player });
      }
      return;
    }
    if (!this.warned && !s.turn.noLauncher && gone * 100 >= limit * CLOCK_WARNING) {
      this.warned = true;
      this.clientEvent({ type: 'clockWarning', player: s.turn.player });
    }
    if (gone >= limit) {
      this.clientEvent({ type: 'timeUp', player: s.turn.player });
      this.play({ type: 'timeout', player: s.turn.player });
    }
  }

  advanceComputer(ms) {
    if (this.paused) return;
    this.waitMs += ms;
    const player = this.game.state.turn.player;
    const brain = this.computers[player];
    if (!this.move) {
      if (!brain) this.move = { type: 'pass', player };
      else if (!brain.begin) this.move = brain.think(this.game, player);
      else {
        this.thinker ??= brain.begin(this.game, player);
        this.move = this.thinker.work(THINK_SLICE_MS);
        if (!this.move && this.waitMs >= COMPUTER_LIMIT_MS) this.move = this.thinker.best();
      }
    }
    if (!this.move || this.waitMs < COMPUTER_MIN_MS) return;
    const move = this.move;
    this.move = null;
    const result = this.play(move);
    // A computer whose move is refused passes, so the game goes on.
    if (!result.ok) this.play({ type: 'pass', player });
  }

  advanceReplay(ms) {
    this.waitMs += ms;
    if (this.waitMs < REPLAY_MOVE_MS) return;
    const move = this.replayMoves.shift();
    if (!move) return;
    const result = this.play(move);
    if (!result.ok) throw new Error(`the replay's move ${this.moves.length} doesn't play back: ${result.reason}`);
  }

  startTurn() {
    this.turnMs = 0;
    this.clockStopped = false;
    this.warned = false;
    this.reminders = 0;
    this.waitMs = 0;
    this.thinker = null;
    this.move = null;
  }

  clientEvent(event) {
    const e = { ...event, client: true };
    for (const fn of this.listeners) fn(e);
  }

  // Passes new rules events to the listeners.
  flush() {
    const events = this.game.events;
    while (this.seen < events.length) {
      const e = events[this.seen++];
      if (e.type === 'turnStart') {
        this.startTurn();
        for (const brain of Object.values(this.computers)) brain.observe?.(this.game);
        if (!this.watching && !this.isComputer(e.player) && e.player !== this.viewer) {
          // The screen changes hands first, so the new turn is shown
          // from its player's view.
          this.viewer = e.player;
          this.clientEvent({ type: 'viewer', player: e.player });
          for (const fn of this.listeners) fn(e);
          continue;
        }
      }
      if (e.type === 'roundOver') this.hold = ROUND_ANNOUNCE_MS;
      for (const fn of this.listeners) fn(e);
    }
    // No Rovers to wait for: no hold.
    if (this.game.state.phase !== 'rovers') this.hold = 0;
  }
}
