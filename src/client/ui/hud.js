// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Everything on the game screen besides the map (spec 10, Layout, The
// build menu, The launching view, Turn and round information, Other
// parts, The minimap; spec 03, What players see). The game scene owns
// the HUD and calls update() every frame; the HUD calls back into the
// scene for what the player does.

import { Button, label, panel, UI, pointerAt } from './kit.js';
import { itemShort, itemName, itemTip, UNIT_NAMES, WIND_NAMES } from './names.js';
import { LEVELS } from '../core/controls.js';
import { METER_STEPS, meterShown } from '../core/meter.js';
import { PLAYER_COLORS } from '../render/palette.js';
import { roundIncome } from '../../rules/energy.js';
import { ENERGY_CAP, PX, FOG_CELL } from '../../rules/constants.js';
import { isWorking, UNIT_KINDS, isLauncher } from '../../rules/units.js';
import { canSee } from '../../rules/fog.js';
import { LIFT } from '../core/view.js';
import { FOG_SUB } from '../render/fog-art.js';

const DEPTH = 20;

export class Hud {
  constructor(scene, { watching = false } = {}) {
    this.scene = scene;
    this.watching = watching;
    this.objects = [];
    this.energyShown = null;
    this.incomeShown = null;
    this.flashes = new Map(); // unit id → ms left, for the minimap
    this.banner = { text: '', ms: 0 };
    this.messages = []; // { text, color, ms }
    this.tip = null;

    const add = (o) => {
      this.objects.push(o);
      o.setDepth?.(DEPTH);
      return o;
    };
    this.add = add;
    this.topBar = add(panel(scene, 0.85));
    // Drawn over the panels.
    this.g = add(scene.add.graphics()).setDepth(DEPTH + 1);
    this.menuBtn = add(new Button(scene, 'Menu', { size: 13, onClick: () => scene.toggleMenu() }));
    this.turnText = add(label(scene, '', { size: 14, bold: true }));
    this.outText = add(label(scene, '', { size: 12, color: UI.dimText }));
    this.clockText = add(label(scene, '', { size: 12, color: UI.dimText }));
    this.incomeText = add(label(scene, '', { size: 13 }));
    this.bannerText = add(label(scene, '', { size: 22, bold: true, align: 'center' }).setOrigin(0.5, 0.5));
    this.tipText = add(label(scene, '', { size: 12, color: UI.text }).setOrigin(0, 1));
    this.windText = add(label(scene, '', { size: 12, color: UI.dimText }));
    this.chatText = add(label(scene, '', { size: 13, wrap: 360 }).setOrigin(0, 1));
    this.messageText = add(label(scene, '', { size: 14, color: UI.warn, align: 'center' }).setOrigin(0.5, 0));

    // The minimap.
    this.mini = { x: 0, y: 0, size: 160 };
    this.miniTerrain = [];
    for (let k = 0; k < 4; k++) add(this.miniTerrain[k] = scene.add.image(0, 0, 'minimap-terrain').setOrigin(0, 0));
    this.miniFog = [];
    if (scene.textures.exists('fog') && scene.session.state.fog) {
      for (let k = 0; k < 4; k++) {
        const img = scene.add.image(0, 0, 'fog').setOrigin(0, 0);
        const n = scene.session.state.fog.cells * FOG_SUB;
        img.setCrop(FOG_SUB, FOG_SUB, n, n);
        add(this.miniFog[k] = img);
      }
    }
    this.miniG = add(scene.add.graphics()).setDepth(DEPTH + 1);
    this.miniZone = add(scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive());
    this.miniZone.on('pointerdown', (p) => scene.minimapPress(this.miniPoint(p), p));
    this.miniZone.on('pointermove', (p) => {
      if (p.isDown) scene.minimapDrag(this.miniPoint(p));
    });

    this.chase = add(new Button(scene, 'Chase Cam', { size: 12, onClick: () => scene.toggleCam('chaseCam'), tip: 'Follow your side\'s shots' }));
    this.watch = add(new Button(scene, 'Watch Cam', { size: 12, onClick: () => scene.toggleCam('watchCam'), tip: 'Follow other players\' shots' }));

    if (watching) {
      this.playBtn = add(new Button(scene, 'Pause', { size: 13, onClick: () => scene.togglePlay() }));
      this.followBtn = add(new Button(scene, '', { size: 13, onClick: () => scene.followNext() }));
      return;
    }

    this.skip = add(new Button(scene, 'Skip', { size: 13, onClick: () => scene.skip(), tip: 'Pass: you\'re out for the rest of the round' }));
    this.buildBox = add(panel(scene, 0.88));
    this.levelBtns = LEVELS.map((level) => add(new Button(scene, `${level}`, { size: 14, onClick: () => scene.openLevel(level), tip: `Level ${level}: costs ${level}` })));
    this.itemBtns = [];
    for (let k = 0; k < 6; k++) {
      const b = add(new Button(scene, '', { size: 12, onClick: () => scene.pick(b.item) }));
      this.itemBtns.push(b);
    }
    this.noItems = add(label(scene, '', { size: 12, color: UI.dimText }));
    this.itemTitle = add(label(scene, '', { size: 14, bold: true }));
    this.left = add(new Button(scene, '⟲', { size: 18, onDown: () => scene.turnStart(-1), onUp: () => scene.turnStop(), tip: 'Turn the aim counterclockwise' }));
    this.right = add(new Button(scene, '⟳', { size: 18, onDown: () => scene.turnStart(1), onUp: () => scene.turnStop(), tip: 'Turn the aim clockwise' }));
    this.launch = add(new Button(scene, 'Launch', {
      size: 15,
      onDown: () => scene.launchDown(),
      onUp: () => scene.launchUp(),
      tip: 'Hold to fill the meter; let go to fire',
    }));
    this.cancel = add(new Button(scene, 'Cancel', { size: 12, onClick: () => scene.cancelItem() }));
    this.override = add(new Button(scene, 'Override', { size: 12, onClick: () => scene.toggleOverride(), tip: 'Launch a building even though the conduit marker shows' }));
    this.energyText = add(label(scene, '', { size: 14, bold: true }));
    this.prev = add(new Button(scene, '◀', { size: 13, onClick: () => scene.stepLauncher(-1), tip: 'Previous launcher' }));
    this.next = add(new Button(scene, '▶', { size: 13, onClick: () => scene.stepLauncher(1), tip: 'Next launcher' }));
    this.center = add(new Button(scene, '◎', { size: 14, onClick: () => scene.centerSelected(), tip: 'Center on the selected launcher' }));
    this.launcherText = add(label(scene, '', { size: 12 }));
    scene.events.on('tip', (text) => {
      this.tip = text;
    });
  }

