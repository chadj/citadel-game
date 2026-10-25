// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What every screen shares: the preferences, a title, and laying itself
// out again when the window changes size.

import * as Phaser from 'phaser';
import { savePrefs } from '../core/prefs.js';
import { label, uiScale, DPR } from '../ui/kit.js';

export class BaseScene extends Phaser.Scene {
  get prefs() {
    return this.registry.get('prefs');
  }

  savePrefs() {
    savePrefs(this.prefs);
    this.audio?.engine.syncVolumes();
  }

  // The sound (src/client/audio): { engine, music, voice }.
  get audio() {
    return this.registry.get('audio');
  }

  // Buttons on the menu screens make sounds (spec 11, Menu sounds).
  get menuSounds() {
    return true;
  }

  // Plays an interface sound by name.
  uiSound(name) {
    this.audio?.engine.play(name);
  }

  // The screen's size in CSS pixels, which every layout works in.
  get view() {
    return { width: this.scale.width / DPR, height: this.scale.height / DPR };
  }

  get u() {
    return uiScale(this.view.width, this.view.height);
  }

  // Calls layout() now and whenever the screen's size changes.
  autoLayout() {
    // The camera zooms by the screen's density (kit.js, DPR).
    this.cameras.main.setOrigin(0, 0).setZoom(DPR);
    const relayout = () => this.layout?.();
    this.scale.on('resize', relayout);
    this.events.once('shutdown', () => this.scale.off('resize', relayout));
    relayout();
  }

  title(text) {
    return label(this, text, { size: 30, bold: true }).setOrigin(0.5, 0);
  }
}
