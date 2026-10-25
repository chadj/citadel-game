// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What every screen shares: the preferences, a title, and laying itself
// out again when the window changes size.

import * as Phaser from 'phaser';
import { savePrefs } from '../core/prefs.js';
import { label, uiScale } from '../ui/kit.js';

export class BaseScene extends Phaser.Scene {
  get prefs() {
    return this.registry.get('prefs');
  }

  savePrefs() {
    savePrefs(this.prefs);
  }

  get u() {
    return uiScale(this.scale.width, this.scale.height);
  }

  // Calls layout() now and whenever the screen's size changes.
  autoLayout() {
    const relayout = () => this.layout?.();
    this.scale.on('resize', relayout);
    this.events.once('shutdown', () => this.scale.off('resize', relayout));
    relayout();
  }

  title(text) {
    return label(this, text, { size: 30, bold: true }).setOrigin(0.5, 0);
  }
}
