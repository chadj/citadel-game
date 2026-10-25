// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game menu (spec 10, The game menu): opened with the menu button or
// Esc. While it's open, the rest of the screen is dimmed and takes no
// clicks. It has the four volume sliders, help, Done and Quit, which
// asks first.

import { Button, Slider, label, panel } from './kit.js';

const DEPTH = 40;

const VOLUMES = [['effects', 'Sound effects'], ['music', 'Music'], ['aide', 'Aide\'s voice'], ['ui', 'Interface sounds']];

const HELP = [
  'Aim with the arrows by the Launch button, or the turn keys. Hold Launch to fill the meter, and let go to fire. The meter shows the power only roughly: judge it by feel.',
  'Buildings trail a conduit back to their launcher. If a conduit is cut, or its launcher destroyed, everything beyond it is lost. Keep your network out of harm\'s way.',
  'Your Citadel is the Outpost you start with. It looks like any other Outpost. Lose it and you\'re out, so keep the enemy guessing which one it is.',
  'Extractors earn energy every round, more on a glowing vent. Energy you don\'t spend before you pass is put aside and comes back next round.',
  'Rovers drive on at the end of every round, along the heading they were launched at, and explode at the first enemy they meet.',
  'Spires and Sky Probes see far through the fog. Damaged enemy units give themselves away with smoke, even in the fog.',
];

export class GameMenu {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.page = null; // a help page shown, or null
    this.confirm = false;
    const prefs = scene.prefs;
    const o = (x) => {
      x.setDepth(DEPTH + 1);
      return x;
    };
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0, 0).setDepth(DEPTH).setInteractive();
    this.box = o(panel(scene, 0.97));
    this.title = o(label(scene, 'Game menu', { size: 20, bold: true }));
    this.labels = VOLUMES.map(([, name]) => o(label(scene, name, { size: 13 })));
    this.sliders = VOLUMES.map(([key]) => o(new Slider(scene, prefs.volumes[key], (v) => {
      prefs.volumes[key] = v;
      scene.savePrefs();
    })));
    this.help = o(new Button(scene, 'Help', { size: 14, onClick: () => this.showHelp(0) }));
    this.done = o(new Button(scene, 'Done', { size: 14, onClick: () => this.toggle() }));
    this.quit = o(new Button(scene, 'Quit', { size: 14, onClick: () => { this.confirm = true; this.refresh(); } }));
    this.helpText = o(label(scene, '', { size: 14, wrap: 300 }));
    this.helpNext = o(new Button(scene, 'Next', { size: 13, onClick: () => this.showHelp(this.page + 1) }));
    this.helpBack = o(new Button(scene, 'Back', { size: 13, onClick: () => { this.page = null; this.refresh(); } }));
    this.sure = o(label(scene, 'Quit this game?', { size: 15 }));
    this.yes = o(new Button(scene, 'Quit', { size: 14, onClick: () => scene.quit() }));
    this.no = o(new Button(scene, 'Stay', { size: 14, onClick: () => { this.confirm = false; this.refresh(); } }));
    this.refresh();
  }

  toggle() {
    this.open = !this.open;
    this.page = null;
    this.confirm = false;
    this.scene.session.menuOpen = this.open;
    this.refresh();
  }

  showHelp(k) {
    this.page = k % HELP.length;
    this.helpText.setText(`${HELP[this.page]}\n\n(${this.page + 1} of ${HELP.length})`);
    this.refresh();
  }

  refresh() {
    const main = this.open && this.page === null && !this.confirm;
    this.dim.setVisible(this.open);
    this.box.setVisible(this.open);
    this.title.setVisible(this.open);
    for (const l of this.labels) l.setVisible(main);
    for (const s of this.sliders) s.setVisible(main);
    for (const b of [this.help, this.done, this.quit]) b.setVisible(main);
    const helping = this.open && this.page !== null;
    this.helpText.setVisible(helping);
    this.helpNext.setVisible(helping);
    this.helpBack.setVisible(helping);
    const asking = this.open && this.confirm;
    this.sure.setVisible(asking);
    this.yes.setVisible(asking);
    this.no.setVisible(asking);
    this.layout();
  }

  layout() {
    const { width, height } = this.scene.scale;
    this.dim.setSize(width, height);
    const w = Math.min(340, width - 24);
    const h = 56 + VOLUMES.length * 56 + 64;
    const x = (width - w) / 2;
    const y = Math.max(10, (height - h) / 2);
    this.box.setPosition(x, y).setSize(w, h);
    this.title.setPosition(x + 16, y + 14);
    let yy = y + 56;
    this.labels.forEach((l, k) => {
      l.setPosition(x + 16, yy);
      this.sliders[k].w = w - 32;
      this.sliders[k].setPosition(x + 16, yy + 18);
      yy += 56;
    });
    const bw = (w - 48) / 3;
    this.help.setSize(bw, 38).setPosition(x + 16, y + h - 54);
    this.done.setSize(bw, 38).setPosition(x + 24 + bw, y + h - 54);
    this.quit.setSize(bw, 38).setPosition(x + 32 + bw * 2, y + h - 54);
    this.helpText.setPosition(x + 16, y + 56).setWordWrapWidth(w - 32);
    this.helpBack.setSize(90, 34).setPosition(x + 16, y + h - 50);
    this.helpNext.setSize(90, 34).setPosition(x + w - 106, y + h - 50);
    this.sure.setPosition(x + 16, y + 70);
    this.yes.setSize(100, 38).setPosition(x + 16, y + 110);
    this.no.setSize(100, 38).setPosition(x + 126, y + 110);
  }

  update() {}
}
