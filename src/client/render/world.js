// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The main view's map (spec 10, Layout; spec 01, What players see;
// spec 04, How units show their state; spec 05 and 06, What players
// see; spec 08, What players see). Drawn in layers, bottom to top:
//
//   terrain, vents and craters
//   Pontoon decks, conduit nodes on the ground, shadows
//   units
//   shots, missiles and falling nodes in the air
//   the fog
//   effects and the signs of damage, which show through the fog
//   targeting marks, the conduit marker, range circles, damage bars
//
// Units, shots and nodes are drawn from where the rules have them,
// lifted by half their altitude (spec 01, The view).

import {
  PX, FOG_CELL, PULSE_REACH, PULSE_DELAY, INTERCEPTOR_RANGE, CHARGE_TRIGGER, DOME_RADIUS,
  FULL_FOOTPRINT_DELAY, TILE,
} from '../../rules/constants.js';
import { UNIT_KINDS, isWorking } from '../../rules/units.js';
import { ITEMS, BUILDING } from '../../rules/items.js';
import { canSee } from '../../rules/fog.js';
import { isGone, conduitWarning } from '../../rules/conduits.js';
import { sampleTerrain, tileIndex, tileCenter } from '../../rules/terrain/terrain.js';
import { LIFT, screenCopies } from '../core/view.js';
import { markHeading, moveHeading } from '../core/aim.js';
import { terrainPixels } from './terrain-art.js';
import { fogPixels } from './fog-art.js';
import { Effects } from './effects.js';
import { PLAYER_COLORS, shade } from './palette.js';

const LAYERS = ['ground', 'low', 'units', 'air', 'fx', 'top'];
const DEPTH = { terrain: 0, ground: 1, low: 2, units: 3, air: 4, fog: 5, fx: 6, top: 7 };

// The number of sides of each faction's footprint shape: they differ
// only in looks (spec 00, Players and setup).
const FACTION_SIDES = [0, 6, 4, 8];

const deg = (d) => (d * Math.PI) / 180;

export class WorldView {
  constructor(scene, session, { watching = false } = {}) {
    this.scene = scene;
    this.session = session;
    this.game = session.game;
    this.map = this.game.map;
    this.size = this.map.size / PX;
    this.watching = watching;
    this.viewer = session.viewer;
    this.effects = new Effects(this.game);
    this.time = 0;
    this.gfx = {};
    this.makeTerrain();
    for (const name of LAYERS) {
      this.gfx[name] = scene.add.graphics().setDepth(DEPTH[name]);
    }
    this.makeFog();
    this.fogDirty = true;
  }

  makeTerrain() {
    const { scene } = this;
    const pixels = terrainPixels(this.map, 1);
    if (scene.textures.exists('terrain')) scene.textures.remove('terrain');
    const tex = scene.textures.createCanvas('terrain', pixels.width, pixels.height);
    const ctx = tex.getContext();
    const img = ctx.createImageData(pixels.width, pixels.height);
    img.data.set(pixels.data);
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    this.terrainImages = [];
    for (let k = 0; k < 9; k++) {
      this.terrainImages.push(scene.add.image(0, 0, 'terrain').setOrigin(0, 0).setDepth(DEPTH.terrain));
    }
    // The minimap's picture, a coarser one.
    const step = Math.max(1, Math.round(this.size / 160));
    const small = terrainPixels(this.map, step);
    if (scene.textures.exists('minimap-terrain')) scene.textures.remove('minimap-terrain');
    const mt = scene.textures.createCanvas('minimap-terrain', small.width, small.height);
    const mctx = mt.getContext();
    const mimg = mctx.createImageData(small.width, small.height);
    mimg.data.set(small.data);
    mctx.putImageData(mimg, 0, 0);
    mt.refresh();
  }

