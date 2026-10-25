// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Setting up a game on this machine (spec 12, Setting up a game): the
// seats, the map and the host's settings. Every human here plays at
// this screen in turn (hot seat); computers can join them.

import { BaseScene } from './base.js';
import { Button, label, textField, UI, panel } from '../ui/kit.js';
import { MAPS } from '../core/maps.js';
import { rollSetup, computerLooks, claimColor, teamLayout, generatedMap } from '../core/newgame.js';
import { PERSONALITIES } from '../core/computers.js';
import { checkSetup } from '../../rules/setup.js';
import { MAX_PLAYERS, TILE, PX, MAP_SIZES } from '../../rules/constants.js';
import { PLANETS } from '../../rules/terrain/planets.js';
import { STYLES, ENERGY_NAMES, TERRAIN_NAMES, WATER_NAMES } from '../../mapgen/generate.js';
import { PLAYER_COLORS, PLAYER_COLOR_NAMES, FACTION_NAMES } from '../render/palette.js';

const CLOCKS = [0, 15, 30, 60];
const WINDS = ['None', 'Light', 'Medium', 'Strong'];
const TEAMS = [null, 'A', 'B', 'C'];
const GENERATED = 'Generated';
const RANDOM = 'random';
const STEPS = [0, 1, 2, 3, 4];
// The generator's controls (spec 02, Generated maps): each cycles
// through its values, then Random.
const CONTROLS = [
  ['style', 'Style', STYLES, (v) => (v === 'mirror' ? 'Mirrored' : 'Grown')],
  ['tiles', 'Size', MAP_SIZES, (v) => `${(v * TILE) / PX} px`],
  ['planet', 'Planet', Object.keys(PLANETS), (v) => v[0].toUpperCase() + v.slice(1)],
  ['energy', 'Energy', STEPS, (v) => ENERGY_NAMES[v]],
  ['terrain', 'Terrain', STEPS, (v) => TERRAIN_NAMES[v]],
  ['water', 'Water', STEPS, (v) => WATER_NAMES[v]],
];
const DEFAULT_GENERATOR = { style: RANDOM, tiles: RANDOM, planet: RANDOM, energy: RANDOM, terrain: RANDOM, water: RANDOM };

export class SetupScene extends BaseScene {
  constructor() {
    super('setup');
  }

  create() {
    const prefs = this.prefs;
    const host = prefs.host;
    // The maps, then a generated map at the end of the list.
    this.mapIndex = host.map === GENERATED ? MAPS.length : Math.max(0, MAPS.findIndex((m) => m.name === host.map));
    this.generator = { ...DEFAULT_GENERATOR, ...host.generator };
    this.clock = CLOCKS.includes(host.clock) ? host.clock : 60;
    this.wind = host.wind ?? 0;
    this.fog = host.fog ?? true;
    // Seats: the first is this player; the second starts as a computer.
    this.seats = [
      { kind: 'human', name: prefs.name, faction: prefs.faction, color: prefs.color, team: null },
      { kind: 'computer', personality: 'random', team: null },
      { kind: 'empty', team: null },
      { kind: 'empty', team: null },
    ];
    Object.assign(this.seats[1], computerLooks([this.seats[0]], Math.random));

    this.heading = this.title('New game');
    this.box = panel(this, 0.9);
    this.rows = this.seats.map((seat, i) => this.makeRow(seat, i));
    this.settings = [
      new Button(this, '', { size: 13, onClick: () => this.cycle('mapIndex', MAPS.length + 1) }),
      new Button(this, '', { size: 13, onClick: () => this.cycleList('clock', CLOCKS) }),
      new Button(this, '', { size: 13, onClick: () => this.cycle('wind', WINDS.length) }),
      new Button(this, '', { size: 13, onClick: () => { this.fog = !this.fog; this.refresh(); } }),
    ];
    this.controls = CONTROLS.map(([key, , values]) => new Button(this, '', {
      size: 13,
      onClick: () => {
        const list = [...values, RANDOM];
        this.generator[key] = list[(list.indexOf(this.generator[key]) + 1) % list.length];
        this.refresh();
      },
    }));
    this.problem = label(this, '', { size: 13, color: UI.warn, wrap: 400 });
    this.start = new Button(this, 'Start', { size: 17, onClick: () => this.startGame() });
    this.back = new Button(this, 'Back', { size: 15, onClick: () => this.scene.start('menu') });
    this.refresh();
    this.autoLayout();
  }

