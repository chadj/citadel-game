// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The aide (spec 11, The aide; decision D50): what it comments on, its
// lines, and when it speaks. Speaking itself is the screen's (a voice,
// or a recorded line by its id).

export const ESSENTIAL = 0;
export const NEWS = 1;
export const CHATTER = 2;

// The events it comments on, with their tier and lines. A line's id is
// `aide.<event>.<n>`, counting from 1, so a recording can stand in for
// it.
export const AIDE_EVENTS = Object.freeze({
  yourTurn: [ESSENTIAL, ['Your turn, commander.', 'You\'re up.', 'The launchers are yours.', 'Over to you.']],
  reminder: [ESSENTIAL, ['Still your turn.', 'We\'re waiting on your order.', 'Your move, whenever you\'re ready.']],
  noLauncher: [ESSENTIAL, ['Your turn, but no launcher is working.', 'Nothing can launch this turn.', 'Every launcher is down.']],
  roundOver: [ESSENTIAL, ['The round is over.', 'End of the round.', 'That\'s the round.']],
  citadelLost: [ESSENTIAL, ['Our Citadel is gone.', 'The Citadel has fallen.', 'We\'ve lost the Citadel.']],
  victory: [ESSENTIAL, ['Victory!', 'The field is ours.', 'We\'ve won.']],
  defeat: [ESSENTIAL, ['Defeat.', 'We\'ve been beaten.', 'It\'s over. We lost.']],
  weKnockedOut: [NEWS, ['Enemy Citadel destroyed!', 'We took their Citadel.', 'One enemy down.']],
  knockedOut: [NEWS, ['A player has been knocked out.', 'Someone\'s Citadel just fell.', 'One player is out of the game.']],
  teammateOut: [NEWS, ['We\'ve lost a teammate.', 'Our ally\'s Citadel is gone.', 'A teammate is out.']],
  notResponding: [NEWS, ['A player isn\'t responding.', 'Someone has dropped out.', 'A player has disconnected.']],
  clockWarning: [NEWS, ['Time\'s running short.', 'Hurry, commander.', 'The clock is nearly out.']],
  ventExtractor: [CHATTER, ['Extractor on a vent. Good energy.', 'That vent is ours now.', 'A fine spot for an Extractor.']],
  hitEnemy: [CHATTER, ['A hit!', 'Direct hit on the enemy.', 'That one landed.', 'They felt that.']],
  hitOwn: [CHATTER, ['Careful, that was ours.', 'We just hit our own side.', 'Friendly fire, commander.']],
  buildingFailed: [CHATTER, ['That building didn\'t make it.', 'The landing failed.', 'We lost that one on landing.']],
  attackedOffscreen: [CHATTER, ['We\'re taking hits out there.', 'Something of ours was hit.', 'We\'ve lost a unit out of view.']],
  barrierDown: [CHATTER, ['One of our Barriers is down.', 'A Barrier of ours is disabled.', 'Our dome is down.']],
  enemyBarrierDown: [CHATTER, ['Their Barrier is down.', 'Enemy dome disabled.', 'Their shield is open.']],
});

// After a Citadel is lost, the aide says only these (spec 11).
const STILL_SAID = new Set(['roundOver', 'victory', 'defeat']);

export const AIDE_WAIT_MS = 700; // it waits a moment before speaking
export const AIDE_PAUSE_MS = 450; // and pauses after a line
const QUEUE_MAX = 3;

export class Aide {
  constructor({ chatter = true, random = Math.random } = {}) {
    this.chatter = chatter;
    this.random = random;
    this.queue = []; // { key, tier, stale, wait }
    this.lastLine = new Map(); // event → its last line's number
    this.pause = 0;
    this.citadelLost = false;
  }