  makeFog() {
    const { scene } = this;
    const fog = this.game.state.fog;
    this.fogImages = [];
    if (!fog) return;
    const w = fog.cells + 2;
    if (scene.textures.exists('fog')) scene.textures.remove('fog');
    this.fogTex = scene.textures.createCanvas('fog', w, w);
    this.fogData = this.fogTex.getContext().createImageData(w, w);
    for (let k = 0; k < 9; k++) {
      const img = scene.add.image(0, 0, 'fog').setOrigin(0, 0).setDepth(DEPTH.fog).setScale(FOG_CELL / PX);
      img.setCrop(1, 1, fog.cells, fog.cells);
      this.fogImages.push(img);
    }
  }

  setViewer(player) {
    if (player !== this.viewer) {
      this.viewer = player;
      this.fogDirty = true;
    }
  }

  onEvent(e) {
    this.effects.onEvent(e);
    this.fogDirty = true;
  }

  side(player) {
    return this.game.sides[player];
  }

  mine(owner) {
    return this.side(owner) === this.side(this.viewer);
  }

  // Whether the viewer can see a point (position units), drawn lifted by
  // z. In a replay the whole map shows.
  sees(x, y, z = 0) {
    if (this.watching) return true;
    return canSee(this.game, this.viewer, x, y - Math.max(0, z) * LIFT);
  }

  color(owner) {
    return PLAYER_COLORS[this.game.setup.players[owner].color];
  }

  // Draws everything. `controls` is the viewer's controls, or null in a
  // replay.
  draw(ms, cam, controls) {
    this.time += ms;
    this.effects.update(ms);
    const copies = (mx, my, margin = 64) => screenCopies(cam, mx, my, margin);
    this.placeImages(cam);
    for (const name of LAYERS) this.gfx[name].clear();
    this.drawGround(copies);
    this.drawConduits(copies);
    this.drawUnits(copies);
    this.drawShots(copies);
    this.drawPending(copies);
    this.effects.draw(this.gfx.fx, copies, (x, y, z) => !this.sees(x, y, z));
    if (controls) this.drawTargeting(copies, controls);
    this.drawOverlays(copies);
    // The fog changes every tick while anything flies (shots see
    // further the higher they are), not only when something happens.
    if (this.game.state.tick !== this.fogTick) this.fogDirty = true;
    if (this.fogDirty) this.updateFog();
  }

