// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Options, outside a game (spec 10, Options): the player's name, the
// letter keys, the four camera preferences, the volumes and Aide
// Chatter (spec 11). All remembered.

import { BaseScene } from './base.js';
import { Button, Slider, label, textField, UI } from '../ui/kit.js';
import { KEY_ACTIONS, rebind } from '../core/keys.js';
import { Aide } from '../core/aide.js';
import { SLIDER_SAMPLES } from '../audio/sounds.js';

const CAMERA_PREFS = [
  ['edgeScroll', 'Edge Scrolling', 'The view scrolls when the pointer reaches the edge of the screen.'],
  ['selectNew', 'Select New Launchers', 'An Outpost or Battery you have just built becomes the selected launcher.'],
  ['steadyCamera', 'Steady Camera', 'A tracking camera keeps still until the shot nears the edge of the view.'],
  ['snapBack', 'Snap Back', 'After a tracking camera moves the view, it goes back when the turn passes.'],
];

const VOLUMES = [['effects', 'Sound effects'], ['music', 'Music'], ['aide', 'Aide\'s voice'], ['ui', 'Interface sounds']];

export class OptionsScene extends BaseScene {
  constructor() {
    super('options');
  }

  create() {
    this.audio?.music.play('menu');
    const prefs = this.prefs;
    this.scrollY = 0;
    this.rows = [];
    this.heading = this.title('Options');
    this.add$ = (obj, h) => this.rows.push({ obj, h });

    this.nameLabel = label(this, 'Your name', { size: 15, color: UI.dimText });
    this.add$(this.nameLabel, 24);
    this.nameField = textField(this, prefs.name, { maxLength: 20, width: 220 });
    this.nameField.input.addEventListener('input', () => {
      prefs.name = this.nameField.input.value.trim() || 'Player';
      this.savePrefs();
    });
    this.add$(this.nameField, 48);

    this.add$(label(this, 'Keys: pick one, then press a letter', { size: 15, color: UI.dimText }), 28);
    this.waiting = null;
    this.keyButtons = KEY_ACTIONS.map(([action, text]) => {
      const b = new Button(this, '', {
        size: 13,
        onClick: () => {
          this.waiting = action;
          this.refresh();
        },
      });
      b.action = action;
      b.caption = text;
      this.add$(b, 36);
      return b;
    });
    this.input.keyboard.on('keydown', (e) => {
      if (!this.waiting) return;
      if (/^[a-zA-Z]$/.test(e.key)) prefs.keys = rebind(prefs.keys, this.waiting, e.key);
      this.waiting = null;
      this.savePrefs();
      this.refresh();
    });

    this.add$(label(this, 'Camera', { size: 15, color: UI.dimText }), 28);
    this.toggles = CAMERA_PREFS.map(([key, name, tip]) => {
      const b = new Button(this, '', {
        size: 13,
        tip,
        onClick: () => {
          prefs[key] = !prefs[key];
          this.savePrefs();
          this.refresh();
        },
      });
      b.key = key;
      b.caption = name;
      this.add$(b, 36);
      return b;
    });

    this.add$(label(this, 'Volumes', { size: 15, color: UI.dimText }), 28);
    this.sliders = VOLUMES.map(([key, name]) => {
      const t = label(this, name, { size: 13 });
      this.add$(t, 20);
      const s = new Slider(this, prefs.volumes[key], (v) => {
        prefs.volumes[key] = v;
        this.savePrefs();
      }, { onRelease: () => this.sample(key) });
      this.add$(s, 30);
      return s;
    });
    this.chatter = new Button(this, '', {
      size: 13,
      onClick: () => {
        prefs.aideChatter = !prefs.aideChatter;
        this.savePrefs();
        this.refresh();
      },
    });
    this.add$(this.chatter, 44);

    this.back = new Button(this, 'Back', { onClick: () => this.scene.start('menu'), size: 16 });
    this.tipText = label(this, '', { size: 12, color: UI.dimText, wrap: 300 });
    this.events.on('tip', (text) => this.tipText.setText(text ?? ''));

    this.input.on('wheel', (p, over, dx, dy) => {
      this.scrollY = Math.max(0, Math.min(this.maxScroll ?? 0, this.scrollY + dy));
      this.layout();
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown || this.waiting) return;
      const dy = p.prevPosition.y - p.y;
      if (Math.abs(dy) > 0) {
        this.scrollY = Math.max(0, Math.min(this.maxScroll ?? 0, this.scrollY + dy));
        this.layout();
      }
    });
    this.refresh();
    this.autoLayout();
  }

  // Letting go of a volume slider plays a sample of its sound, at the
  // new volume (spec 11, Volumes).
  sample(key) {
    const audio = this.audio;
    if (!audio) return;
    const name = SLIDER_SAMPLES[key];
    if (name === 'music.sample') audio.music.sample();
    else if (name === 'aide.sample') audio.voice.say(new Aide({ random: () => 0 }).line('yourTurn'), this.prefs.faction);
    else audio.engine.play(name);
  }

  refresh() {
    const prefs = this.prefs;
    for (const b of this.keyButtons) {
      const key = this.waiting === b.action ? '…' : prefs.keys[b.action];
      b.setText(`${b.caption}:  ${key}`).setActive(this.waiting === b.action);
    }
    for (const b of this.toggles) b.setText(`${b.caption}: ${prefs[b.key] ? 'on' : 'off'}`).setActive(prefs[b.key]);
    this.chatter.setText(`Aide Chatter: ${prefs.aideChatter ? 'on' : 'off'}`).setActive(prefs.aideChatter);
  }

  layout() {
    const { width, height } = this.scale;
    const w = Math.min(360, width - 32);
    const x = width / 2 - w / 2;
    let y = 24 - this.scrollY;
    this.heading.setPosition(width / 2, y);
    y += 56;
    for (const { obj, h } of this.rows) {
      if (obj instanceof Button) obj.setSize(w, h - 6);
      if (obj instanceof Slider) {
        obj.w = w;
      }
      obj.setPosition(x, y);
      y += h;
    }
    this.back.setSize(120, 40).setPosition(16, height - 56);
    this.tipText.setPosition(152, height - 52);
    this.tipText.setWordWrapWidth(Math.max(120, width - 168));
    this.maxScroll = Math.max(0, y + this.scrollY - (height - 70));
  }
}
