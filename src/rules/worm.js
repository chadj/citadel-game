// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The Worm (spec 06, Worm; decisions D2, D3, D14, D35).
//
// An infected unit carries { id, owner, until, from }: which Worm it
// is, the player who launched it, the step count its infection ends on,
// and the conduit it arrived by (null where it landed). The unit is
// disabled until then. When the infection wears off, the unit loses 1
// armor (not below 0.1; the Worm's owner's own units lose nothing), and
// the Worm passes along each of the unit's other conduits. A Worm never
// infects a unit twice, so it spreads only outward through the network.

import { WORM_DAMAGE, WORM_FLOOR } from './constants.js';
import { findUnit } from './units.js';
import { disable } from './combat.js';

export function infect(unit, worm, until, from) {
  if (unit.wormsHad.includes(worm.id)) return false;
  unit.wormsHad.push(worm.id);
  unit.worm = { id: worm.id, owner: worm.owner, until, from };
  disable(unit, until);
  return true;
}

// Called at each step of the turn-cycle pointer, with the new count.
export function wormsWearOff(game, steps, emit) {
  const s = game.state;
  const spreads = [];
  for (const u of s.units) {
    if (!u.worm || u.worm.until !== steps) continue;
    const worm = u.worm;
    u.worm = null;
    if (u.owner !== worm.owner) {
      const armor = Math.max(WORM_FLOOR, u.armor - WORM_DAMAGE);
      emit({ type: 'damage', unit: u.id, amount: u.armor - armor, armor });
      u.armor = armor;
    }
    for (const c of s.conduits) {
      if (c.id === worm.from || c.broken || c.to === null) continue;
      if (c.from === u.id) spreads.push([c.to, worm, c.id]);
      else if (c.to === u.id) spreads.push([c.from, worm, c.id]);
    }
  }
  // The new infections are tied to the seat play is leaving, so they
  // last exactly one more lap (decision D2).
  for (const [id, worm, conduit] of spreads) {
    const unit = findUnit(s, id);
    if (unit && infect(unit, worm, steps + s.seats.length, conduit)) {
      emit({ type: 'infected', unit: unit.id, owner: worm.owner });
    }
  }
}