  placeImages(cam) {
    const size = this.size;
    const left = cam.x - cam.width / 2;
    const top = cam.y - cam.height / 2;
    const ox = -(((left % size) + size) % size);
    const oy = -(((top % size) + size) % size);
    let k = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = ox + i * size;
        const y = oy + j * size;
        const show = x < cam.width && y < cam.height;
        this.terrainImages[k].setPosition(x, y).setVisible(show);
        // The fog picture's border sits one cell outside the map.
        this.fogImages[k]?.setPosition(x - FOG_CELL / PX, y - FOG_CELL / PX).setVisible(show);
        k += 1;
      }
    }
  }

  updateFog() {
    this.fogDirty = false;
    this.fogTick = this.game.state.tick;
    const fog = this.game.state.fog;
    if (!fog) return;
    const counts = fog.counts[this.side(this.viewer)];
    // In a replay, the followed player's fog shows faintly (spec 12).
    fogPixels(counts, fog.cells, this.fogData.data, this.watching ? 110 : 255);
    this.fogTex.getContext().putImageData(this.fogData, 0, 0);
    this.fogTex.refresh();
  }

  groundZ(x, y) {
    return sampleTerrain(this.map, x, y).alt;
  }

  drawGround(copies) {
    const g = this.gfx.ground;
    // Energy Vents glow, all the time.
    for (const v of this.map.vents) {
      const [mx, my] = [v.x / PX, (v.y - this.groundZ(v.x, v.y) * LIFT) / PX];
      const r = v.radius / PX;
      const pulse = 0.5 + 0.5 * Math.sin(this.time / 600 + v.x);
      for (const [sx, sy] of copies(mx, my, r + 8)) {
        g.fillStyle(0x6cf2ff, 0.12 + 0.1 * pulse);
        g.fillCircle(sx, sy, r);
        g.fillStyle(0xbffcff, 0.15 + 0.15 * pulse);
        g.fillCircle(sx, sy, r * 0.55);
        g.lineStyle(1, 0x9ff8ff, 0.5);
        g.strokeCircle(sx, sy, r);
      }
    }
    this.effects.drawCraters(g, copies);
  }

  drawConduits(copies) {
    const s = this.game.state;
    const low = this.gfx.low;
    const air = this.gfx.air;
    for (const c of s.conduits) {
      const color = this.color(c.owner);
      for (const n of c.nodes) {
        if (isGone(s, n)) continue;
        if (!this.mine(c.owner) && !this.sees(n.x, n.y, n.z)) continue;
        const [mx, my] = [n.x / PX, (n.y - Math.max(0, n.z) * LIFT) / PX];
        const burning = n.burnAt !== null;
        if (n.resting) {
          for (const [sx, sy] of copies(mx, my, 6)) {
            low.fillStyle(0x000000, 0.35);
            low.fillCircle(sx + 1, sy + 1, 3);
            low.fillStyle(burning ? 0xff8040 : color, 1);
            low.fillCircle(sx, sy, 2.6);
            low.fillStyle(0xffffff, 0.35);
            low.fillCircle(sx - 0.8, sy - 0.8, 1);
          }
        } else {
          // A falling node, and its shadow on the ground below.
          const gz = this.groundZ(n.x, n.y);
          const shadow = (n.y - gz * LIFT) / PX;
          for (const [sx, sy] of copies(mx, shadow, 6)) {
            low.fillStyle(0x000000, 0.4);
            low.fillEllipse(sx, sy, 5, 3);
          }
          for (const [sx, sy] of copies(mx, my, 6)) {
            air.fillStyle(color, 1);
            air.fillCircle(sx, sy, 2.6);
          }
        }
      }
    }
  }

  drawUnits(copies) {
    const s = this.game.state;
    const units = [...s.units].sort((a, b) => a.y - b.y || a.id - b.id);
    // Pontoon decks first: they lie under the units standing on them.
    for (const u of units) if (u.kind === 'pontoon') this.drawUnit(u, copies);
    for (const u of units) if (u.kind !== 'pontoon') this.drawUnit(u, copies);
  }

  drawUnit(u, copies) {
    const s = this.game.state;
    const spec = UNIT_KINDS[u.kind];
    const seen = this.mine(u.owner) || this.sees(u.x, u.y, u.base);
    const mx = u.x / PX;
    const my = (u.y - Math.max(0, u.base) * LIFT) / PX;
    this.effects.lastSeen.set(u.id, { x: u.x, y: u.y, z: u.base + spec.height / 2 });
    const working = isWorking(s, u);
    const r = spec.radius / PX;
    const h = (spec.height * LIFT) / PX;
    const faction = this.game.setup.players[u.owner].faction;
    const base = this.color(u.owner);
    // Disabled units are darker, and stop animating.
    const color = working ? base : shade(base, 0.45);
    const t = working ? this.time : 0;
    const g = this.gfx.units;
    const fx = this.gfx.fx;
    const full = UNIT_KINDS[u.kind].armor;

    for (const [sx, sy] of copies(mx, my, Math.max(r, h) + 40)) {
      if (seen) {
        drawKind(g, u, { sx, sy, r, h, color, faction, t, working, game: this.game });
        if (u.worm) {
          // Infected: a ring of dashes in the Worm's owner's color.
          g.lineStyle(2, this.color(u.worm.owner), 0.9);
          for (let k = 0; k < 6; k++) {
            const a = deg(k * 60) + this.time / 900;
            g.beginPath();
            g.arc(sx, sy - h / 2, r + 5, a, a + 0.6);
            g.strokePath();
          }
        }
        if (u.kind === 'barrier' && u.up && working) this.drawDome(sx, sy, u);
      }
      // Damage shows even through the fog: smoke, and sparks when it's
      // bad (spec 04, Damage).
      if (u.armor < full && u.kind !== 'pontoon') {
        const bad = u.armor * 10 <= full * 4;
        const puffs = bad ? 4 : 2;
        for (let k = 0; k < puffs; k++) {
          const phase = ((this.time / 1400 + k / puffs + (u.id % 7) / 7) % 1);
          fx.fillStyle(0x3a3a3a, 0.55 * (1 - phase));
          fx.fillCircle(sx + Math.sin(phase * 6 + k) * 3, sy - h - 2 - phase * 16, 2.5 + phase * 4);
        }
        if (bad && Math.floor(this.time / 150 + u.id) % 3 === 0) {
          fx.fillStyle(0xffc040, 1);
          fx.fillCircle(sx + ((u.id * 5) % 7) - 3, sy - h / 2, 1.5);
        }
      }
    }
  }

  drawDome(sx, sy, u) {
    const g = this.gfx.units;
    const R = DOME_RADIUS / PX;
    const flick = this.effects.flickers.has(u.id);
    const a = flick ? (Math.floor(this.time / 50) % 2 ? 0.2 : 0.05) : 0.06;
    // A half-sphere seen obliquely: circles up its height, each lifted.
    for (let k = 0; k <= 4; k++) {
      const z = (R * k) / 5;
      const rr = Math.sqrt(R * R - z * z);
      g.fillStyle(0x9fd8ff, a);
      g.fillCircle(sx, sy - z * LIFT, rr);
    }
    g.lineStyle(1.5, 0x9fd8ff, flick ? 0.9 : 0.45);
    g.strokeCircle(sx, sy, R);
  }

  drawShots(copies) {
    const s = this.game.state;
    const air = this.gfx.air;
    const low = this.gfx.low;
    for (const shot of s.shots) {
      if (!this.mine(shot.owner) && !this.sees(shot.x, shot.y, shot.z)) continue;
      const mx = shot.x / PX;
      const my = (shot.y - Math.max(0, shot.z) * LIFT) / PX;
      const gz = this.groundZ(shot.x, shot.y);
      const shadow = (shot.y - gz * LIFT) / PX;
      const color = this.color(shot.owner);
      const category = ITEMS[shot.item].category;
      // The shadow, on the ground directly below.
      for (const [sx, sy] of copies(mx, shadow, 10)) {
        low.fillStyle(0x000000, 0.35);
        low.fillEllipse(sx, sy, 7, 4);
      }
      // A Pontoon shows where it will come down just before it lands,
      // drawn at ground level (spec 06, A Pontoon coming down).
      if (shot.item === 'pontoon' && shot.vz < 0 && shot.z - gz < 40 * PX) {
        const tile = tileIndex(this.map, shot.x, shot.y);
        const c = tileCenter(this.map, tile);
        for (const [sx, sy] of copies(c.x / PX, c.y / PX, 40)) {
          low.lineStyle(1.5, color, 0.8);
          low.strokeRect(sx - TILE / PX / 2 + 4, sy - TILE / PX / 2 + 4, TILE / PX - 8, TILE / PX - 8);
        }
      }
      for (const [sx, sy] of copies(mx, my, 20)) {
        if (category === BUILDING && shot.peakTick !== null && s.tick >= shot.peakTick + FULL_FOOTPRINT_DELAY) {
          // It has become the building: full size from here.
          const spec = UNIT_KINDS[shot.item];
          drawKind(air, { kind: shot.item, id: shot.id, owner: shot.owner }, {
            sx, sy, r: spec.radius / PX, h: (spec.height * LIFT) / PX, color, faction: this.game.setup.players[shot.owner].faction, t: this.time, working: true, game: this.game,
          });
        } else if (category === BUILDING || shot.item === 'pontoon' || shot.item === 'skyProbe'
          || shot.item === 'charges' || shot.item === 'rover') {
          // A launch pod.
          air.fillStyle(0xd8dde2, 1);
          air.fillEllipse(sx, sy, 9, 12);
          air.fillStyle(color, 1);
          air.fillRect(sx - 4.5, sy - 1, 9, 3);
        } else if (shot.item === 'seeker') {
          // It faces where it's steering, with a flame behind it.
          const a = Math.atan2(shot.vy, shot.vx);
          const fx = Math.cos(a);
          const fy = Math.sin(a);
          air.fillStyle(0xff9a30, 0.9);
          air.fillTriangle(sx - fx * 5 - fy * 2, sy - fy * 5 + fx * 2, sx - fx * 5 + fy * 2, sy - fy * 5 - fx * 2, sx - fx * (11 + Math.random() * 4), sy - fy * (11 + Math.random() * 4));
          air.lineStyle(4, 0xe8e8e8, 1);
          air.lineBetween(sx - fx * 5, sy - fy * 5, sx + fx * 5, sy + fy * 5);
          air.fillStyle(color, 1);
          air.fillCircle(sx + fx * 5, sy + fy * 5, 2);
        } else {
          air.fillStyle(0x202020, 1);
          air.fillCircle(sx, sy, shot.item === 'scatter' && shot.peakTick !== null ? 2.6 : 3.4);
          air.fillStyle(color, 1);
          air.fillCircle(sx - 0.8, sy - 0.8, 1.6);
        }
      }
    }
    // Interceptor missiles: a flame and a trail.
    for (const m of s.missiles) {
      if (!this.mine(m.owner) && !this.sees(m.x, m.y, m.z)) continue;
      const mx = m.x / PX;
      const my = (m.y - Math.max(0, m.z) * LIFT) / PX;
      this.trails ??= new Map();
      const trail = this.trails.get(m.id) ?? [];
      if (!trail.length || trail.at(-1)[0] !== mx || trail.at(-1)[1] !== my) trail.push([mx, my]);
      if (trail.length > 14) trail.shift();
      this.trails.set(m.id, trail);
      for (const [sx, sy] of copies(mx, my, 60)) {
        trail.forEach(([tx, ty], k) => {
          const dx = ((tx - mx + this.size * 1.5) % this.size) - this.size / 2;
          const dy = ((ty - my + this.size * 1.5) % this.size) - this.size / 2;
          air.fillStyle(0xcccccc, (k / trail.length) * 0.5);
          air.fillCircle(sx + dx, sy + dy, 1.5 + k / 8);
        });
        air.fillStyle(0xffb040, 1);
        air.fillCircle(sx, sy, 2.5);
        air.fillStyle(0xffffff, 1);
        air.fillCircle(sx, sy, 1.2);
      }
    }
    if (this.trails && this.trails.size > s.missiles.length) {
      for (const id of [...this.trails.keys()]) if (!s.missiles.some((m) => m.id === id)) this.trails.delete(id);
    }
  }

  // Effects that wait: a Pulse charging grows to about its reach; a
  // Surge's damage runs along its conduit (spec 06, What players see).
  drawPending(copies) {
    const s = this.game.state;
    const fx = this.gfx.fx;
    for (const e of s.pending) {
      if (e.type === 'pulse') {
        const k = Math.max(0, Math.min(1, 1 - (e.at - s.tick) / PULSE_DELAY));
        const [mx, my] = [e.x / PX, (e.y - Math.max(0, e.z) * LIFT) / PX];
        for (const [sx, sy] of copies(mx, my, PULSE_REACH / PX + 10)) {
          fx.lineStyle(2, 0x7fd4ff, 0.3 + 0.5 * k);
          fx.strokeCircle(sx, sy, (PULSE_REACH / PX) * k);
          fx.fillStyle(0x7fd4ff, 0.08 + 0.1 * k);
          fx.fillCircle(sx, sy, (PULSE_REACH / PX) * k);
        }
      }
      if (e.type === 'surge') {
        const c = s.conduits.find((k) => k.id === e.conduit);
        const n = c?.nodes[Math.max(0, Math.min(c.nodes.length - 1, e.index - e.dir))];
        if (!n) continue;
        const strength = Math.max(0.15, 1 - e.traveled / 50);
        for (const [sx, sy] of copies(n.x / PX, (n.y - Math.max(0, n.z) * LIFT) / PX, 12)) {
          fx.fillStyle(this.color(e.owner), 0.9);
          fx.fillCircle(sx, sy, 2 + 4 * strength);
          fx.fillStyle(0xffffff, 0.8 * strength);
          fx.fillCircle(sx, sy, 1.5 + 2 * strength);
        }
      }
    }
  }

  // The targeting marks: a ring around the selected launcher, and marks
  // showing roughly the heading, drawn over everything, fog included
  // (spec 01, What players see; spec 10, The launching view). And the
  // conduit marker, where the new conduit would start too close to one
  // of the launcher's own.
  drawTargeting(copies, controls) {
    const u = controls.selectedUnit();
    if (!u) return;
    const top = this.gfx.top;
    const spec = UNIT_KINDS[u.kind];
    const mx = u.x / PX;
    const my = (u.y - Math.max(0, u.base) * LIFT) / PX;
    const r = spec.radius / PX + 6;
    const color = this.color(u.owner);
    const charging = controls.meter.holding;
    for (const [sx, sy] of copies(mx, my, 80)) {
      top.lineStyle(1.5, 0xffffff, 0.85);
      top.strokeCircle(sx, sy, r);
      if (charging) {
        // Charging: the launcher glows as the meter fills.
        top.fillStyle(0xffffff, 0.15 + 0.25 * Math.abs(Math.sin(this.time / 90)));
        top.fillCircle(sx, sy - (spec.height * LIFT) / PX, 7);
      }
      if (!controls.item) continue;
      const a = deg(markHeading(controls.aim()));
      for (let k = 0; k < 3; k++) {
        const d = r + 10 + k * 12;
        top.fillStyle(color, 1);
        top.fillCircle(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 3 - k * 0.6);
        top.lineStyle(1, 0x000000, 0.6);
        top.strokeCircle(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 3 - k * 0.6);
      }
    }
    if (controls.item) {
      const warn = conduitWarning(this.game.state, u, moveHeading(controls.aim()), this.map.size);
      for (const id of warn) {
        const c = this.game.state.conduits.find((k) => k.id === id);
        // The marker sits on the end of the conduit nearest the launcher.
        const live = c ? c.nodes.filter((n) => !isGone(this.game.state, n)) : [];
        const pts = c?.to === u.id ? live.slice(-6) : live.slice(0, 6);
        for (const n of pts) {
          for (const [sx, sy] of copies(n.x / PX, (n.y - Math.max(0, n.z) * LIFT) / PX, 10)) {
            top.lineStyle(2, 0xffd040, 0.5 + 0.5 * Math.abs(Math.sin(this.time / 160)));
            top.strokeCircle(sx, sy, 5);
          }
        }
      }
    }
  }

  // Damage bars and range circles, for the viewer's side (spec 10).
  drawOverlays(copies) {
    const prefs = this.scene.prefs;
    if (!prefs || this.watching) return;
    const top = this.gfx.top;
    for (const u of this.game.state.units) {
      if (!this.mine(u.owner)) continue;
      const spec = UNIT_KINDS[u.kind];
      const mx = u.x / PX;
      const my = (u.y - Math.max(0, u.base) * LIFT) / PX;
      if (prefs.rangeCircles && (u.kind === 'interceptor' || u.kind === 'charge')) {
        const reach = (u.kind === 'interceptor' ? INTERCEPTOR_RANGE : CHARGE_TRIGGER) / PX;
        for (const [sx, sy] of copies(mx, my, reach + 4)) {
          top.lineStyle(1, this.color(u.owner), 0.6);
          top.strokeCircle(sx, sy, reach);
        }
      }
      if (prefs.damageBars) {
        const h = (spec.height * LIFT) / PX;
        const frac = Math.max(0, u.armor) / spec.armor;
        for (const [sx, sy] of copies(mx, my, 30)) {
          top.fillStyle(0x000000, 0.7);
          top.fillRect(sx - 10, sy - h - 9, 20, 4);
          top.fillStyle(frac > 0.5 ? 0x5fdc6a : frac > 0.25 ? 0xf0c419 : 0xe8483b, 1);
          top.fillRect(sx - 10, sy - h - 9, 20 * frac, 4);
        }
      }
    }
  }

  destroy() {
    for (const img of [...this.terrainImages, ...this.fogImages]) img.destroy();
    for (const g of Object.values(this.gfx)) g.destroy();
  }
}

