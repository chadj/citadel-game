// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The main menu: a new game (hot seat or against computers), replays,
// and the options (spec 12, Ways to play, Watching a replay; spec 10,
// Options). Online play comes later.

import { BaseScene } from './base.js';
import { Button, label, UI } from '../ui/kit.js';

export class MenuScene extends BaseScene {
  constructor() {
    super('menu');
  }

  create() {
    this.heading = this.title('Lunar Citadel');
    this.sub = label(this, 'Artillery and base building on a wrapping world', { size: 15, color: UI.dimText }).setOrigin(0.5, 0);
    this.buttons = [
      new Button(this, 'New game', { onClick: () => this.scene.start('setup'), size: 18 }),
      new Button(this, 'Replays', { onClick: () => this.scene.start('replays'), size: 18 }),
      new Button(this, 'Options', { onClick: () => this.scene.start('options'), size: 18 }),
    ];
    this.note = label(this, 'Online play is on its way.', { size: 13, color: UI.dimText }).setOrigin(0.5, 0);
    this.autoLayout();
  }

  layout() {
    const { width, height } = this.scale;
    const cx = width / 2;
    let y = Math.max(30, height * 0.18);
    this.heading.setPosition(cx, y);
    this.sub.setPosition(cx, y + 44);
    y += 100;
    const w = Math.min(280, width - 32);
    for (const b of this.buttons) {
      b.setSize(w, 46).setPosition(cx - w / 2, y);
      y += 58;
    }
    this.note.setPosition(cx, y + 10);
  }
}
