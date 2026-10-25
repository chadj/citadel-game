// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// A small set of interface pieces drawn with Phaser: buttons, toggles,
// sliders, labels and text fields. Every piece is placed with
// setPosition and sized with setSize, so screens can lay themselves out
// for any size, phones included.

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const UI = Object.freeze({
  panel: 0x141a22,
  panelEdge: 0x2c3846,
  button: 0x24303d,
  buttonHover: 0x31404f,
  buttonDown: 0x3f5266,
  active: 0x3d6f9e,
  disabled: 0x1b2129,
  text: '#e6edf3',
  dimText: '#7d8a96',
  warn: '#ffb347',
});

export function label(scene, text, { size = 14, color = UI.text, bold = false, align = 'left', wrap = 0 } = {}) {
  const t = scene.add.text(0, 0, text, {
    fontFamily: FONT,
    fontSize: `${Math.round(size)}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color,
    align,
    wordWrap: wrap ? { width: wrap } : undefined,
  });
  return t;
}

// A button. `onClick` runs on release over it. `onDown` and `onUp` are
// for buttons that are held, like Launch and the aim arrows: `onUp`
// also runs if the pointer leaves the button while held.
export class Button {
  constructor(scene, text, { onClick = null, onDown = null, onUp = null, size = 14, w = 90, h = 32, tip = null } = {}) {
    this.scene = scene;
    this.enabled = true;
    this.active = false;
    this.hover = false;
    this.down = false;
    this.visible = true;
    this.onClick = onClick;
    this.onDown = onDown;
    this.onUp = onUp;
    this.tip = tip;
    this.bg = scene.add.rectangle(0, 0, w, h, UI.button).setOrigin(0, 0).setStrokeStyle(1, UI.panelEdge);
    this.text = label(scene, text, { size }).setOrigin(0.5, 0.5);
    this.w = w;
    this.h = h;
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => {
      this.hover = true;
      this.paint();
      if (this.enabled && scene.menuSounds) scene.uiSound?.('ui.hover');
      if (this.tip) scene.events.emit('tip', this.tip, this);
    });
    this.bg.on('pointerout', () => {
      this.hover = false;
      if (this.down) {
        this.down = false;
        if (this.enabled) this.onUp?.(false);
      }
      this.paint();
      if (this.tip) scene.events.emit('tip', null, this);
    });
    this.bg.on('pointerdown', (pointer) => {
      if (!this.enabled || pointer.rightButtonDown()) return;
      this.down = true;
      this.paint();
      this.onDown?.();
    });
    this.bg.on('pointerup', () => {
      const was = this.down;
      this.down = false;
      this.paint();
      if (!was || !this.enabled) return;
      if (this.onClick && scene.menuSounds) scene.uiSound?.('ui.click');
      this.onUp?.(true);
      this.onClick?.();
    });
    this.paint();
  }

  setText(t) {
    if (this.text.text !== t) this.text.setText(t);
    return this;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.bg.setPosition(x, y);
    this.text.setPosition(x + this.w / 2, y + this.h / 2);
    return this;
  }

  setSize(w, h) {
    this.w = w;
    this.h = h;
    this.bg.setSize(w, h);
    this.bg.input?.hitArea?.setTo(0, 0, w, h);
    this.text.setPosition(this.x + w / 2, this.y + h / 2);
    return this;
  }

  setEnabled(on) {
    if (this.enabled !== on) {
      this.enabled = on;
      if (!on && this.down) {
        this.down = false;
        this.onUp?.(false);
      }
      this.paint();
    }
    return this;
  }

  setActive(on) {
    if (this.active !== on) {
      this.active = on;
      this.paint();
    }
    return this;
  }

  setVisible(on) {
    this.visible = on;
    this.bg.setVisible(on);
    this.text.setVisible(on);
    if (!on && this.down) {
      this.down = false;
      this.onUp?.(false);
    }
    return this;
  }

  setDepth(d) {
    this.bg.setDepth(d);
    this.text.setDepth(d + 0.1);
    return this;
  }

  paint() {
    let fill = UI.button;
    if (!this.enabled) fill = UI.disabled;
    else if (this.down) fill = UI.buttonDown;
    else if (this.active) fill = UI.active;
    else if (this.hover) fill = UI.buttonHover;
    this.bg.setFillStyle(fill);
    this.text.setColor(this.enabled ? UI.text : UI.dimText);
  }

  destroy() {
    this.bg.destroy();
    this.text.destroy();
  }
}

// A slider from 0 to 100. Dragging changes the value at once;
// `onRelease` runs when it's let go.
export class Slider {
  constructor(scene, value, onChange, { w = 200, h = 24, onRelease = null } = {}) {
    this.scene = scene;
    this.value = value;
    this.onChange = onChange;
    this.onRelease = onRelease;
    this.w = w;
    this.h = h;
    this.x = 0;
    this.y = 0;
    this.track = scene.add.rectangle(0, 0, w, 6, UI.button).setOrigin(0, 0.5);
    this.fill = scene.add.rectangle(0, 0, 0, 6, UI.active).setOrigin(0, 0.5);
    this.knob = scene.add.circle(0, 0, 9, 0xe6edf3);
    this.zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const set = (pointer) => {
      const v = Math.round(Math.max(0, Math.min(1, (pointer.x - this.x) / this.w)) * 100);
      if (v !== this.value) {
        this.value = v;
        this.layout();
        this.onChange(v);
      }
    };
    this.zone.on('pointerdown', (p) => {
      this.dragging = true;
      set(p);
    });
    scene.input.on('pointermove', (p) => {
      if (this.dragging && p.isDown) set(p);
    });
    scene.input.on('pointerup', () => {
      if (this.dragging) this.onRelease?.(this.value);
      this.dragging = false;
    });
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.layout();
    return this;
  }

  layout() {
    const cy = this.y + this.h / 2;
    this.track.setPosition(this.x, cy).setSize(this.w, 6);
    this.fill.setPosition(this.x, cy).setSize((this.w * this.value) / 100, 6);
    this.knob.setPosition(this.x + (this.w * this.value) / 100, cy);
    this.zone.setPosition(this.x, this.y).setSize(this.w, this.h);
  }

  setDepth(d) {
    for (const o of [this.track, this.fill, this.knob, this.zone]) o.setDepth(d);
    return this;
  }

  setVisible(on) {
    for (const o of [this.track, this.fill, this.knob, this.zone]) o.setVisible(on);
    return this;
  }

  destroy() {
    for (const o of [this.track, this.fill, this.knob, this.zone]) o.destroy();
  }
}

// A one-line text field, using the page's own input so phones get their
// keyboard.
export function textField(scene, value, { maxLength = 24, width = 200, onEnter = null, onEscape = null, placeholder = '' } = {}) {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value;
  el.maxLength = maxLength;
  el.placeholder = placeholder;
  el.autocomplete = 'off';
  el.spellcheck = false;
  Object.assign(el.style, {
    width: `${width}px`,
    font: `15px ${FONT}`,
    color: '#e6edf3',
    background: '#0d1117',
    border: '1px solid #2c3846',
    borderRadius: '4px',
    padding: '6px 8px',
    outline: 'none',
  });
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') onEnter?.(el.value);
    if (e.key === 'Escape') onEscape?.();
  });
  el.addEventListener('keyup', (e) => e.stopPropagation());
  const dom = scene.add.dom(0, 0, el).setOrigin(0, 0);
  dom.input = el;
  return dom;
}

// A panel: a filled box behind a group of pieces.
export function panel(scene, alpha = 0.92) {
  return scene.add.rectangle(0, 0, 10, 10, UI.panel, alpha).setOrigin(0, 0).setStrokeStyle(1, UI.panelEdge);
}

// The interface scale for the screen's size: a little smaller on
// phones, a little larger on big screens.
export function uiScale(width, height) {
  return Math.max(0.7, Math.min(1.25, Math.min(width / 1100, height / 720)));
}