// One unit, its base at (sx, sy), its top h above.
function drawKind(g, u, { sx, sy, r, h, color, faction, t, working, game }) {
  const dark = shade(color, 0.6);
  const light = shade(color, 1.35);
  const sides = FACTION_SIDES[faction] ?? 0;
  const shape = (cx, cy, rad, fill) => {
    g.fillStyle(fill, 1);
    if (sides === 0) g.fillEllipse(cx, cy, rad * 2, rad * 1.5);
    else {
      const pts = [];
      for (let k = 0; k < sides; k++) {
        const a = deg(k * (360 / sides) + 180 / sides);
        pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.75 });
      }
      g.fillPoints(pts, true);
    }
  };
  const shadow = () => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(sx + 3, sy + 2, r * 2.1, r * 1.5);
  };
  switch (u.kind) {
    case 'outpost':
    case 'battery': {
      shadow();
      shape(sx, sy, r, dark);
      g.fillStyle(color, 1);
      g.fillRect(sx - r * 0.55, sy - h, r * 1.1, h);
      shape(sx, sy - h, r * 0.7, light);
      if (u.kind === 'battery') {
        g.fillStyle(0x222222, 1);
        g.fillRect(sx - 2, sy - h - 9, 4, 9);
        g.fillRect(sx - 7, sy - h - 6, 3, 6);
        g.fillRect(sx + 4, sy - h - 6, 3, 6);
      } else {
        g.fillStyle(0x222222, 1);
        g.fillCircle(sx, sy - h, r * 0.3);
      }
      break;
    }
    case 'extractor': {
      shadow();
      shape(sx, sy, r, dark);
      g.fillStyle(color, 1);
      g.fillRect(sx - r * 0.4, sy - h, r * 0.8, h);
      // It turns faster on a vent (spec 02, Energy Vents).
      const speed = u.onVent ? 260 : 900;
      const a = t / speed;
      g.lineStyle(3, light, 1);
      for (let k = 0; k < 3; k++) {
        const b = a + (k * Math.PI * 2) / 3;
        g.lineBetween(sx, sy - h, sx + Math.cos(b) * r * 0.9, sy - h + Math.sin(b) * r * 0.5);
      }
      break;
    }
    case 'barrier': {
      shadow();
      shape(sx, sy, r, dark);
      g.fillStyle(color, 1);
      g.fillTriangle(sx - r * 0.6, sy, sx + r * 0.6, sy, sx, sy - h - 4);
      g.fillStyle(working && u.up ? 0x9fd8ff : 0x555555, 1);
      g.fillCircle(sx, sy - h - 4, 3);
      break;
    }
    case 'interceptor': {
      shadow();
      shape(sx, sy, r, dark);
      g.fillStyle(color, 1);
      g.fillRect(sx - r * 0.5, sy - h * 0.6, r, h * 0.6);
      g.fillStyle(0xdddddd, 1);
      for (const dx of [-5, 0, 5]) g.fillRect(sx + dx - 1.5, sy - h - 2, 3, h * 0.5);
      break;
    }
    case 'spire': {
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(sx + 8, sy + 3, r * 2.5, r * 1.2);
      shape(sx, sy, r, dark);
      g.fillStyle(color, 1);
      g.fillTriangle(sx - r * 0.5, sy, sx + r * 0.5, sy, sx, sy - h);
      const blink = working && Math.floor(t / 600) % 2 === 0;
      g.fillStyle(blink ? 0xffffff : light, 1);
      g.fillCircle(sx, sy - h, 2.5);
      break;
    }
    case 'pontoon': {
      // A deck at water level, under the units standing on it.
      const half = (TILE / PX) / 2 - 2;
      g.fillStyle(shade(0x7a6a50, working ? 1 : 0.5), 1);
      g.fillRect(sx - half, sy - half, half * 2, half * 2);
      g.lineStyle(1, shade(color, working ? 1 : 0.5), 1);
      g.strokeRect(sx - half, sy - half, half * 2, half * 2);
      g.lineStyle(1, 0x000000, 0.25);
      for (let k = -half + 6; k < half; k += 6) g.lineBetween(sx - half, sy + k, sx + half, sy + k);
      break;
    }
    case 'skyProbe': {
      // High in the air; something on the ground below shows where.
      const gz = sampleTerrain(game.map, u.x, u.y).alt;
      const groundY = sy + ((u.base - gz) * LIFT) / PX;
      g.lineStyle(1, color, 0.6);
      g.strokeCircle(sx, groundY, 5);
      g.lineBetween(sx - 7, groundY, sx + 7, groundY);
      g.lineBetween(sx, groundY - 4, sx, groundY + 4);
      g.fillStyle(dark, 1);
      g.fillCircle(sx, sy - h / 2, r * 0.6);
      g.fillStyle(light, 1);
      g.fillCircle(sx, sy - h / 2 - 2, r * 0.3);
      if (working) {
        const a = t / 200;
        g.lineStyle(1, 0xffffff, 0.7);
        g.lineBetween(sx - Math.cos(a) * r, sy - h / 2 - r * 0.6, sx + Math.cos(a) * r, sy - h / 2 - r * 0.6);
      }
      break;
    }
    case 'charge': {
      shadow();
      shape(sx, sy, r, dark);
      g.fillStyle(color, 1);
      g.fillCircle(sx, sy - h * 0.5, r * 0.55);
      const lit = working && u.armed && Math.floor(t / 400) % 2 === 0;
      g.fillStyle(lit ? 0xff3030 : 0x552222, 1);
      g.fillCircle(sx, sy - h * 0.5, 2);
      break;
    }
    case 'rover': {
      // It faces roughly its heading, to within about 20° (spec 04).
      const shown = Math.round((u.heading ?? 0) / 20) * 20;
      const a = deg(shown);
      const under = u.base < 0;
      const driving = game.state.drive?.rover === u.id && !game.state.drive.done;
      const jig = driving ? Math.sin(t / 40) * 0.8 : 0;
      const cx = sx;
      const cy = sy + jig;
      const fx = Math.cos(a);
      const fy = Math.sin(a) * 0.75;
      g.fillStyle(under ? 0x2a4a66 : 0x000000, under ? 0.5 : 0.3);
      g.fillEllipse(cx + 2, cy + 2, 14, 9);
      const body = under ? shade(color, 0.55) : color;
      g.fillStyle(body, under ? 0.6 : 1);
      g.fillPoints([
        { x: cx + fx * 8, y: cy + fy * 8 },
        { x: cx - fx * 6 - fy * 5, y: cy - fy * 6 + fx * 5 * 0.75 },
        { x: cx - fx * 6 + fy * 5, y: cy - fy * 6 - fx * 5 * 0.75 },
      ], true);
      if (driving) {
        g.fillStyle(0xdddddd, 0.6);
        g.fillCircle(cx - fx * 9, cy - fy * 9, 1.5 + Math.random());
      }
      if (u.triggered && Math.floor(t / 100) % 2 === 0) {
        g.lineStyle(2, 0xff3030, 1);
        g.strokeCircle(cx, cy, 9);
      }
      break;
    }
    default:
      shape(sx, sy, r, color);
  }
}
