// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game summary (spec 10, The end of the game): how each player
// played. From here the player can save the replay, under a name or as a
// file (spec 12, Saving a replay).

import { BaseScene } from './base.js';
import { Button, label, textField, UI } from '../ui/kit.js';
import { gameStats } from '../core/stats.js';
import { saveReplay, replayToText, replayFileName } from '../core/replay-store.js';
import { PLAYER_COLORS, css } from '../render/palette.js';

const COLUMNS = [
  ['built', 'Units built'],
  ['earned', 'Energy earned'],
  ['fired', 'Attacking shots'],
  ['hits', 'Hits'],
  ['destroyed', 'Units destroyed'],
  ['accuracy', 'Accuracy'],
  ['knockedOut', 'Knocked out'],
];

export class SummaryScene extends BaseScene {
  constructor() {
    super('summary');
  }

  create({ setup, sides, events, replay, watched }) {
    this.replayData = replay;
    this.playEnding(setup, sides, events, watched);
    const stats = gameStats(setup, sides, events);
    this.heading = this.title('Game summary');
    this.cells = [];
    this.header = COLUMNS.map(([, name]) => label(this, name, { size: 12, color: UI.dimText, align: 'center', wrap: 80 }).setOrigin(0.5, 0));
    this.rows = setup.players.map((p, i) => {
      const name = label(this, p.name, { size: 15, bold: true, color: css(PLAYER_COLORS[p.color]) });
      const values = COLUMNS.map(([key]) => {
        const v = stats[i][key];
        let text = `${v}`;
        if (key === 'earned') text = `${Math.round(v / 10)}`;
        if (key === 'accuracy') text = v === null ? '–' : `${Math.round(v * 100)}%`;
        return label(this, text, { size: 15 }).setOrigin(0.5, 0);
      });
      return { name, values };
    });
    this.saveLabel = label(this, watched ? '' : 'Save the replay', { size: 14, color: UI.dimText });
    this.nameField = watched ? null : textField(this, `${setup.players.map((p) => p.name).join(' vs ')}`, { maxLength: 40, width: 220 });
    this.saveBtn = watched ? null : new Button(this, 'Save', { size: 14, onClick: () => this.save() });
    this.fileBtn = new Button(this, 'Save as file', { size: 14, onClick: () => this.download() });
    this.status = label(this, '', { size: 13, color: UI.warn });
    this.back = new Button(this, 'Main menu', { size: 15, onClick: () => this.scene.start('menu') });
    this.autoLayout();
  }

  // A victory song or a defeat song, then the menu song (spec 11,
  // Other music). Watching, or with humans on both sides, it's the
  // victory song.
  playEnding(setup, sides, events, watched) {
    const over = events.findLast((e) => e.type === 'gameOver');
    const winner = over ? over.winner : null;
    const humans = setup.players.map((p, i) => i).filter((i) => !setup.players[i].computer);
    const lost = !watched && humans.every((i) => winner === null || sides[i] !== winner);
    const music = this.audio?.music;
    if (!music) return;
    // The game's music fades into the ending.
    if (music.song === 'game') music.fadeOut(800, lost ? 'defeat' : 'victory');
    else music.play(lost ? 'defeat' : 'victory', { then: 'menu' });
  }

  save() {
    const ok = saveReplay(this.nameField.input.value, this.replayData);
    this.status.setText(ok ? 'Saved. Find it under Replays.' : 'The replay couldn\'t be saved here; save it as a file instead.');
    if (ok) this.saveBtn.setEnabled(false);
  }

  download() {
    downloadText(replayFileName(this.nameField?.input.value), replayToText(this.replayData));
  }

  layout() {
    const { width, height } = this.view;
    const narrow = width < 720;
    let y = 20;
    this.heading.setPosition(width / 2, y);
    y += 60;
    let x0;
    if (narrow) {
      // On a phone the table turns on its side: a row for each figure and
      // a column for each player, so it fits however many play.
      const w = width - 24;
      x0 = 12;
      const labelW = Math.min(130, w * 0.4);
      const colW = (w - labelW) / this.rows.length;
      const colX = (i) => x0 + labelW + colW * i + colW / 2;
      let tallest = 0;
      this.rows.forEach((r, i) => {
        r.name.setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(colW - 6).setPosition(colX(i), y);
        tallest = Math.max(tallest, r.name.height);
      });
      y += tallest + 12;
      this.header.forEach((h, k) => {
        h.setOrigin(0, 0).setAlign('left').setWordWrapWidth(labelW - 8).setPosition(x0, y + 2);
        this.rows.forEach((r, i) => r.values[k].setPosition(colX(i), y));
        y += Math.max(28, h.height + 10);
      });
    } else {
      const nameW = Math.min(150, width * 0.25);
      const colW = Math.min(90, (width - nameW - 24) / COLUMNS.length);
      x0 = Math.max(12, (width - nameW - colW * COLUMNS.length) / 2);
      this.header.forEach((h, k) => h.setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(colW - 4).setPosition(x0 + nameW + colW * k + colW / 2, y));
      y += 44;
      for (const r of this.rows) {
        r.name.setOrigin(0, 0).setAlign('left').setWordWrapWidth(null).setPosition(x0, y);
        r.values.forEach((v, k) => v.setPosition(x0 + nameW + colW * k + colW / 2, y));
        y += 30;
      }
    }
    y += 24;
    this.saveLabel.setPosition(x0, y);
    y += 22;
    this.nameField?.setPosition(x0, y);
    if (narrow) {
      // The buttons go under the name on a phone.
      const w = width - 24;
      if (this.nameField) {
        this.nameField.input.style.width = `${w - 18}px`;
        y += 46;
      }
      this.saveBtn?.setSize(80, 34).setPosition(x0, y);
      this.fileBtn.setSize(120, 34).setPosition(x0 + (this.saveBtn ? 90 : 0), y);
    } else {
      if (this.nameField) this.nameField.input.style.width = '220px';
      this.saveBtn?.setSize(80, 34).setPosition(x0 + 250, y);
      this.fileBtn.setSize(120, 34).setPosition(x0 + (this.saveBtn ? 340 : 0), y);
    }
    this.status.setPosition(x0, y + 44).setWordWrapWidth(width - 24);
    this.back.setSize(140, 42).setPosition(width / 2 - 70, height - 60);
  }
}

// Offers text to the player as a file to keep.
export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
