// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Short-lived effects, started by the game's events (spec 06, What
// players see; spec 05, What players see; spec 07, What players see;
// spec 02, Craters). Effects show even in hidden cells (spec 08, Some
// things show through the fog), so they're drawn above the fog.
// Craters lie under everything else, and the oldest fade as new ones
// form.

import { PX, WET } from '../../rules/constants.js';
import { sampleTerrain } from '../../rules/terrain/terrain.js';
import { findUnit, UNIT_KINDS } from '../../rules/units.js';
import { LIFT } from '../core/view.js';
import { PLAYER_COLORS, PLANET_COLORS } from './palette.js';

export const MAX_CRATERS = 120;
const CRATER_FADE = 30; // the oldest this many fade out

export class Effects {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.craters = [];
    this.flickers = new Map(); // Barrier id → ms left
    this.flash = 0; // the Pulse's flash over the whole view, ms left
    this.now = 0;
    this.lastSeen = new Map(); // unit id → where it was, kept by the world view
  }

  // Map pixels where a point of the rules' map is drawn.
  at(x, y, z) {
    return [x / PX, (y - Math.max(0, z) * LIFT) / PX];
  }

  groundAt(x, y) {
    const t = sampleTerrain(this.game.map, x, y);
    return { z: t.alt, wet: t.type === WET };
  }

  add(kind, x, y, z, more = {}) {
    const [mx, my] = this.at(x, y, z);
    const dur = more.dur ?? 600;
    this.list.push({ kind, mx, my, age: 0, dur, ...more });
  }

  crater(x, y, r) {
    const g = this.groundAt(x, y);
    if (g.wet) return;
    const [mx, my] = this.at(x, y, g.z);
    this.craters.push({ mx, my, r });
    if (this.craters.length > MAX_CRATERS) this.craters.shift();
  }

  unitPoint(id) {
    const u = findUnit(this.game.state, id);
    if (!u) return null;
    return { x: u.x, y: u.y, z: u.base + UNIT_KINDS[u.kind].height / 2 };
  }

  nodePoint(conduitId, index) {
    const c = this.game.state.conduits.find((k) => k.id === conduitId);
    const n = c?.nodes[index];
    return n ? { x: n.x, y: n.y, z: n.z } : null;
  }

  // Starts the effects for one event.
  onEvent(e) {
    const color = (p) => PLAYER_COLORS[this.game.setup.players[p]?.color] ?? 0xffffff;
    switch (e.type) {
      case 'explosion':
        this.add('boom', e.x, e.y, e.z, { r: e.radius / PX, dur: 500 + e.radius / PX * 6 });
        break;
      case 'surge':
        this.add('boom', e.x, e.y, e.z, { r: 40, dur: 700, tint: 0xb98cff });
        break;
      case 'blast':
        this.add('blast', e.x, e.y, e.z, { r: e.radius / PX, dur: 900 });
        this.crater(e.x, e.y, 14);
        break;
      case 'crater':
        this.crater(e.x, e.y, e.item === 'scatter' ? 6 : 10);
        break;
      case 'splash': {
        const water = PLANET_COLORS[this.game.map.planet]?.water ?? [0x2b4f6e, 0x4f7f9f];
        this.add('splash', e.x, e.y, e.z ?? 0, { dur: 700, colors: water });
        break;
      }
      case 'pulse':
        this.add('pulse', e.x, e.y, e.z, { r: 200, dur: 600 });
        break;
      case 'pulseLanded':
        this.flash = 220;
        this.add('marker', e.x, e.y, e.z, { dur: 400, tint: 0x7fd4ff });
        break;
      case 'destroy': {
        const p = this.lastSeen.get(e.unit);
        if (!p) break;
        // Most destroyed units leave a crater (not on water, and not a
        // Sky Probe, high in the air). One that doesn't explode leaves
        // debris briefly; the others' blasts come a moment later.
        if (e.how === 'destroyed' && e.kind !== 'skyProbe') this.crater(p.x, p.y, 9);
        const explodes = e.how === 'destroyed' && ['extractor', 'charge', 'rover'].includes(e.kind);
        if (!explodes) this.add('debris', p.x, p.y, p.z, { dur: 1100 });
        break;
      }
      case 'domeFlicker':
        this.flickers.set(e.unit, 300);
        break;
      case 'nodeBurnt': {
        const p = this.nodePoint(e.conduit, e.index);
        if (p) this.add('flame', p.x, p.y, p.z, { dur: 500 });
        break;
      }
      case 'surgeNode': {
        const p = this.nodePoint(e.conduit, e.index);
        if (p) this.add('spark', p.x, p.y, p.z, { dur: 260, tint: color(e.owner), k: e.strength / 30 });
        break;
      }
      case 'surgeEnd': {
        const p = this.unitPoint(e.unit);
        if (p) this.add('boom', p.x, p.y, p.z, { r: 6 + e.amount, dur: 400, tint: 0xb98cff });
        break;
      }
      case 'repair': {
        const p = this.unitPoint(e.unit);
        if (p) this.add('repair', p.x, p.y, p.z, { dur: 900 });
        break;
      }
      case 'repairLanded':
      case 'salvagerLanded':
        this.add('marker', e.x, e.y, e.z, { dur: 700, tint: e.type === 'repairLanded' ? 0x7dff9a : 0xffd27f });
        break;
      case 'salvage': {
        const p = this.unitPoint(e.unit);
        if (p) this.add('spark', p.x, p.y, p.z, { dur: 350, tint: 0xffd27f, k: 1 });
        break;
      }
      case 'interceptorFired': {
        const p = this.unitPoint(e.unit);
        if (p) this.add('spark', p.x, p.y, p.z + 10 * PX, { dur: 250, tint: 0xffffff, k: 1 });
        break;
      }
      case 'missileHit':
      case 'caught':
        this.add('boom', e.x, e.y, e.z, { r: 8, dur: 300, tint: 0xffffff });
        break;
      case 'lost':
      case 'pontoonLost':
      case 'buildingFailed':
        if (e.x !== undefined) this.add('debris', e.x, e.y, e.z ?? this.groundAt(e.x, e.y).z, { dur: 900 });
        break;
      case 'chargeSetOff':
      case 'roverTriggered': {
        const p = this.unitPoint(e.unit);
        if (p) this.add('warn', p.x, p.y, p.z, { dur: 900 });
        break;
      }
      case 'launch': {
        const p = this.unitPoint(e.launcher);
        if (p && this.showLaunch(e.player)) this.add('burst', p.x, p.y, p.z + 10 * PX, { dur: 300 });
        break;
      }
      default:
        break;
    }
  }

  // Decision D38: the launch's charging and burst show on the launching
  // player's screen only. The screen replaces this.
  showLaunch() {
    return true;
  }

  update(ms) {
    this.now += ms;
    for (const e of this.list) e.age += ms;
    this.list = this.list.filter((e) => e.age < e.dur);
    for (const [id, left] of this.flickers) {
      if (left - ms <= 0) this.flickers.delete(id);
      else this.flickers.set(id, left - ms);
    }
    this.flash = Math.max(0, this.flash - ms);
  }

  // Craters, under everything.
  drawCraters(g, copies) {
    const n = this.craters.length;
    this.craters.forEach((c, k) => {
      const fade = n > MAX_CRATERS - CRATER_FADE ? Math.min(1, (k + 1) / Math.max(1, n - (MAX_CRATERS - CRATER_FADE))) : 1;
      for (const [sx, sy] of copies(c.mx, c.my, c.r + 4)) {
        g.fillStyle(0x000000, 0.28 * fade);
        g.fillEllipse(sx, sy, c.r * 2.2, c.r * 1.5);
        g.fillStyle(0x000000, 0.18 * fade);
        g.fillEllipse(sx, sy + 1, c.r * 1.3, c.r * 0.8);
      }
    });
  }

  draw(g, copies) {
    for (const e of this.list) {
      const t = e.age / e.dur;
      for (const [sx, sy] of copies(e.mx, e.my, (e.r ?? 20) + 40)) drawOne(g, e, t, sx, sy);
    }
  }
}

