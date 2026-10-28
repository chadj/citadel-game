// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Setting up a game on this machine (spec 12, Setting up a game): the
// seats, the map and the host's settings. Every human here plays at
// this screen in turn (hot seat); computers can join them.

import { BaseScene } from './base.js';
import { Button, label, textField, UI, panel } from '../ui/kit.js';
import { MAPS } from '../core/maps.js';
import { rollSetup, computerLooks, claimColor, generatedMap, setupProblem } from '../core/newgame.js';
import { PERSONALITIES } from '../core/computers.js';
import { MAX_PLAYERS, MAP_SIZES } from '../../rules/constants.js';
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
  ['tiles', 'Size', MAP_SIZES, (v) => `${v} × ${v} tiles`],
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

  // `data.online`, for an online game's setup screen (spec 12, Setting up
  // a game): { net, room, you, host }, as the server sent it.
  create(data = {}) {
    this.audio?.music.play('menu');
    this.online = data.online ?? null;
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

    this.heading = this.title(this.online ? this.online.room.name : 'New game');
    this.box = panel(this, 0.9);
    this.rows = this.seats.map((seat, i) => this.makeRow(seat, i));
    // On a phone each seat takes two rows: a wider gap with a line in it
    // shows where one seat ends and the next begins.
    this.dividers = this.seats.slice(1).map(() => this.add.rectangle(0, 0, 10, 1, 0x4a5a6b, 1).setOrigin(0, 0.5));
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
    this.back = new Button(this, 'Back', { size: 15, onClick: () => this.goBack() });
    if (this.online) this.goOnline();
    else this.refresh();
    this.autoLayout();
  }

  // Online ----------------------------------------------------------------

  goOnline() {
    const { net } = this.online;
    this.ready = new Button(this, 'Ready', { size: 15, onClick: () => net.send('ready', { ready: !this.mySeat.ready }) });
    this.chatLog = [];
    this.chatText = label(this, '', { size: 13, wrap: 400 });
    this.chatField = textField(this, '', {
      maxLength: 120,
      width: 260,
      placeholder: 'Chat',
      onEnter: (v) => {
        if (v.trim()) net.send('chat', { text: v });
        this.chatField.input.value = '';
      },
    });
    const offs = [
      net.on('room', (m) => {
        this.online = { ...this.online, room: m.room, you: m.you, host: m.host };
        this.fromRoom();
      }),
      net.on('chat', (m) => {
        this.chatLog.push(m.system ?? `${m.name}: ${m.text}`);
        this.chatLog = this.chatLog.slice(-6);
        this.chatText.setText(this.chatLog.join('\n'));
        this.uiSound('ui.chat');
      }),
      net.on('error', (m) => this.problem.setText(m.reason)),
      net.on('closed', (m) => this.scene.start('lobby', { message: m.reason })),
      // A new welcome means the server didn't know this player when they
      // came back (it restarted, or dropped them): their setup is gone
      // (D63).
      net.on('welcome', () => this.scene.start('lobby', { message: 'Lost touch with the server, and this game\'s setup has closed.' })),
      net.on('start', (m) => this.scene.start('game', { online: { net, setup: m.setup, you: m.you, moves: m.moves } })),
    ];
    this.events.once('shutdown', () => offs.forEach((off) => off()));
    this.fromRoom();
  }

  get isHost() {
    return !this.online || this.online.host;
  }

  get mySeat() {
    return this.online ? this.seats[this.online.you] : this.seats[0];
  }

  // The setup as the server has it.
  fromRoom() {
    const { room } = this.online;
    const st = room.settings;
    this.mapIndex = st.map === GENERATED ? MAPS.length : Math.max(0, MAPS.findIndex((m) => m.name === st.map));
    this.generator = { ...st.generator };
    this.clock = st.clock;
    this.wind = st.wind;
    this.fog = st.fog;
    // In place: each row's buttons hold on to their seat.
    room.seats.forEach((s, i) => {
      const seat = this.seats[i];
      for (const k of Object.keys(seat)) delete seat[k];
      Object.assign(seat, s);
    });
    this.applying = true;
    this.refresh();
    this.applying = false;
  }

  // What this player changed goes to the server, which sends the setup
  // back to everyone.
  sendChanges() {
    const { net, you } = this.online;
    if (this.isHost) {
      net.send('setHost', {
        settings: { map: this.generated ? GENERATED : MAPS[this.mapIndex].name, generator: this.generator, clock: this.clock, wind: this.wind, fog: this.fog },
        seats: this.seats.map((s) => ({ kind: s.kind, personality: s.personality, team: s.team, faction: s.faction, color: s.color })),
      });
    }
    const me = this.seats[you];
    net.send('setMe', { faction: me.faction, color: me.color });
  }

  goBack() {
    if (this.online) {
      this.online.net.send('leave');
      this.scene.start('lobby');
    } else this.scene.start('menu');
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
    if (this.online && (i === 0 || seat.kind === 'human')) return;
    const order = this.online ? ['empty', 'open', 'computer'] : i === 0 ? ['human', 'computer'] : ['empty', 'human', 'computer'];
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
    const others = this.taken(i).filter((s) => s.kind !== 'open').map((s) => s.color);
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
    return setupProblem({ map: MAPS[this.mapIndex] ?? null, players: this.players(), clock: this.clock, wind: this.wind, fog: this.fog });
  }

  refresh() {
    if (this.online && !this.applying) this.sendChanges();
    const online = !!this.online;
    this.seats.forEach((seat, i) => {
      const row = this.rows[i];
      const used = seat.kind !== 'empty' && seat.kind !== 'open';
      const kinds = { empty: 'Empty seat', open: 'Open seat', human: 'Human', computer: 'Computer' };
      let kind = kinds[seat.kind];
      if (online && seat.kind === 'human') kind = `${seat.name}${i === this.online.you ? ' (you)' : ''}${i > 0 && seat.ready ? ' ✓' : ''}`;
      row.kind.setText(kind);
      row.name.setVisible(seat.kind === 'human' && !online);
      if (online) {
        // Only the host changes the seats; each player, their own looks.
        const mine = i === this.online.you;
        row.kind.setEnabled(this.isHost && seat.kind !== 'human');
        row.personality.setEnabled(this.isHost);
        row.team.setEnabled(this.isHost);
        row.faction.setEnabled(mine || (this.isHost && seat.kind === 'computer'));
        row.color.setEnabled(mine || (this.isHost && seat.kind === 'computer'));
      }
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
      const n = map.corners.length;
      this.settings[0].setText(`Map: ${map.name} (${n} × ${n} tiles, ${map.players} players)`);
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
    if (online) {
      for (const b of [...this.settings, ...this.controls]) b.setEnabled(this.isHost);
      this.ready.setVisible(!this.isHost).setText(this.mySeat?.ready ? 'Not ready' : 'Ready');
      this.start.setVisible(this.isHost);
    }
    const problem = online ? this.online.room.problem : this.check();
    this.problem.setText(problem ?? '');
    this.start.setEnabled(problem === null);
    this.layout();
  }

  startGame() {
    if (this.online) {
      this.online.net.send('start');
      return;
    }
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
    const { width, height } = this.view;
    const narrow = width < 720;
    const w = Math.min(760, width - 24);
    const x0 = (width - w) / 2;
    let y = 16;
    this.heading.setPosition(width / 2, y);
    y += 50;
    const rowH = narrow ? 88 : 40;
    this.box.setPosition(x0 - 6, y - 6).setSize(w + 12, rowH * MAX_PLAYERS + 8);
    const colW = narrow ? (w - 8) / 3 : (w - 30) / 5;
    this.rows.forEach((row, i) => {
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
      const divider = this.dividers[i];
      if (divider) divider.setVisible(narrow).setPosition(x0, y - 9).setSize(w, 1);
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
    if (this.online) {
      y += 30;
      this.chatText.setPosition(x0, y).setWordWrapWidth(w);
      this.chatField.setPosition(x0, Math.max(y + 110, height - 110));
      this.ready.setSize(160, 44).setPosition(width - 16 - 160, height - 60);
    }
    this.start.setSize(160, 44).setPosition(width - 16 - 160, height - 60);
    this.back.setSize(110, 44).setPosition(16, height - 60);
  }
}
