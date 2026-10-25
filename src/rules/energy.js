// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Energy: income, the cap and the Citadel bonus (spec 00, Energy;
// spec 03, The end of a round, Energy). Amounts are in tenths.

import {
  ENERGY_CAP, CITADEL_INCOME, VENT_EXTRACTOR_INCOME, EXTRACTOR_INCOME, CITADEL_BONUS,
} from './constants.js';
import { citadelOf, isWorking } from './units.js';

// What a player will get at the end of the round: their Extractors, the
// Citadel and energy put aside (spec 03, Energy), plus what their
// Salvagers recovered. A player with no Citadel, or who has
// disconnected, gets nothing (decision D19).
export function roundIncome(state, player) {
  const p = state.players[player];
  if (p.disconnected || !citadelOf(state, player)) return 0;
  let income = CITADEL_INCOME + p.aside + p.salvaged;
  for (const u of state.units) {
    if (u.kind !== 'extractor' || u.owner !== player || !isWorking(state, u)) continue;
    income += u.onVent ? VENT_EXTRACTOR_INCOME : EXTRACTOR_INCOME;
  }
  return income;
}

// Adds energy to a player's current energy, up to the cap.
export function gainEnergy(state, player, amount) {
  const p = state.players[player];
  p.energy = Math.min(ENERGY_CAP, p.energy + amount);
}

// Pays income to every player at the end of a round, and clears what
// was put aside or salvaged. Returns what each player gained, after the
// cap, less what they had put aside: their own energy coming back
// isn't earned.
export function payIncome(state) {
  return state.players.map((p, i) => {
    const income = roundIncome(state, i);
    const before = p.energy;
    p.energy = Math.min(ENERGY_CAP, p.energy + income);
    const gained = Math.max(0, p.energy - before - p.aside);
    p.aside = 0;
    p.salvaged = 0;
    return gained;
  });
}

// The 7 for destroying an enemy's Citadel goes straight to the credited
// player's current energy, capped (spec 03, Energy). Nobody is paid for
// a Citadel on their own side (spec 07, When it explodes).
export function payCitadelBonus(state, sides, credited, victim) {
  if (credited === null || sides[credited] === sides[victim]) return false;
  gainEnergy(state, credited, CITADEL_BONUS);
  return true;
}