  // News to say. `stale()` says whether it has gone stale by the time
  // its turn to be said comes.
  add(key, stale = null) {
    const [tier] = AIDE_EVENTS[key];
    if (this.citadelLost && !STILL_SAID.has(key)) return;
    if (key === 'citadelLost') this.citadelLost = true;
    if (tier === CHATTER && !this.chatter) return;
    // More important news wins: less important news waiting is dropped,
    // and so is this, if something more important is waiting.
    if (this.queue.some((q) => q.tier < tier)) return;
    this.queue = this.queue.filter((q) => q.tier <= tier && q.key !== key);
    if (this.queue.length >= QUEUE_MAX) this.queue.shift();
    this.queue.push({ key, tier, stale, wait: AIDE_WAIT_MS });
  }

  // Moves on by `ms`. `busy` says whether a line is still being spoken.
  // Returns the line to speak now, as { id, text, key }, or null.
  update(ms, busy) {
    for (const q of this.queue) q.wait -= ms;
    if (busy) {
      this.pause = AIDE_PAUSE_MS;
      return null;
    }
    if (this.pause > 0) {
      this.pause -= ms;
      if (this.pause > 0) return null;
    }
    while (this.queue.length > 0) {
      const next = this.queue[0];
      if (next.stale?.()) {
        this.queue.shift();
        continue;
      }
      if (next.wait > 0) return null;
      this.queue.shift();
      return this.line(next.key);
    }
    return null;
  }

  // A line for an event: at random, but not the same one twice running.
  line(key) {
    const lines = AIDE_EVENTS[key][1];
    const last = this.lastLine.get(key);
    let n = Math.floor(this.random() * lines.length);
    if (lines.length > 1 && n === last) n = (n + 1 + Math.floor(this.random() * (lines.length - 1))) % lines.length;
    this.lastLine.set(key, n);
    return { id: `aide.${key}.${n + 1}`, text: lines[n], key };
  }
}

// What the aide of `me` makes of a rules or screen event, as event
// names (spec 11, What it comments on). `ctx`:
//   me          the listening player
//   sides       each player's side
//   turnPlayer  whose turn it is
//   onScreen(unitId)  whether a unit is in the player's view
//   ventExtractor(unitId)  whether a unit is an Extractor on a vent
//   kindOf(unitId)  a unit's kind
export function aideKeysFor(e, ctx) {
  const { me, sides } = ctx;
  const mine = (p) => p === me;
  const ours = (p) => p !== null && p !== undefined && sides[p] === sides[me];
  const myTurn = ctx.turnPlayer === me;
  switch (e.type) {
    case 'turnStart':
      if (!mine(e.player)) return [];
      return [e.noLauncher ? 'noLauncher' : 'yourTurn'];
    case 'clockReminder':
      return mine(e.player) ? ['reminder'] : [];
    case 'clockWarning':
      return mine(e.player) ? ['clockWarning'] : [];
    case 'roundOver':
      return ['roundOver'];
    case 'knockedOut':
      if (mine(e.player)) return ['citadelLost'];
      if (ours(e.player)) return ['teammateOut'];
      return [ours(e.by) ? 'weKnockedOut' : 'knockedOut'];
    case 'disconnect':
      return mine(e.player) ? [] : ['notResponding'];
    case 'presence':
      return e.state === 'notResponding' && !mine(e.player) ? ['notResponding'] : [];
    case 'gameOver':
      return [e.winner !== null && e.winner === sides[me] ? 'victory' : 'defeat'];
    case 'built':
      return mine(e.owner) && e.kind === 'extractor' && ctx.ventExtractor(e.unit) ? ['ventExtractor'] : [];
    case 'damage':
    case 'destroy':
      if (e.how === 'salvaged' || e.how === 'failed') return [];
      // My shot, on my turn.
      if (myTurn && e.by === me && e.owner !== undefined) return [ours(e.owner) ? 'hitOwn' : 'hitEnemy'];
      // Mine, off screen, on another player's turn.
      if (!myTurn && mine(e.owner) && !ctx.onScreen(e.unit)) return ['attackedOffscreen'];
      return [];
    case 'buildingFailed':
      return myTurn ? ['buildingFailed'] : [];
    case 'disabled':
      if (ctx.kindOf(e.unit) !== 'barrier') return [];
      if (mine(e.owner)) return ['barrierDown'];
      return ours(e.by) && !ours(e.owner) ? ['enemyBarrierDown'] : [];
    default:
      return [];
  }
}
