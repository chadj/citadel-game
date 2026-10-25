// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Short-lived effects, started by the game's events (spec 06, What
// players see; spec 05, What players see; spec 07, What players see;
// spec 02, Craters). Effects show even in hidden cells (spec 08, Some
// things show through the fog), so they're drawn above the fog. Over
// the fog's black they glow, and their smoke and debris turn pale, so
// they stand out there too.
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
    this.list.push({ kind, x, y, z, mx, my, age: 0, dur, ...more });
  }

  // Smoke rising after a blast: a few puffs, drifting up and spreading.
  // It starts as the fire dies down, and stays light.
  smoke(x, y, z, r, dur) {
    const puffs = [...Array(3)].map((_, k) => ({
      dx: (Math.random() - 0.5) * r * 0.8,
      rise: 16 + Math.random() * 14 + r * 0.4,
      delay: 0.3 + k * 0.1,
      size: r * (0.35 + Math.random() * 0.15),
    }));
    this.add('smoke', x, y, z, { r, dur, puffs });
  }

  // Embers thrown out by an explosion.
  static embers(n, reach) {
    return [...Array(n)].map(() => ({ a: Math.random() * Math.PI * 2, d: reach * (0.6 + Math.random() * 0.7), up: 10 + Math.random() * 20 }));
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
        this.add('boom', e.x, e.y, e.z, { r: e.radius / PX, dur: 900 + e.radius / PX * 12, embers: Effects.embers(10, e.radius / PX) });
        this.smoke(e.x, e.y, e.z, Math.max(10, e.radius / PX), 2200 + e.radius / PX * 15);
        break;
      case 'surge':
        this.add('boom', e.x, e.y, e.z, { r: 40, dur: 700, tint: 0xb98cff });
        break;
      case 'blast':
        this.add('blast', e.x, e.y, e.z, { r: e.radius / PX, dur: 1400, embers: Effects.embers(16, e.radius / PX * 0.6) });
        this.smoke(e.x, e.y, e.z, 30, 2800);
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
        if (!explodes) {
          this.add('debris', p.x, p.y, p.z, { dur: 1300 });
          if (e.how === 'destroyed') this.smoke(p.x, p.y, p.z, 14, 2200);
        }
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

  // `hidden(x, y, z)` says whether a point is in the viewer's fog.
  draw(g, copies, hidden = () => false) {
    for (const e of this.list) {
      const t = e.age / e.dur;
      const dark = hidden(e.x, e.y, e.z ?? 0);
      for (const [sx, sy] of copies(e.mx, e.my, (e.r ?? 20) + 60)) {
        if (dark) drawGlow(g, e, t, sx, sy);
        drawOne(g, e, t, sx, sy, dark);
      }
    }
  }
}

function drawEmbers(g, e, t, sx, sy) {
  if (!e.embers) return;
  for (const m of e.embers) {
    const d = m.d * Math.sqrt(t);
    const x = sx + Math.cos(m.a) * d;
    const y = sy + Math.sin(m.a) * d * 0.6 - m.up * Math.sin(Math.PI * Math.min(1, t * 1.3));
    g.fillStyle(t < 0.5 ? 0xfff0a0 : 0xff8030, 1 - t);
    g.fillCircle(x, y, 2.2 * (1 - t) + 0.8);
  }
}

// Over the fog's black: a soft glow behind fire and light.
function drawGlow(g, e, t, sx, sy) {
  const fade = (1 - t) * (1 - t);
  switch (e.kind) {
    case 'boom': {
      const r = Math.max(6, e.r);
      g.fillStyle(e.tint ?? 0xff8a30, 0.22 * fade);
      g.fillCircle(sx, sy, r * 2.4);
      g.fillStyle(e.tint ?? 0xffb060, 0.3 * fade);
      g.fillCircle(sx, sy, r * 1.5);
      break;
    }
    case 'blast':
      g.fillStyle(0xff7a30, 0.25 * fade);
      g.fillCircle(sx, sy - 10, Math.max(50, e.r * 0.9));
      g.fillStyle(0xffb060, 0.3 * fade);
      g.fillCircle(sx, sy - 10, 40);
      break;
    case 'pulse':
    case 'splash':
    case 'debris':
      g.fillStyle(0xffffff, 0.12 * fade);
      g.fillCircle(sx, sy, 24);
      break;
    default:
      break;
  }
}

function drawOne(g, e, t, sx, sy, dark = false) {
  switch (e.kind) {
    case 'boom': {
      // A flash, a fireball that swells to the blast's radius and burns
      // down, a shock ring, and embers.
      const full = Math.max(4, e.r);
      const grow = Math.min(1, t / 0.2);
      const r = full * (0.5 + 0.5 * Math.sqrt(grow));
      const burn = 1 - Math.max(0, (t - 0.2) / 0.8);
      if (t < 0.12) {
        g.fillStyle(0xffffff, 0.9 * (1 - t / 0.12));
        g.fillCircle(sx, sy, full * 1.2);
      }
      g.lineStyle(2, e.tint ?? 0xffd080, 0.7 * (1 - t));
      g.strokeEllipse(sx, sy, full * 2.6 * Math.sqrt(t), full * 2.2 * Math.sqrt(t));
      g.fillStyle(e.tint ?? 0xff6a20, 0.85 * burn);
      g.fillCircle(sx, sy - 4 * t, r);
      g.fillStyle(e.tint ? 0xffffff : 0xffb040, 0.9 * burn);
      g.fillCircle(sx, sy - 6 * t, r * 0.7);
      g.fillStyle(0xfff4c8, 0.95 * burn * burn);
      g.fillCircle(sx, sy - 8 * t, r * 0.4);
      drawEmbers(g, e, t, sx, sy);
      break;
    }
    case 'smoke': {
      // Dark smoke over the ground, pale over the fog, with a pale edge
      // either way so it reads on dark terrain too.
      for (const p of e.puffs) {
        const u = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
        if (u <= 0) continue;
        const a = Math.min(1, u * 6) * (1 - u) ** 0.7;
        const r = p.size * (0.6 + 1.4 * u);
        const x = sx + p.dx * (0.5 + u);
        const y = sy - p.rise * u * 2;
        g.fillStyle(dark ? 0xe0dad2 : 0xc9c1b6, (dark ? 0.35 : 0.25) * a);
        g.fillCircle(x, y, r);
        g.fillStyle(dark ? 0xa8a29a : 0x4a443e, (dark ? 0.3 : 0.3) * a);
        g.fillCircle(x, y + r * 0.15, r * 0.7);
      }
      break;
    }
    case 'blast': {
      const burn = 1 - t;
      if (t < 0.1) {
        g.fillStyle(0xffffff, 0.9 * (1 - t / 0.1));
        g.fillCircle(sx, sy, e.r * 0.9);
      }
      g.lineStyle(4, 0xffd080, 0.9 * burn);
      g.strokeEllipse(sx, sy, e.r * 2 * Math.sqrt(t), e.r * 1.8 * Math.sqrt(t));
      const fire = Math.max(24, e.r * 0.45) * (0.6 + 0.6 * Math.sqrt(t));
      g.fillStyle(0xff5a18, 0.9 * burn);
      g.fillCircle(sx, sy - 24 * t, fire);
      g.fillStyle(0xffa030, 0.95 * burn);
      g.fillCircle(sx, sy - 26 * t, fire * 0.7);
      g.fillStyle(0xfff0b0, burn * burn);
      g.fillCircle(sx, sy - 28 * t, fire * 0.4);
      drawEmbers(g, e, t, sx, sy);
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
        g.fillStyle(dark ? 0xd8cfc4 : 0x50483f, 1 - t);
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