  miniPoint(p) {
    const { x, y, size } = this.mini;
    const map = this.scene.world.size;
    const at = pointerAt(p);
    return { x: ((at.x - x) / size) * map, y: ((at.y - y) / size) * map };
  }

  // A brief message, such as a refused launch.
  message(text, ms = 2500) {
    this.messages.push({ text, ms });
    if (this.messages.length > 3) this.messages.shift();
  }

  showBanner(text, ms = 1800) {
    this.banner = { text, ms };
  }

  flashUnit(id) {
    this.flashes.set(id, 3000);
  }

  layout() {
    const { width, height } = this.scene.view;
    const narrow = width < 760;
    this.narrow = narrow;
    const barH = narrow ? 64 : 40;
    this.barH = barH;
    this.topBar.setPosition(0, 0).setSize(width, barH);
    this.menuBtn.setSize(56, 28).setPosition(6, 6);
    this.turnText.setPosition(70, 11);
    // The order of play, then the clock, the income and Skip, on the right.
    this.orderX = narrow ? 8 : Math.min(width * 0.36, 380);
    this.orderY = narrow ? 50 : 20;
    if (narrow) {
      // Two rows: the menu, whose turn and the income; then the order of
      // play, the clock and Skip.
      this.incomeText.setOrigin(1, 0).setPosition(width - 8, 11);
      this.clockBox = { x: this.orderX + 4 * 26 + 8, y: 43, w: Math.max(60, width - this.orderX - 4 * 26 - 90), h: 14 };
      this.clockText.setPosition(this.clockBox.x, 42);
      this.outText.setPosition(8, barH + 4);
      this.skip?.setSize(60, 28).setPosition(width - 66, 34);
    } else {
      this.incomeText.setOrigin(0, 0).setPosition(width - 220, 11);
      this.clockBox = { x: width - 330, y: 12, w: 100, h: 14 };
      this.clockText.setPosition(this.clockBox.x, this.clockBox.y + 15);
      this.outText.setPosition(this.orderX + 4 * 26 + 8, this.orderY - 8);
      this.skip?.setSize(60, 28).setPosition(width - 66, 6);
    }

    const miniSize = narrow ? 112 : 160;
    this.mini = { x: width - miniSize - 8, y: narrow ? barH + 8 : height - miniSize - 8, size: miniSize };
    this.miniZone.setPosition(this.mini.x, this.mini.y).setSize(miniSize, miniSize);
    const tex = this.scene.textures.get('minimap-terrain').getSourceImage();
    for (const img of this.miniTerrain) img.setScale(miniSize / tex.width);
    const fog = this.scene.session.state.fog;
    if (fog) for (const img of this.miniFog) img.setScale(miniSize / (fog.cells * FOG_SUB));
    this.chase.setSize(78, 26).setPosition(this.mini.x - 84, this.mini.y + (narrow ? 0 : miniSize - 58));
    this.watch.setSize(78, 26).setPosition(this.mini.x - 84, this.mini.y + (narrow ? 30 : miniSize - 28));
    this.windText.setPosition(this.mini.x, this.mini.y + miniSize + 4);
    if (!narrow) this.windText.setPosition(this.mini.x, this.mini.y - 18);
    // On a phone the minimap sits at the top right: the banner goes below it.
    const bannerY = narrow ? this.mini.y + miniSize + 50 : barH + 60;
    this.bannerText.setPosition(width / 2, bannerY);
    this.messageText.setPosition(width / 2, bannerY + 32);
    this.messageText.setWordWrapWidth(Math.min(520, width - 24));

    if (this.watching) {
      // A replay has no shot clock. On a phone, Pause and whom it follows
      // go on the second row, beside the order of play; otherwise at the
      // top right, the income to their left.
      const rowY = narrow ? 34 : 6;
      const followW = Math.min(170, width - 76 - 6 - (this.orderX + 4 * 26 + 8) - 6);
      this.playBtn.setSize(70, 28).setPosition(width - 76, rowY);
      this.followBtn.setSize(followW, 28).setPosition(width - 82 - followW, rowY);
      if (!narrow) this.incomeText.setOrigin(1, 0).setPosition(width - 82 - followW - 12, 11);
      this.chatText.setPosition(10, height - 10);
      return;
    }

    // The build menu, bottom left; on a phone, across the bottom.
    const bw = narrow ? width - 16 : 330;
    const bh = 128;
    const bx = 8;
    const by = height - bh - 8;
    this.buildRect = { x: bx, y: by, w: bw, h: bh };
    this.buildBox.setPosition(bx, by).setSize(bw, bh);
    const lw = 34;
    this.levelBtns.forEach((b, k) => b.setSize(lw, 28).setPosition(bx + 6, by + 6 + k * 32));
    const iw = (bw - lw - 24) / 3;
    this.itemBtns.forEach((b, k) => b.setSize(iw - 4, 40).setPosition(bx + lw + 14 + (k % 3) * iw, by + 10 + Math.floor(k / 3) * 46));
    this.noItems.setPosition(bx + lw + 16, by + 14);
    this.itemTitle.setPosition(bx + lw + 16, by + 8);
    // The meter above Launch, so a finger holding Launch doesn't hide it.
    const ax = bx + lw + 14;
    this.meterBox = { x: ax + 52, y: by + 30, w: bw - lw - 24 - 104, h: 10 };
    this.left.setSize(46, 46).setPosition(ax, by + 46);
    this.launch.setSize(bw - lw - 24 - 104, 46).setPosition(ax + 52, by + 46);
    this.right.setSize(46, 46).setPosition(bx + bw - 52, by + 46);
    this.cancel.setSize(70, 24).setPosition(bx + bw - 76, by + 100);
    this.override.setSize(76, 24).setPosition(ax, by + 100);

    // Energy and the launcher selection, above the build menu.
    const ry = by - 34;
    this.energyBox = { x: bx, y: ry - 6, w: 120, h: 8 };
    this.energyText.setPosition(bx, ry + 6);
    this.prev.setSize(30, 26).setPosition(bx + 130, ry + 2);
    this.launcherText.setPosition(bx + 166, ry + 8);
    this.next.setSize(30, 26).setPosition(bx + 250, ry + 2);
    this.center.setSize(30, 26).setPosition(bx + 284, ry + 2);
    this.chatText.setPosition(10, ry - 14);
    this.chatText.setWordWrapWidth(Math.min(380, width - 40));
  }