function drawOne(g, e, t, sx, sy) {
  switch (e.kind) {
    case 'boom': {
      const r = Math.max(4, e.r) * (0.4 + 0.6 * Math.sqrt(t));
      g.fillStyle(e.tint ?? 0xffa040, 0.85 * (1 - t));
      g.fillCircle(sx, sy, r);
      g.fillStyle(0xfff2c0, 0.9 * (1 - t) * (1 - t));
      g.fillCircle(sx, sy, r * 0.55);
      g.fillStyle(0x333333, 0.35 * t * (1 - t) * 4);
      g.fillCircle(sx, sy - 6 * t * 4, r * 0.7);
      break;
    }
    case 'blast': {
      g.lineStyle(3, 0xffd080, 0.9 * (1 - t));
      g.strokeEllipse(sx, sy, e.r * 2 * t, e.r * 2 * t * 0.9);
      g.fillStyle(0xff7030, 0.9 * (1 - t));
      g.fillCircle(sx, sy - 20 * t, 26 * (0.5 + t));
      g.fillStyle(0xfff0b0, (1 - t) * (1 - t));
      g.fillCircle(sx, sy - 20 * t, 14 * (0.5 + t));
      break;
    }
    case 'pulse': {
      g.lineStyle(4, 0x7fd4ff, 0.8 * (1 - t));
      g.strokeEllipse(sx, sy, e.r * 2 * (0.6 + 0.4 * t), e.r * 2 * (0.6 + 0.4 * t));
      g.fillStyle(0x7fd4ff, 0.6 * (1 - t));
      g.fillCircle(sx, sy, 30 * (1 - t / 2));
      break;
    }
    case 'splash': {
      const [deep, light] = e.colors;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const d = 4 + 14 * t;
        g.fillStyle(k % 2 ? light : 0xffffff, 0.8 * (1 - t));
        g.fillCircle(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.6 - 12 * Math.sin(Math.PI * t), 3);
      }
      g.lineStyle(2, deep, 0.7 * (1 - t));
      g.strokeEllipse(sx, sy, 10 + 30 * t, 6 + 18 * t);
      break;
    }
    case 'flame': {
      g.fillStyle(0xff6a20, 0.9 * (1 - t));
      g.fillTriangle(sx - 4, sy, sx + 4, sy, sx, sy - 10 - 6 * t);
      g.fillStyle(0xffe080, 0.9 * (1 - t));
      g.fillCircle(sx, sy - 2, 2.5);
      break;
    }
    case 'spark': {
      const k = Math.max(0.15, e.k ?? 1);
      g.fillStyle(e.tint ?? 0xffffff, (0.5 + 0.5 * k) * (1 - t));
      g.fillCircle(sx, sy, 2 + 5 * k * (1 - t));
      break;
    }
    case 'repair': {
      g.lineStyle(2, 0x7dff9a, 1 - t);
      g.strokeCircle(sx, sy, 8 + 14 * t);
      g.fillStyle(0x7dff9a, 1 - t);
      g.fillRect(sx - 1.5, sy - 18 - 8 * t, 3, 9);
      g.fillRect(sx - 4.5, sy - 15 - 8 * t, 9, 3);
      break;
    }
    case 'marker': {
      g.lineStyle(2, e.tint ?? 0xffffff, 1 - t);
      g.strokeCircle(sx, sy, 4 + 10 * t);
      break;
    }
    case 'debris': {
      for (let k = 0; k < 7; k++) {
        const a = k * 2.4;
        const d = 3 + 12 * t;
        g.fillStyle(0x50483f, 1 - t);
        g.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.6 + 6 * t, 3, 2);
      }
      break;
    }
    case 'warn': {
      const on = Math.floor(e.age / 120) % 2 === 0;
      if (on) {
        g.lineStyle(2, 0xff3030, 0.9);
        g.strokeCircle(sx, sy, 10);
      }
      break;
    }
    case 'burst': {
      g.fillStyle(0xffffff, 0.9 * (1 - t));
      g.fillCircle(sx, sy, 4 + 10 * t);
      break;
    }
    default:
      break;
  }
}
