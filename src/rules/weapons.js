// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What each weapon and tool does where its flight ends (spec 06,
// Weapons, Tools; decisions D32, D35). `how` is 'direct' (it struck
// `struck` in the air), 'ground' or 'water'. Being stopped by a Barrier
// or a Charge, or caught, does nothing, so it never comes here.

import {
  SHELL_DAMAGE, SHELL_DIRECT, SHELL_GROUND, FRAGMENT_DAMAGE, FRAGMENT_DIRECT, FRAGMENT_GROUND,
  PULSE_DELAY, SURGE_DAMAGE, SURGE_DIRECT, SURGE_GROUND, WORM_REACH, REPAIR_AMOUNT, REPAIR_REACH,
  SALVAGE_REACH, SALVAGE_ENEMY_MAX, SALVAGE_TICKS,
} from './constants.js';
import { delta } from './math/wrap.js';
import { isqrt } from './math/fixed.js';
import { UNIT_KINDS } from './units.js';
import { cycleEnd } from './effects.js';
import { isGone } from './conduits.js';
import {
  groundGap, heightGap, gap3, nearest, hurt, shotExplosion, schedule, startSurge, surgeFromUnit,
} from './combat.js';
import { infect } from './worm.js';

export function weaponEnd(ctx, shot, how, p, struck) {
  const { game } = ctx;
  const s = game.state;
  const credit = ctx.credit();
  const at = { x: p.x, y: p.y, z: p.z };
  const ev = (type, more) => ctx.emit({ type, shot: shot.id, item: shot.item, how, ...at, ...more });
  if (how === 'ground') ev('crater');

  switch (shot.item) {
    case 'shell':
    case 'seeker':
    case 'scatter': {
      if (how === 'water') return ev('splash');
      const small = shot.item === 'scatter';
      const radius = how === 'direct'
        ? (small ? FRAGMENT_DIRECT : SHELL_DIRECT)
        : (small ? FRAGMENT_GROUND : SHELL_GROUND);
      shotExplosion(ctx, { ...at, radius, damage: small ? FRAGMENT_DAMAGE : SHELL_DAMAGE, credit });
      return undefined;
    }

    case 'pulse':
      if (how === 'water') return ev('lost');
      ev('pulseLanded');
      schedule(s, { type: 'pulse', at: s.tick + PULSE_DELAY, ...at, owner: shot.owner, credit });
      return undefined;

    case 'surge': {
      if (how === 'water') return ev('splash');
      ev('surge');
      const reach = how === 'direct' ? SURGE_DIRECT : SURGE_GROUND;
      const target = struck ?? nearest(s.units, (u) => {
        const g = groundGap(game.map.size, at.x, at.y, u);
        return g <= reach && heightGap(at.z, u) <= reach ? g : null;
      });
      if (target) {
        // The damage starts back along the conduit before the unit takes
        // its own, so it outruns the burn if the unit is destroyed.
        const into = s.conduits.find((c) => c.to === target.id);
        if (into && into.nodes.length > 0) surgeFromUnit(ctx, into, shot.owner, credit);
        hurt(ctx, target, SURGE_DAMAGE, credit);
        return undefined;
      }
      // No unit in reach: the nearest conduit node, and both ways from it.
      const hit = nearestNode(game, at, reach);
      if (hit) {
        const [conduit, index] = hit;
        ctx.emit({ type: 'surgeNode', conduit: conduit.id, index, strength: SURGE_DAMAGE, owner: shot.owner });
        // The struck node counts as the first one passed, both ways.
        startSurge(s, conduit, index - 1, -1, shot.owner, credit, 1);
        if (conduit.to !== null) startSurge(s, conduit, index + 1, 1, shot.owner, credit, 1);
      }
      return undefined;
    }

    case 'worm': {
      if (how === 'water') return ev('lost');
      ev('worm');
      const worm = { id: s.nextId++, owner: shot.owner };
      const until = cycleEnd(s);
      for (const u of s.units) {
        if (gap3(game.map.size, at.x, at.y, at.z, u) > WORM_REACH) continue;
        if (infect(u, worm, until, null)) ctx.emit({ type: 'infected', unit: u.id, owner: shot.owner, unitOwner: u.owner });
      }
      return undefined;
    }

    case 'repair': {
      ev('repairLanded');
      const damaged = (u) => u.armor < UNIT_KINDS[u.kind].armor;
      const target = struck && damaged(struck) ? struck : nearest(s.units, (u) => {
        if (!damaged(u)) return null;
        const g = groundGap(game.map.size, at.x, at.y, u);
        return g <= REPAIR_REACH ? g : null;
      });
      if (target) {
        const before = target.armor;
        target.armor = Math.min(UNIT_KINDS[target.kind].armor, target.armor + REPAIR_AMOUNT);
        ctx.emit({ type: 'repair', unit: target.id, amount: target.armor - before, armor: target.armor });
      }
      return undefined;
    }

    case 'salvager': {
      if (how === 'water') return ev('splash');
      ev('salvagerLanded');
      const target = struck ?? nearest(s.units, (u) => {
        const g = groundGap(game.map.size, at.x, at.y, u);
        return g <= SALVAGE_REACH && heightGap(at.z, u) <= SALVAGE_REACH ? g : null;
      });
      if (!target) return undefined;
      const friendly = game.sides[target.owner] === game.sides[shot.owner] && !target.worm;
      schedule(s, {
        type: 'salvage', at: s.tick + SALVAGE_TICKS, unit: target.id, owner: shot.owner, credit,
        taken: 0, max: friendly ? target.armor : Math.min(SALVAGE_ENEMY_MAX, target.armor),
      });
      return undefined;
    }

    default:
      // The Rover's flight and landing come with its own rules (M5).
      return ev('land');
  }
}

// The nearest resting conduit node within `reach` of a point, across
// the ground and in height, as [conduit, index], or null.
function nearestNode(game, p, reach) {
  const s = game.state;
  const size = game.map.size;
  let best = null;
  let bestD = Infinity;
  for (const c of s.conduits) {
    c.nodes.forEach((n, i) => {
      if (isGone(s, n) || !n.resting || Math.abs(n.z - p.z) > reach) return;
      const dx = delta(p.x, n.x, size);
      const dy = delta(p.y, n.y, size);
      const d = isqrt(dx * dx + dy * dy);
      if (d <= reach && d < bestD) {
        best = [c, i];
        bestD = d;
      }
    });
  }
  return best;
}
