// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game summary (spec 10, The end of the game), worked out from the
// game's events. For each player:
//   built      units built
//   earned     energy earned, in tenths: income and Citadel bonuses,
//              less energy they had put aside coming back
//   fired      attacking shots fired: the items a Battery can launch
//   hits       attacking shots that hit an opponent: damaged, disabled
//              or infected an opponent's unit. Drawing Interceptor fire
//              doesn't count. A Rover counts when it explodes.
//   destroyed  opponents' units destroyed
//   accuracy   hits / fired, or null with no shots fired
//   knockedOut opponents knocked out

import { canLaunch } from '../../rules/items.js';

export function gameStats(setup, sides, events) {
  const n = setup.players.length;
  const stats = Array.from({ length: n }, () => ({
    built: 0, earned: 0, fired: 0, hits: 0, destroyed: 0, accuracy: null, knockedOut: 0,
  }));
  const opponent = (by, owner) => by !== null && by !== undefined && owner !== undefined && sides[by] !== sides[owner];

  // The attacking shot whose effects are being seen now, and whether
  // it has hit yet. During a turn, it's that turn's launch; while a
  // Rover drives, that Rover's.
  let current = null;
  const roverShots = new Map(); // Rover unit → its launch

  for (const e of events) {
    switch (e.type) {
      case 'turnStart':
      case 'roundOver':
        current = null;
        break;
      case 'launch':
        if (canLaunch('battery', e.item)) {
          stats[e.player].fired += 1;
          current = { player: e.player, hit: false, item: e.item };
        } else {
          current = null;
        }
        break;
      case 'built':
        stats[e.owner].built += 1;
        if (e.kind === 'rover' && current?.item === 'rover') roverShots.set(e.unit, current);
        break;
      case 'roverDrives':
        current = roverShots.get(e.unit) ?? null;
        break;
      case 'damage':
      case 'disabled':
      case 'infected': {
        if (e.spread || !current || current.hit) break;
        // An infection carries the Worm's owner, and the unit's.
        const [by, victim] = e.type === 'infected' ? [e.owner, e.unitOwner] : [e.by, e.owner];
        if (by === current.player && opponent(by, victim)) {
          current.hit = true;
          stats[by].hits += 1;
        }
        break;
      }
      case 'destroy':
        if (e.how !== 'failed' && opponent(e.by, e.owner)) stats[e.by].destroyed += 1;
        break;
      case 'knockedOut':
        if (opponent(e.by, e.player)) stats[e.by].knockedOut += 1;
        break;
      case 'income':
        (e.gains ?? []).forEach((g, i) => {
          stats[i].earned += g;
        });
        break;
      case 'citadelBonus':
        stats[e.player].earned += e.amount ?? 0;
        break;
      default:
        break;
    }
  }
  for (const st of stats) st.accuracy = st.fired > 0 ? st.hits / st.fired : null;
  return stats;
}
