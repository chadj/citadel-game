// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The online lobby (spec 12, The lobby): the player's name, the games
// waiting for players, and hosting a game.

import { BaseScene } from './base.js';
import { Button, label, textField, panel, UI } from '../ui/kit.js';
import { netFor } from '../core/net.js';
import { GAME_NAME_MAX, NAME_MAX } from '../../net/protocol.js';

const WINDS = ['no wind', 'light wind', 'medium wind', 'strong wind'];
const ROWS = 8;

export class LobbyScene extends BaseScene {
  constructor() {
    super('lobby');
  }

  create(data = {}) {
    this.audio?.music.play('menu');
    const prefs = this.prefs;
    this.net = netFor(this.registry, prefs.name);
    this.games = [];
    this.heading = this.title('Play online');
    this.nameLabel = label(this, 'Your name', { size: 13, color: UI.dimText });
    this.nameField = textField(this, prefs.name, { maxLength: NAME_MAX, width: 180 });
    // The name is remembered between visits (spec 12, The lobby).
    this.nameField.input.addEventListener('change', () => this.rename());
    this.box = panel(this, 0.9);
    this.empty = label(this, '', { size: 14, color: UI.dimText });
    this.rows = [...Array(ROWS)].map((_, k) => ({
      text: label(this, '', { size: 14 }),
      join: new Button(this, 'Join', { size: 13, onClick: () => this.join(k) }),
    }));
    this.hostLabel = label(this, 'Host a game', { size: 13, color: UI.dimText });
    this.gameName = textField(this, `${prefs.name}'s game`, { maxLength: GAME_NAME_MAX, width: 220, onEnter: () => this.host() });
    this.hostBtn = new Button(this, 'Host', { size: 15, onClick: () => this.host() });
    this.status = label(this, data.message ?? '', { size: 13, color: UI.warn, wrap: 500 });
    this.back = new Button(this, 'Back', { size: 15, onClick: () => this.scene.start('menu') });

    const net = this.net;
    const offs = [
      net.on('games', (m) => {
        this.games = m.games;
        this.refresh();
      }),
      net.on('connected', () => {
        this.status.setText('');
        net.send('lobby');
      }),
      net.on('disconnected', () => this.status.setText('Lost touch with the server. Trying again…')),
      net.on('error', (m) => this.status.setText(m.reason)),
      net.on('room', (m) => this.scene.start('setup', { online: { net, room: m.room, you: m.you, host: m.host } })),
      // Taking back a seat in a game that's under way.
      net.on('start', (m) => this.scene.start('game', { online: { net, setup: m.setup, you: m.you, moves: m.moves } })),
    ];
    this.events.once('shutdown', () => offs.forEach((off) => off()));
    if (net.open) net.send('lobby');
    else this.status.setText('Connecting…');
    this.refresh();
    this.autoLayout();
  }

  rename() {
    const name = this.nameField.input.value.trim().slice(0, NAME_MAX);
    if (!name || name === this.prefs.name) return;
    this.prefs.name = name;
    this.savePrefs();
    this.net.name = name;
    this.net.send('hello', { name, token: this.net.token });
  }

  // The host's settings are remembered from last time (spec 12).
  host() {
    this.rename();
    const prefs = this.prefs;
    const h = prefs.host;
    this.net.send('host', {
      name: this.gameName.input.value,
      settings: { map: h.map, generator: h.generator, clock: h.clock, wind: h.wind, fog: h.fog },
      me: { faction: prefs.faction, color: prefs.color },
    });
  }

  join(k) {
    const game = this.games[k];
    if (!game) return;
    this.rename();
    this.net.send('join', { room: game.id, me: { faction: this.prefs.faction, color: this.prefs.color } });
  }

  refresh() {
    this.empty.setText(this.games.length === 0 ? 'No games are waiting for players. Host one!' : '');
    this.rows.forEach((row, k) => {
      const g = this.games[k];
      row.text.setVisible(!!g);
      row.join.setVisible(!!g);
      if (!g) return;
      const clock = g.clock === 0 ? 'no shot clock' : `${g.clock} s clock`;
      row.text.setText(`${g.name}  ·  ${g.map}  ·  ${g.joined}/${g.needed} players  ·  ${clock}, ${WINDS[g.wind]}, fog ${g.fog ? 'on' : 'off'}`);
      row.join.setEnabled(g.joined < g.needed);
    });
    this.layout();
  }

  layout() {
    const { width, height } = this.view;
    const w = Math.min(760, width - 24);
    const x0 = (width - w) / 2;
    let y = 16;
    this.heading.setPosition(width / 2, y);
    y += 50;
    this.nameLabel.setPosition(x0, y + 8);
    this.nameField.setPosition(x0 + 80, y);
    y += 46;
    const rowH = 40;
    this.box.setPosition(x0 - 6, y - 6).setSize(w + 12, rowH * Math.max(1, Math.min(ROWS, this.games.length)) + 8);
    this.empty.setPosition(x0 + 4, y + 8);
    this.rows.forEach((row) => {
      row.join.setSize(80, 32).setPosition(x0 + w - 80, y);
      row.text.setPosition(x0 + 4, y + 8).setWordWrapWidth(w - 96);
      y += rowH;
    });
    y = Math.min(y + 10, height - 140);
    this.hostLabel.setPosition(x0, y + 8);
    this.gameName.setPosition(x0 + 90, y);
    this.hostBtn.setSize(100, 36).setPosition(x0 + 330, y);
    this.status.setPosition(x0, y + 50).setWordWrapWidth(w);
    this.back.setSize(110, 44).setPosition(16, height - 60);
  }
}