  // Every frame.
  update(ms) {
    const scene = this.scene;
    const session = scene.session;
    const s = session.state;
    const game = session.game;
    const setup = session.setup;
    const viewer = scene.viewer;
    const controls = scene.controls;
    const g = this.g;
    g.clear();

    // Whose turn it is.
    let turn = '';
    if (s.phase === 'over') turn = 'The game is over';
    else if (s.phase === 'rovers') turn = 'Rovers are driving';
    else if (s.turn) {
      const p = s.turn.player;
      if (this.watching) turn = `${setup.players[p].name}'s turn`;
      else if (p === viewer) turn = `Your turn, ${setup.players[p].name}`;
      else turn = `Waiting for ${setup.players[p].name}`;
    }
    this.turnText.setText(turn);

    // The order of play: a marker per player in their color, starting
    // with this round's first player (spec 03, The order of play).
    const n = s.seats.length;
    const rowX = this.orderX;
    const rowY = this.orderY;
    for (let k = 0; k < n; k++) {
      const player = s.seats[(s.starterSeat + k) % n];
      const p = s.players[player];
      const cx = rowX + k * 26 + 10;
      const color = PLAYER_COLORS[setup.players[player].color];
      const current = s.phase === 'turn' && s.turn?.player === player;
      g.fillStyle(color, 1);
      g.fillCircle(cx, rowY, 8);
      if (current) {
        g.lineStyle(2, 0xffffff, 1);
        g.strokeCircle(cx, rowY, 11);
      }
      if (p.mark === 'out') {
        g.lineStyle(2.5, 0x000000, 1);
        g.lineBetween(cx - 5, rowY - 5, cx + 5, rowY + 5);
        g.lineBetween(cx + 5, rowY - 5, cx - 5, rowY + 5);
      } else if (p.mark === 'left') {
        g.lineStyle(2.5, 0x000000, 1);
        g.lineBetween(cx - 6, rowY + 6, cx + 6, rowY - 6);
      }
    }
    const out = setup.players.map((p, i) => [p, s.players[i]]).filter(([, st]) => st.mark);
    const notes = out.map(([p, st]) => `${p.name} ${st.mark === 'out' ? 'is out' : 'has left'}`);
    // Online, a player who has gone silent (spec 12, Losing touch).
    for (const [player, state] of session.presence ?? []) {
      if (state === 'notResponding') notes.push(`${setup.players[player].name} isn't responding`);
    }
    this.outText.setText(notes.join(' · '));

    // The shot clock: how much of the turn's time has gone.
    const clock = session.clock();
    const box = this.clockBox;
    if (this.watching) {
      this.clockText.setText('');
    } else if (clock.limit !== null && s.phase === 'turn') {
      const share = Math.min(1, clock.gone / clock.limit);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(box.x, box.y, box.w, box.h);
      g.fillStyle(share >= 0.75 ? 0xe8483b : 0x5fa8e8, 1);
      g.fillRect(box.x, box.y, box.w * share, box.h);
      g.lineStyle(1, 0x2c3846, 1);
      g.strokeRect(box.x, box.y, box.w, box.h);
      this.clockText.setText('');
    } else {
      this.clockText.setText(s.phase === 'turn' && clock.limit === null ? 'No time limit' : '');
    }

    // The next round's energy, moving smoothly toward its value.
    const income = Math.min(ENERGY_CAP, roundIncome(s, viewer)) / 10;
    this.incomeShown = approach(this.incomeShown, income, ms);
    this.incomeText.setText(`Next round: +${Math.round(this.incomeShown)}`);

    // The wind.
    const wind = setup.wind;
    this.windText.setText(WIND_NAMES[wind.level]);
    if (wind.level > 0) {
      const wx = this.windText.x + this.windText.width + 16;
      const wy = this.windText.y + 8;
      const a = (wind.dir * Math.PI) / 180;
      const len = 6 + wind.level * 3;
      g.lineStyle(2, 0xe6edf3, 1);
      g.lineBetween(wx - Math.cos(a) * len, wy - Math.sin(a) * len, wx + Math.cos(a) * len, wy + Math.sin(a) * len);
      g.fillStyle(0xe6edf3, 1);
      g.fillTriangle(
        wx + Math.cos(a) * (len + 5), wy + Math.sin(a) * (len + 5),
        wx + Math.cos(a + 2.5) * 6 + Math.cos(a) * len, wy + Math.sin(a + 2.5) * 6 + Math.sin(a) * len,
        wx + Math.cos(a - 2.5) * 6 + Math.cos(a) * len, wy + Math.sin(a - 2.5) * 6 + Math.sin(a) * len,
      );
    }

    this.chase.setActive(scene.prefs.chaseCam);
    this.watch.setActive(scene.prefs.watchCam);
    this.drawMinimap(ms);

    // Banner and messages.
    this.banner.ms -= ms;
    this.bannerText.setText(this.banner.ms > 0 ? this.banner.text : '');
    this.bannerText.setAlpha(Math.min(1, Math.max(0, this.banner.ms / 400)));
    for (const m of this.messages) m.ms -= ms;
    this.messages = this.messages.filter((m) => m.ms > 0);
    this.messageText.setText(this.messages.map((m) => m.text).join('\n'));
    this.chatText.setText(scene.chatLines().join('\n'));

    if (this.watching) {
      this.playBtn.setText(session.replayPaused ? 'Play' : 'Pause');
      this.followBtn.setText(`Following ${setup.players[viewer].name}`);
      return;
    }

    // Skip: visibly unavailable when it can't be used (spec 03).
    this.skip.setEnabled(session.canAct(viewer) && !controls.launched && !controls.meter.holding);

    // Energy left, as a number and a bar, moving smoothly.
    const energy = s.players[viewer].energy / 10;
    this.energyShown = approach(this.energyShown, energy, ms);
    this.energyText.setText(`Energy ${Math.floor(this.energyShown + 1e-6)}`);
    const eb = this.energyBox;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(eb.x, eb.y, eb.w, eb.h);
    g.fillStyle(0x6cf2ff, 1);
    g.fillRect(eb.x, eb.y, (eb.w * Math.min(35, this.energyShown)) / 35, eb.h);

    // The selected launcher.
    const unit = controls.selectedUnit();
    const kind = unit ? `${UNIT_NAMES[unit.kind]}${isWorking(s, unit) ? '' : ' (disabled)'}` : 'No launcher';
    this.launcherText.setText(kind);
    const many = controls.launchers().length > 1;
    this.prev.setEnabled(many);
    this.next.setEnabled(many);
    this.center.setEnabled(!!unit);

    // The build menu, or the launching view.
    const launching = controls.item !== null;
    const menuOpen = controls.menuOpen || launching;
    this.levelBtns.forEach((b, k) => {
      b.setVisible(true);
      b.setEnabled(controls.levelOpen(LEVELS[k]) && !launching);
      b.setActive(controls.level === LEVELS[k]);
    });
    const items = menuOpen && !launching ? controls.items() : [];
    this.itemBtns.forEach((b, k) => {
      const id = items[k];
      b.item = id ?? null;
      b.setVisible(!!id);
      if (id) {
        b.setText(itemShort(id));
        b.tip = itemTip(id);
        b.setEnabled(true);
      }
    });
    let note = '';
    if (!launching) {
      if (!unit) note = 'You have no launcher.';
      else if (!isWorking(s, unit)) note = 'This launcher is disabled.';
      else if (!controls.menuOpen) note = 'No energy left this round.';
    }
    this.noItems.setText(note);
    for (const b of [this.left, this.right, this.launch, this.cancel]) b.setVisible(launching);
    this.itemTitle.setText(launching ? itemName(controls.item) : '');
    this.itemTitle.setVisible(launching);
    const busy = controls.launched;
    const holding = controls.meter.holding;
    this.left.setEnabled(!busy && !holding);
    this.right.setEnabled(!busy && !holding);
    this.cancel.setEnabled(!busy && !holding);
    this.launch.setEnabled(!busy && (holding || session.canAct(viewer)));
    this.launch.setText(holding ? '' : busy ? 'In flight' : session.canAct(viewer) ? 'Launch' : 'Wait for your turn');
    const warn = launching && !busy && scene.conduitWarning();
    this.override.setVisible(warn);
    this.override.setActive(scene.overrideOn);

    // The meter, in coarse steps; it keeps showing the shot's power
    // until the next pick.
    if (launching) {
      const mb = this.meterBox;
      const lit = controls.meter.shown === null ? 0 : meterShown(controls.meter.shown);
      const seg = mb.w / METER_STEPS;
      for (let k = 0; k < METER_STEPS; k++) {
        g.fillStyle(k < lit ? (k < 7 ? 0x5fdc6a : k < 14 ? 0xf0c419 : 0xe8483b) : 0x000000, k < lit ? 1 : 0.5);
        g.fillRect(mb.x + k * seg + 1, mb.y, seg - 2, mb.h);
      }
      if (holding) {
        // Inside Launch too, so a thumb on it can see it.
        const lb = this.launch;
        const w = (lb.w - 12) * (lit / METER_STEPS);
        g.fillStyle(0xffffff, 0.25);
        g.fillRect(lb.x + 6, lb.y + 6, w, lb.h - 12);
      }
    }

    // A tip for whatever the pointer is over, such as an item's name.
    this.tipText.setText(this.tip ?? '');
    const r = this.buildRect;
    this.tipText.setPosition(r.x + 4, r.y - 40);
  }

