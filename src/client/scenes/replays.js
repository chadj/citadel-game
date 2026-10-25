// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Saved replays (spec 12, Watching a replay): the list, to watch, save
// as a file or delete; and opening a replay file, such as one another
// player shared.

import { BaseScene } from './base.js';
import { Button, label, UI } from '../ui/kit.js';
import { listReplays, deleteReplay, replayToText, replayFromText, playable } from '../core/replay-store.js';
import { downloadText } from './summary.js';

const PER_PAGE = 6;

export class ReplaysScene extends BaseScene {
  constructor() {
    super('replays');
  }

  create() {
    this.audio?.music.play('menu');
    this.heading = this.title('Replays');
    this.page = 0;
    this.status = label(this, '', { size: 13, color: UI.warn, wrap: 500 });
    this.empty = label(this, 'No saved replays yet. Save one from the summary at the end of a game.', { size: 14, color: UI.dimText, wrap: 400 });
    this.rows = [];
    for (let k = 0; k < PER_PAGE; k++) {
      const row = {
        name: label(this, '', { size: 14 }),
        watch: new Button(this, 'Watch', { size: 13, onClick: () => this.watch(row.entry.replay) }),
        file: new Button(this, 'File', { size: 13, onClick: () => downloadText(`${row.entry.name}.lcreplay.json`, replayToText(row.entry.replay)) }),
        del: new Button(this, 'Delete', { size: 13, onClick: () => { deleteReplay(row.entry.id); this.refresh(); } }),
      };
      this.rows.push(row);
    }
    this.prevPage = new Button(this, '◀', { size: 13, onClick: () => { this.page -= 1; this.refresh(); } });
    this.nextPage = new Button(this, '▶', { size: 13, onClick: () => { this.page += 1; this.refresh(); } });
    this.open = new Button(this, 'Open a file', { size: 14, onClick: () => this.openFile() });
    this.back = new Button(this, 'Back', { size: 15, onClick: () => this.scene.start('menu') });
    this.refresh();
    this.autoLayout();
  }

  watch(replay) {
    if (!playable(replay)) {
      this.status.setText('That replay was made under other rules, and can\'t be played back.');
      return;
    }
    this.scene.start('game', { replay });
  }

  openFile() {
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = '.json,application/json';
    el.addEventListener('change', async () => {
      const file = el.files?.[0];
      if (!file) return;
      const result = replayFromText(await file.text());
      if (!result.ok) this.status.setText(result.reason);
      else this.watch(result.replay);
    });
    el.click();
  }

  refresh() {
    const list = listReplays().slice().reverse();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    this.page = Math.max(0, Math.min(pages - 1, this.page));
    this.empty.setVisible(list.length === 0);
    this.rows.forEach((row, k) => {
      const entry = list[this.page * PER_PAGE + k];
      row.entry = entry;
      const on = !!entry;
      row.name.setVisible(on);
      row.watch.setVisible(on);
      row.file.setVisible(on);
      row.del.setVisible(on);
      if (on) row.name.setText(`${entry.name}\n${new Date(entry.saved).toLocaleString()}`);
    });
    this.prevPage.setVisible(pages > 1).setEnabled(this.page > 0);
    this.nextPage.setVisible(pages > 1).setEnabled(this.page < pages - 1);
  }

  layout() {
    const { width, height } = this.scale;
    const w = Math.min(640, width - 24);
    const x = (width - w) / 2;
    let y = 20;
    this.heading.setPosition(width / 2, y);
    y += 60;
    this.empty.setPosition(x, y);
    for (const row of this.rows) {
      row.name.setPosition(x, y).setWordWrapWidth(w - 230);
      row.watch.setSize(70, 32).setPosition(x + w - 220, y);
      row.file.setSize(60, 32).setPosition(x + w - 144, y);
      row.del.setSize(70, 32).setPosition(x + w - 78, y);
      y += 48;
    }
    this.prevPage.setSize(36, 30).setPosition(x, y);
    this.nextPage.setSize(36, 30).setPosition(x + 42, y);
    this.status.setPosition(x, y + 40);
    this.open.setSize(130, 42).setPosition(width - 146, height - 60);
    this.back.setSize(110, 42).setPosition(16, height - 60);
  }
}