  makeRow(seat, i) {
    const row = {};
    row.kind = new Button(this, '', { size: 13, onClick: () => this.cycleKind(i) });
    row.name = textField(this, seat.name ?? `Player ${i + 1}`, { maxLength: 16, width: 120 });
    row.name.input.addEventListener('input', () => {
      seat.name = row.name.input.value.trim();
      this.refresh();
    });
    row.personality = new Button(this, '', { size: 13, onClick: () => this.cyclePersonality(i) });
    row.faction = new Button(this, '', { size: 13, onClick: () => { seat.faction = (seat.faction + 1) % FACTION_NAMES.length; this.refresh(); } });
    row.color = new Button(this, '', { size: 13, onClick: () => this.cycleColor(i) });
    row.team = new Button(this, '', { size: 13, onClick: () => { seat.team = TEAMS[(TEAMS.indexOf(seat.team) + 1) % TEAMS.length]; this.refresh(); } });
    row.swatch = this.add.rectangle(0, 0, 10, 10, 0xffffff).setOrigin(0, 0);
    return row;
  }

  cycle(key, n) {
    this[key] = (this[key] + 1) % n;
    this.refresh();
  }

  cycleList(key, list) {
    this[key] = list[(list.indexOf(this[key]) + 1) % list.length];
    this.refresh();
  }

  taken(except) {
    return this.seats.filter((s, k) => k !== except && s.kind !== 'empty');
  }

  cycleKind(i) {
    const seat = this.seats[i];
    const order = i === 0 ? ['human', 'computer'] : ['empty', 'human', 'computer'];
    const next = order[(order.indexOf(seat.kind) + 1) % order.length];
    seat.kind = next;
    if (next === 'human') {
      seat.name = this.rows[i].name.input.value.trim() || `Player ${i + 1}`;
      seat.faction ??= 0;
      seat.color = claimColor(this.taken(i), -1, seat.color ?? i, Math.random);
    }
    if (next === 'computer') {
      // A computer gets a random free faction and color (spec 12).
      Object.assign(seat, computerLooks(this.taken(i), Math.random));
      seat.personality = 'random';
    }
    this.refresh();
  }

  cyclePersonality(i) {
    const seat = this.seats[i];
    const k = PERSONALITIES.findIndex((p) => p.id === seat.personality);
    seat.personality = PERSONALITIES[(k + 1) % PERSONALITIES.length].id;
    this.refresh();
  }

  cycleColor(i) {
    const seat = this.seats[i];
    const others = this.taken(i).map((s) => s.color);
    for (let k = 1; k <= PLAYER_COLORS.length; k++) {
      const c = (seat.color + k) % PLAYER_COLORS.length;
      if (!others.includes(c)) {
        seat.color = c;
        break;
      }
    }
    this.refresh();
  }

  // The players as the setup lists them, from the seats in use.
  players() {
    return this.seats.filter((s) => s.kind !== 'empty').map((s, k) => ({
      name: s.kind === 'computer' ? `Computer ${k + 1}` : (s.name || `Player ${k + 1}`),
      faction: s.faction,
      color: s.color,
      team: s.team,
      computer: s.kind === 'computer',
      personality: s.personality,
    }));
  }

  get generated() {
    return this.mapIndex === MAPS.length;
  }

  // What would stop the game starting, or null.
  check() {
    const players = this.players();
    const map = MAPS[this.mapIndex];
    try {
      checkSetup({
        map: {},
        players,
        order: players.map((_, i) => i),
        starts: players.map(() => ({ x: 0, y: 0 })),
        clock: this.clock,
        wind: { level: this.wind, dir: 0, variation: 0 },
        fog: this.fog,
      });
    } catch (e) {
      return e.message.split('\n- ').slice(1).join('; ');
    }
    // A generated map has start positions for every layout.
    if (map && !map.starts[players.length]?.[teamLayout(players)]) return `${map.name} has no start positions for these teams.`;
    return null;
  }