  drawMinimap(ms) {
    const scene = this.scene;
    const { x, y, size } = this.mini;
    const s = scene.session.state;
    const world = scene.world;
    const mapSize = world.size;
    const k = size / mapSize;
    const g = this.miniG;
    g.clear();
    // The terrain fills the minimap once; the extra images are unused.
    this.miniTerrain.forEach((img, i) => img.setPosition(x, y).setVisible(i === 0));
    this.miniFog.forEach((img, i) => {
      img.setPosition(x - k * (FOG_CELL / PX), y - k * (FOG_CELL / PX)).setVisible(i === 0);
      img.setAlpha(this.watching ? 0.45 : 1);
    });
    g.lineStyle(1, 0x2c3846, 1);
    g.strokeRect(x - 1, y - 1, size + 2, size + 2);
    // Outside the main view, the minimap is dimmed a little: the columns
    // left and right of it, then the rows above and below it.
    {
      const v = this.miniView();
      const fill = (x0, y0, w, h) => {
        const ax = ((x0 % size) + size) % size;
        const ay = ((y0 % size) + size) % size;
        for (const [px, pw] of [[ax, Math.min(w, size - ax)], [0, ax + w - size]]) {
          for (const [py, ph] of [[ay, Math.min(h, size - ay)], [0, ay + h - size]]) {
            if (pw > 0 && ph > 0) g.fillRect(x + px, y + py, pw, ph);
          }
        }
      };
      g.fillStyle(0x000000, 0.35);
      if (v.w < size) fill(v.x + v.w, 0, size - v.w, size);
      if (v.h < size) fill(v.x, v.y + v.h, Math.min(v.w, size), size - v.h);
    }
    const viewer = scene.viewer;
    const side = scene.session.game.sides[viewer];
    // Units the player can see, in their owners' colors.
    for (const u of s.units) {
      const mine = scene.session.game.sides[u.owner] === side;
      const my = (u.y - Math.max(0, u.base) * LIFT) / PX;
      if (!mine && !this.watching && !canSee(scene.session.game, viewer, u.x, u.y - Math.max(0, u.base) * LIFT)) continue;
      const color = PLAYER_COLORS[scene.session.setup.players[u.owner].color];
      const r = isLauncher(u) ? 2.2 : UNIT_KINDS[u.kind].radius / PX > 15 ? 1.8 : 1.3;
      g.fillStyle(color, 1);
      g.fillCircle(x + wrapK(u.x / PX, mapSize) * k, y + wrapK(my, mapSize) * k, r);
    }
    // Shots in flight, each fragment on its own.
    for (const shot of s.shots) {
      const mine = scene.session.game.sides[shot.owner] === side;
      const sy = shot.y - Math.max(0, shot.z) * LIFT;
      if (!mine && !this.watching && !canSee(scene.session.game, viewer, shot.x, sy)) continue;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x + wrapK(shot.x / PX, mapSize) * k, y + wrapK(sy / PX, mapSize) * k, 1.4);
    }
    // Hits on the player's own units flash for a few seconds.
    for (const [id, left] of this.flashes) {
      const u = s.units.find((v) => v.id === id);
      const nleft = left - ms;
      if (!u || nleft <= 0) {
        this.flashes.delete(id);
        continue;
      }
      this.flashes.set(id, nleft);
      if (Math.floor(nleft / 200) % 2 === 0) {
        g.lineStyle(1.5, 0xffffff, 1);
        g.strokeCircle(x + wrapK(u.x / PX, mapSize) * k, y + wrapK((u.y - u.base * LIFT) / PX, mapSize) * k, 5);
      }
    }
    // The selected launcher.
    const sel = scene.controls?.selectedUnit();
    if (sel) {
      g.lineStyle(1.5, 0xffffff, 1);
      g.strokeRect(x + wrapK(sel.x / PX, mapSize) * k - 3.5, y + wrapK((sel.y - sel.base * LIFT) / PX, mapSize) * k - 3.5, 7, 7);
    }
    // The main view's area: its four edges, wrapping across the
    // minimap's sides like the map, so it reads as one rectangle.
    const v = this.miniView();
    const wrapX = (x0, w, fn) => {
      const a = ((x0 % size) + size) % size;
      fn(a, Math.min(w, size - a));
      if (a + w > size) fn(0, a + w - size);
    };
    g.lineStyle(1, 0xffffff, 0.8);
    const line = (x0, y0, x1, y1) => g.lineBetween(x + x0, y + y0, x + x1, y + y1);
    if (v.w < size) {
      for (const ex of [v.x, v.x + v.w]) {
        const lx = (((ex % size) + size) % size) + 0.5;
        wrapX(v.y, Math.min(v.h, size), (y0, h) => line(lx, y0, lx, y0 + h));
      }
    }
    if (v.h < size) {
      for (const ey of [v.y, v.y + v.h]) {
        const ly = (((ey % size) + size) % size) + 0.5;
        wrapX(v.x, Math.min(v.w, size), (x0, w) => line(x0, ly, x0 + w, ly));
      }
    }
  }

  // The main view's area on the minimap, in minimap pixels from its
  // corner: where it starts (wrapped) and how big it is.
  miniView() {
    const { size } = this.mini;
    const cam = this.scene.cam;
    const k = size / this.scene.world.size;
    return {
      x: wrapK(cam.x - cam.width / 2, this.scene.world.size) * k,
      y: wrapK(cam.y - cam.height / 2, this.scene.world.size) * k,
      w: cam.width * k,
      h: cam.height * k,
    };
  }

  // Whether a screen point is over the interface, not the map.
  over(px, py) {
    if (py < this.barH) return true;
    const m = this.mini;
    if (px >= m.x && px <= m.x + m.size && py >= m.y && py <= m.y + m.size) return true;
    const b = this.buildRect;
    if (b && px >= b.x && px <= b.x + b.w && py >= b.y - 40 && py <= b.y + b.h) return true;
    return false;
  }
}

const wrapK = (v, size) => ((v % size) + size) % size;

// Moves a shown number smoothly toward its value.
function approach(shown, target, ms) {
  if (shown === null) return target;
  const d = target - shown;
  if (Math.abs(d) < 0.05) return target;
  return shown + d * Math.min(1, ms / 180);
}