  refresh() {
    this.seats.forEach((seat, i) => {
      const row = this.rows[i];
      const used = seat.kind !== 'empty';
      row.kind.setText(seat.kind === 'empty' ? 'Empty seat' : seat.kind === 'human' ? 'Human' : 'Computer');
      row.name.setVisible(seat.kind === 'human');
      const personality = PERSONALITIES.find((p) => p.id === seat.personality)?.name ?? 'Random';
      row.personality.setVisible(seat.kind === 'computer').setText(personality);
      for (const k of ['faction', 'color', 'team']) row[k].setVisible(used);
      row.swatch.setVisible(used);
      if (used) {
        row.faction.setText(FACTION_NAMES[seat.faction]);
        row.color.setText(PLAYER_COLOR_NAMES[seat.color]);
        row.swatch.setFillStyle(PLAYER_COLORS[seat.color]);
        row.team.setText(seat.team ? `Team ${seat.team}` : 'No team');
      }
    });
    const map = MAPS[this.mapIndex];
    if (map) {
      const px = (map.rows.length * TILE) / PX;
      this.settings[0].setText(`Map: ${map.name} (${px} px, ${map.players} players)`);
    } else {
      this.settings[0].setText('Map: Generated');
    }
    CONTROLS.forEach(([key, name, , show], k) => {
      const v = this.generator[key];
      this.controls[k].setVisible(this.generated).setText(`${name}: ${v === RANDOM ? 'Random' : show(v)}`);
    });
    this.settings[1].setText(`Shot clock: ${this.clock === 0 ? 'off' : `${this.clock} s`}`);
    this.settings[2].setText(`Wind: ${WINDS[this.wind]}`);
    this.settings[3].setText(`Fog of war: ${this.fog ? 'on' : 'off'}`);
    const problem = this.check();
    this.problem.setText(problem ?? '');
    this.start.setEnabled(problem === null);
    this.layout();
  }

  startGame() {
    if (this.check()) return;
    const prefs = this.prefs;
    // Remembered for next time (spec 12).
    const me = this.seats[0];
    if (me.kind === 'human') {
      prefs.name = me.name || prefs.name;
      prefs.faction = me.faction;
      prefs.color = me.color;
    }
    prefs.host = {
      map: this.generated ? GENERATED : MAPS[this.mapIndex].name, generator: this.generator, clock: this.clock, wind: this.wind, fog: this.fog,
    };
    this.savePrefs();
    // The host generates the map (spec 02, Generated maps).
    const map = this.generated ? generatedMap(this.generator, Math.random) : MAPS[this.mapIndex];
    const setup = rollSetup({
      map, players: this.players(), clock: this.clock, wind: this.wind, fog: this.fog,
    });
    this.scene.start('game', { setup });
  }

  layout() {
    const { width, height } = this.scale;
    const narrow = width < 720;
    const w = Math.min(760, width - 24);
    const x0 = (width - w) / 2;
    let y = 16;
    this.heading.setPosition(width / 2, y);
    y += 50;
    const rowH = narrow ? 76 : 40;
    this.box.setPosition(x0 - 6, y - 6).setSize(w + 12, rowH * MAX_PLAYERS + 8);
    const colW = narrow ? (w - 8) / 3 : (w - 30) / 5;
    this.rows.forEach((row) => {
      const h = 32;
      row.kind.setSize(colW, h).setPosition(x0, y);
      row.name.setPosition(x0 + colW + 6, y);
      row.name.input.style.width = `${colW - 22}px`;
      row.personality.setSize(colW, h).setPosition(x0 + colW + 6, y);
      const y2 = narrow ? y + 38 : y;
      const x2 = narrow ? x0 : x0 + (colW + 6) * 2;
      row.faction.setSize(colW, h).setPosition(x2, y2);
      row.color.setSize(colW - 14, h).setPosition(x2 + colW + 6, y2);
      row.swatch.setPosition(x2 + colW + 6 + colW - 12, y2 + 4).setSize(10, h - 8);
      row.team.setSize(colW, h).setPosition(x2 + (colW + 6) * 2, y2);
      y += rowH;
    });
    y += 14;
    const sw = narrow ? w : (w - 6) / 2;
    this.settings.forEach((b, k) => {
      const col = narrow ? 0 : k % 2;
      const r = narrow ? k : Math.floor(k / 2);
      b.setSize(sw, 32).setPosition(x0 + col * (sw + 6), y + r * 38);
    });
    y += (narrow ? 4 : 2) * 38 + 6;
    if (this.generated) {
      const cols = narrow ? 2 : 3;
      const cw = (w - 6 * (cols - 1)) / cols;
      this.controls.forEach((b, k) => {
        b.setSize(cw, 32).setPosition(x0 + (k % cols) * (cw + 6), y + Math.floor(k / cols) * 38);
      });
      y += Math.ceil(this.controls.length / cols) * 38 + 6;
    }
    this.problem.setPosition(x0, y).setWordWrapWidth(w);
    this.start.setSize(160, 44).setPosition(width - 16 - 160, height - 60);
    this.back.setSize(110, 44).setPosition(16, height - 60);
  }
}
