// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game screen (spec 10): the main view, its camera and input, the
// HUD, chat, the game menu and the end of the game. It plays a game on
// this machine through a Session, or watches a replay.

import { BaseScene } from './base.js';
import { Session } from '../core/session.js';
import { NetSession } from '../core/net-session.js';
import { Camera, wrapDelta } from '../core/camera.js';
import { PlayerControls } from '../core/controls.js';
import { AimTurner, moveHeading } from '../core/aim.js';
import { LIFT, screenAt } from '../core/view.js';
import { actionFor } from '../core/keys.js';
import { routeChat, receives, chatLine } from '../core/chat.js';
import { brainsFor } from '../core/computers.js';
import { WorldView } from '../render/world.js';
import { GameSound } from '../audio/game-sound.js';
import { Hud } from '../ui/hud.js';
import { GameMenu } from '../ui/game-menu.js';
import { textField, label, Button } from '../ui/kit.js';
import { PX } from '../../rules/constants.js';
import { ITEMS, BUILDING, itemCost } from '../../rules/items.js';
import { UNIT_KINDS, findUnit, isWorking } from '../../rules/units.js';
import { conduitWarning } from '../../rules/conduits.js';
import { canSee } from '../../rules/fog.js';

const DRAG_START = 8; // px the pointer moves before a drag starts
const ARROW_SPEED = 700; // px a second, scrolling with the arrow keys
const EDGE = 10; // px from the screen's edge, for Edge Scrolling
const SELECT_REACH = 22; // px from a launcher, to click it

export class GameScene extends BaseScene {
  constructor() {
    super('game');
  }

  // data: { setup } for a new game, { replay } to watch one, or
  // { online: { net, setup, you, moves } } for an online game.
  create(data) {
    this.watching = !!data.replay;
    this.online = data.online ?? null;
    const setup = data.replay ? data.replay.setup : this.online ? this.online.setup : data.setup;
    if (this.online) this.session = new NetSession(setup, { net: this.online.net, me: this.online.you, moves: this.online.moves });
    else this.session = new Session(setup, this.watching ? { replay: data.replay } : { computers: brainsFor(setup) });
    const session = this.session;
    this.world = new WorldView(this, session, { watching: this.watching });
    this.world.effects.showLaunch = (player) => this.watching || this.views.has(player);
    this.cam = new Camera(this.world.size);
    this.cam.setView(this.scale.width, this.scale.height);
    this.turner = new AimTurner();
    this.overrideOn = false;
    this.chat = [];
    this.menu = null;
    // The scene object is reused from game to game: start it afresh.
    this.lastTurn = undefined;
    this.lastAttacked = null;
    this.chaseShots = null;
    this.roverTrack = null;
    this.trackMode = null;
    this.overrideKey = false;
    this.launchOverride = false;
    this.pointer = null;
    // The Pulse's flash over the view.
    this.flashRect = this.add.rectangle(0, 0, 10, 10, 0xbfe8ff, 0).setOrigin(0, 0).setDepth(19);

    // Each human's controls and camera (spec 10, Hot seat).
    this.views = new Map();
    setup.players.forEach((p, i) => {
      const mine = this.online ? i === this.online.you : !p.computer || this.watching;
      if (mine) this.views.set(i, new PlayerControls(session.game, i));
    });
    this.viewer = session.viewer;
    this.jumpToView();

    this.hud = new Hud(this, { watching: this.watching });
    this.menu = new GameMenu(this);
    this.chatInput = null;

    this.sound = new GameSound(this);
    session.on((e) => this.onEvent(e));
    if (this.online) {
      // Taking back the seat after the connection dropped: the game
      // starts again here, caught up.
      const net = this.online.net;
      const off = net.on('start', (m) => this.scene.restart({ online: { net, setup: m.setup, you: m.you, moves: m.moves } }));
      const lost = net.on('disconnected', () => this.hud.message('Lost touch with the server. Trying again…', 4000));
      this.events.once('shutdown', () => {
        off();
        lost();
        session.close();
      });
    }
    this.setupInput();
    this.autoLayout();
    this.hud.showBanner(this.watching ? 'Replay' : this.turnBanner(session.state.turn.player));
    this.ended = false;
    this.desyncShown = false;
  }

  // Only the menu screens' buttons make sounds (spec 11).
  get menuSounds() {
    return false;
  }

  get controls() {
    return this.watching ? null : this.views.get(this.viewer);
  }

  layout() {
    const { width, height } = this.scale;
    this.cam.setView(width, height);
    this.hud.layout();
    this.menu.layout();
    if (this.chatInput) this.chatInput.setPosition(10, height - (this.hud.buildRect ? this.hud.buildRect.h + 90 : 60));
  }

  // The view of the player whose turn it is, where they last had it.
  jumpToView() {
    const c = this.views.get(this.viewer);
    if (!c) return;
    if (!c.cameraSet) {
      const u = c.selectedUnit();
      if (u) c.camera = { x: u.x / PX, y: (u.y - u.base * LIFT) / PX };
      c.cameraSet = true;
    }
    if (c.camera) this.cam.jumpTo(c.camera.x, c.camera.y);
    this.world?.setViewer(this.viewer);
  }

  saveView() {
    const c = this.views.get(this.viewer);
    if (c) c.camera = { x: this.cam.x, y: this.cam.y };
  }

  turnBanner(player) {
    const p = this.session.setup.players[player];
    if (this.watching) return `${p.name}'s turn`;
    return player === this.viewer ? `Your turn, ${p.name}` : `Waiting for ${p.name}`;
  }

  // Events --------------------------------------------------------------

  onEvent(e) {
    const s = this.session.state;
    this.sound.onEvent(e);
    if (e.client) {
      switch (e.type) {
        case 'viewer':
          this.saveView();
          this.viewer = e.player;
          this.cam.stopFollow();
          this.jumpToView();
          break;
        case 'timeUp':
          this.hud.message('Time is up');
          this.stopWatchCam();
          break;
        case 'refused':
          this.hud.message(capitalize(e.reason));
          if (this.controls) this.controls.launched = false;
          break;
        case 'chat':
          this.chat.push({ ...e.message, at: this.time.now });
          break;
        case 'presence': {
          const name = this.session.setup.players[e.player].name;
          const line = { notResponding: `${name} isn't responding.`, back: `${name} is back.`, gone: `${name} was disconnected.` }[e.state];
          this.chat.push({ system: line, at: this.time.now });
          break;
        }
        case 'desync':
          if (!this.desyncShown) this.hud.message('This game has gone out of step with the other players\' games.', 6000);
          this.desyncShown = true;
          break;
        default:
          break;
      }
      return;
    }
    this.world.onEvent(e);
    const viewerSide = this.session.game.sides[this.viewer];
    switch (e.type) {
      case 'turnStart':
        // The menu resets when a player's own move is over.
        if (this.lastTurn !== undefined) this.views.get(this.lastTurn)?.resetMenu();
        this.lastTurn = e.player;
        this.cam.snapBack(this.prefs.snapBack);
        this.hud.showBanner(this.turnBanner(e.player));
        if (e.noLauncher && e.player === this.viewer) this.hud.message('You have no working launcher: all you can do is pass.', 4000);
        this.chaseShots = null;
        break;
      case 'pass':
      case 'timeout':
        this.views.get(e.player)?.resetMenu();
        break;
      case 'roundOver':
        for (const c of this.views.values()) c.resetMenu();
        this.hud.showBanner(`End of round ${e.round}`, 2200);
        break;
      case 'launch':
        this.startTracking(e.player);
        break;
      case 'roverDrives':
        this.trackRover(e.unit);
        break;
      case 'built': {
        const unit = findUnit(s, e.unit);
        const c = this.views.get(e.owner);
        if (unit && c) c.onBuilt(unit, e.heading, this.prefs.selectNew);
        break;
      }
      case 'destroy':
        for (const c of this.views.values()) c.onDestroyed(e.unit);
        break;
      case 'disabled':
        for (const c of this.views.values()) if (c.selected === e.unit) c.resetMenu();
        if (this.session.game.sides[e.owner] === viewerSide) this.noteAttacked(e.unit);
        break;
      case 'damage':
      case 'repair':
      case 'salvage': {
        const u = findUnit(s, e.unit);
        const owner = u?.owner ?? e.owner;
        if (owner !== undefined && this.session.game.sides[owner] === viewerSide) {
          this.hud.flashUnit(e.unit);
          if (e.type !== 'repair') this.noteAttacked(e.unit);
        }
        break;
      }
      case 'infected':
        if (this.session.game.sides[e.unitOwner ?? -1] === viewerSide) this.noteAttacked(e.unit);
        break;
      case 'knockedOut':
        this.hud.message(`${this.session.setup.players[e.player].name} is out of the game`, 3500);
        break;
      case 'gameOver':
        this.time.delayedCall(1500, () => this.endGame(e.winner));
        break;
      default:
        break;
    }
  }

  noteAttacked(id) {
    this.lastAttacked = id;
  }

  // Tracking cameras (spec 10, Tracking shots) ---------------------------

  startTracking(player) {
    const game = this.session.game;
    const mine = game.sides[player] === game.sides[this.viewer];
    const ids = new Set(this.session.state.shots.filter((sh) => sh.owner === player).map((sh) => sh.id));
    this.chaseShots = { player, ids, last: null, ended: false };
    if (mine && player === this.viewer) this.stopWatchCam();
    const want = mine ? this.prefs.chaseCam : this.prefs.watchCam;
    if (!want) return;
    this.trackMode = mine ? 'chase' : 'watch';
    this.cam.follow(() => this.trackedShot(!mine), { steady: this.prefs.steadyCamera });
  }

  // The lead shot of the launch being followed, where it's drawn; null
  // while hidden from a Watch Cam.
  trackedShot(needSight) {
    const t = this.chaseShots;
    if (!t) return null;
    const shot = this.session.state.shots.find((sh) => t.ids.has(sh.id));
    if (!shot) return null;
    const y = shot.y - Math.max(0, shot.z) * LIFT;
    if (needSight && !canSee(this.session.game, this.viewer, shot.x, y)) return null;
    return { x: shot.x / PX, y: y / PX };
  }

  trackRover(id) {
    const game = this.session.game;
    const rover = findUnit(this.session.state, id);
    if (!rover) return;
    const mine = game.sides[rover.owner] === game.sides[this.viewer];
    const want = mine ? this.prefs.chaseCam : this.prefs.watchCam;
    this.roverTrack = { id };
    if (!want) return;
    this.trackMode = mine ? 'chase' : 'watch';
    // Steady Camera applies to shots, not Rovers.
    this.cam.follow(() => {
      const u = findUnit(this.session.state, id);
      if (!u) return null;
      const y = u.y - Math.max(0, u.base) * LIFT;
      if (!mine && !canSee(game, this.viewer, u.x, y)) return null;
      return { x: u.x / PX, y: y / PX };
    });
  }

  // Ends a follow once the first shot of the launch has ended, or the
  // Rover has stopped.
  updateTracking() {
    const s = this.session.state;
    const t = this.chaseShots;
    if (t && !t.ended) {
      // Fragments of a split join the launch.
      for (const sh of s.shots) if (sh.owner === t.player && !t.ids.has(sh.id) && s.phase === 'flight') t.ids.add(sh.id);
      const lead = s.shots.find((sh) => t.ids.has(sh.id));
      if (lead) t.last = { x: lead.x / PX, y: (lead.y - Math.max(0, lead.z) * LIFT) / PX };
      const gone = [...t.ids].some((id) => !s.shots.some((sh) => sh.id === id));
      if (gone) {
        t.ended = true;
        if (this.cam.tracking) this.cam.endFollow(this.trackMode === 'watch' ? null : t.last);
      }
    }
    const r = this.roverTrack;
    if (r && (!s.drive || s.drive.rover !== r.id || s.drive.done)) {
      this.roverTrack = null;
      if (this.cam.tracking) this.cam.endFollow();
    }
  }

  stopWatchCam() {
    if (this.trackMode === 'watch' && this.cam.tracking) this.cam.stopFollow();
  }

  toggleCam(key) {
    this.prefs[key] = !this.prefs[key];
    this.savePrefs();
  }

  // Input ----------------------------------------------------------------

  setupInput() {
    const input = this.input;
    this.drag = null;
    this.arrows = { left: false, right: false, up: false, down: false };
    input.on('pointerdown', (p, over) => {
      if (this.menu.open || over.length > 0) return;
      this.drag = { x: p.x, y: p.y, moved: false, right: p.rightButtonDown() };
    });
    input.on('pointermove', (p) => {
      this.pointer = { x: p.x, y: p.y };
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < DRAG_START && !d.right) return;
      d.moved = true;
      // Grabbing the map: it moves with the pointer.
      this.cam.scrollBy(-(p.x - p.prevPosition.x), -(p.y - p.prevPosition.y));
    });
    input.on('pointerup', (p) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved || d.right || this.menu.open) return;
      this.clickMap(p.x, p.y);
    });
    input.keyboard.on('keydown', (e) => this.keyDown(e));
    input.keyboard.on('keyup', (e) => this.keyUp(e));
    input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
  }

  // A click on the map selects one of the player's launchers, any time,
  // even a disabled one.
  clickMap(sx, sy) {
    const c = this.controls;
    if (!c) return;
    let best = null;
    let bestD = SELECT_REACH;
    for (const u of c.launchers()) {
      const top = (UNIT_KINDS[u.kind].height * LIFT) / PX;
      const [ux, uy] = screenAt(this.cam, u.x / PX, (u.y - u.base * LIFT) / PX);
      const d = Math.min(Math.hypot(ux - sx, uy - sy), Math.hypot(ux - sx, uy - top - sy));
      if (d < bestD) {
        best = u;
        bestD = d;
      }
    }
    if (best) this.selectLauncher(best.id, false);
  }

  selectLauncher(id, center) {
    const c = this.controls;
    if (!c || !c.select(id)) return;
    if (center) this.centerSelected();
  }

  keyDown(e) {
    if (this.chatInput) return;
    if (e.key === 'Escape') {
      this.toggleMenu();
      return;
    }
    if (this.menu.open) return;
    const arrows = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (arrows[e.key]) {
      this.arrows[arrows[e.key]] = true;
      this.cam.stopFollow();
      this.cam.glide = null;
      this.cam.snap = null;
      return;
    }
    if (e.repeat) return;
    const action = actionFor(this.prefs.keys, e.key);
    if (!action) return;
    const c = this.controls;
    switch (action) {
      case 'damageBars':
      case 'rangeCircles':
        this.prefs[action] = !this.prefs[action];
        this.savePrefs();
        break;
      case 'center':
        this.centerSelected();
        break;
      case 'next':
        this.stepLauncher(1);
        break;
      case 'previous':
        this.stepLauncher(-1);
        break;
      case 'closestOutpost':
        this.closestOutpost();
        break;
      case 'lastAttacked': {
        const u = this.lastAttacked && findUnit(this.session.state, this.lastAttacked);
        if (u) this.cam.centerOn(u.x / PX, (u.y - u.base * LIFT) / PX);
        break;
      }
      case 'chat':
        this.openChat();
        break;
      case 'turnLeft':
        this.turnStart(-1);
        break;
      case 'turnRight':
        this.turnStart(1);
        break;
      case 'launch':
        if (c?.item) this.launchDown();
        break;
      case 'override':
        this.overrideKey = true;
        break;
      default:
        break;
    }
  }

  keyUp(e) {
    const arrows = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (arrows[e.key]) this.arrows[arrows[e.key]] = false;
    const action = actionFor(this.prefs.keys, e.key);
    if (action === 'turnLeft' || action === 'turnRight') this.turnStop();
    if (action === 'launch') this.launchUp();
    if (action === 'override') this.overrideKey = false;
  }

  // HUD actions ------------------------------------------------------------

  toggleMenu() {
    if (this.chatInput) return;
    this.menu.toggle();
  }

  skip() {
    const c = this.controls;
    if (!c || !this.session.canAct(this.viewer) || c.launched || c.meter.holding) return;
    this.session.pass(this.viewer);
  }

  openLevel(level) {
    this.controls?.openLevel(level);
  }

  pick(id) {
    const c = this.controls;
    if (c && id) c.pick(id);
    this.overrideOn = false;
  }

  cancelItem() {
    this.controls?.cancel();
  }

  turnStart(dir) {
    const c = this.controls;
    if (!c || !c.item || c.launched || c.meter.holding) return;
    c.turnAim(this.turner.press(dir));
  }

  turnStop() {
    this.turner.release();
  }

  toggleOverride() {
    this.overrideOn = !this.overrideOn;
  }

  stepLauncher(dir) {
    const c = this.controls;
    if (!c) return;
    c.step(dir);
    this.centerSelected();
  }

  centerSelected() {
    const u = this.controls?.selectedUnit();
    if (u) this.cam.centerOn(u.x / PX, (u.y - u.base * LIFT) / PX);
  }

  closestOutpost() {
    const c = this.controls;
    if (!c) return;
    let best = null;
    let bestD = Infinity;
    for (const u of c.launchers()) {
      if (u.kind !== 'outpost') continue;
      const dx = wrapDelta(this.cam.x, u.x / PX, this.world.size);
      const dy = wrapDelta(this.cam.y, (u.y - u.base * LIFT) / PX, this.world.size);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        best = u;
        bestD = d;
      }
    }
    if (best) this.selectLauncher(best.id, true);
  }

  conduitWarning() {
    const c = this.controls;
    const u = c?.selectedUnit();
    if (!u || !c.item) return false;
    return conduitWarning(this.session.state, u, moveHeading(c.aim()), this.session.game.map.size).length > 0;
  }

  // Launch is held, then released (spec 10, The launching view). Only
  // Launch waits for the player's own turn.
  launchDown() {
    const c = this.controls;
    if (!c || !c.item || c.launched || c.meter.holding) return;
    const s = this.session.state;
    if (!this.session.canAct(this.viewer)) {
      this.hud.message('Wait for your turn to launch');
      return;
    }
    const u = c.selectedUnit();
    if (!u || !isWorking(s, u)) {
      this.hud.message('That launcher is disabled');
      return;
    }
    if (s.players[this.viewer].energy < itemCost(c.item)) {
      this.hud.message('Not enough energy');
      return;
    }
    const building = ITEMS[c.item].category === BUILDING;
    if (building && this.conduitWarning() && !this.overrideOn && !this.overrideKey) {
      this.hud.message('The new conduit would start too close to one of this launcher\'s own. Hold the override key, or use Override, to launch anyway.', 4000);
      return;
    }
    this.launchOverride = !!(this.overrideOn || this.overrideKey);
    c.meter.start();
    this.uiSound('ui.launchPress');
    this.session.pressLaunch(this.viewer);
  }

  // Letting go fires, even off the button.
  launchUp() {
    const c = this.controls;
    if (!c || !c.meter.holding) return;
    this.fire(c.meter.release());
  }

  fire(power) {
    const c = this.controls;
    const move = {
      player: this.viewer,
      launcher: c.selected,
      item: c.item,
      heading: moveHeading(c.aim()),
      power,
      override: this.launchOverride,
    };
    const result = this.session.launch(move);
    if (result.ok) {
      c.launched = true;
      this.overrideOn = false;
    } else {
      this.session.releaseWithoutLaunch(this.viewer);
    }
  }

  minimapPress(p) {
    const c = this.controls;
    const k = this.hud.mini.size / this.world.size;
    // Near one of the player's launchers: select it and center on it.
    if (c) {
      for (const u of c.launchers()) {
        const dx = wrapDelta(p.x, u.x / PX, this.world.size) * k;
        const dy = wrapDelta(p.y, (u.y - u.base * LIFT) / PX, this.world.size) * k;
        if (dx * dx + dy * dy < 36) {
          if (this.cam.tracking) c.select(u.id);
          else this.selectLauncher(u.id, true);
          return;
        }
      }
    }
    // While a tracking camera follows a shot, a click only selects.
    if (this.cam.tracking) return;
    this.cam.centerOn(p.x, p.y);
  }

  minimapDrag(p) {
    if (this.cam.tracking) return;
    const dx = wrapDelta(this.cam.x, p.x, this.world.size);
    const dy = wrapDelta(this.cam.y, p.y, this.world.size);
    this.cam.scrollBy(dx * 0.35, dy * 0.35);
  }

  // Chat (spec 10, Chat) ---------------------------------------------------

  openChat() {
    if (this.chatInput || this.watching) return;
    const { height } = this.scale;
    this.chatInput = textField(this, '', {
      maxLength: 120,
      width: Math.min(380, this.scale.width - 40),
      placeholder: 'Message (/team … or @name …)',
      onEnter: (text) => this.sendChat(text),
      onEscape: () => this.closeChat(),
    });
    this.chatInput.setPosition(10, height - (this.hud.buildRect ? this.hud.buildRect.h + 90 : 60));
    this.time.delayedCall(0, () => this.chatInput?.input.focus());
  }

  closeChat() {
    this.chatInput?.destroy();
    this.chatInput = null;
  }

  sendChat(text) {
    if (text.trim()) {
      const setup = this.session.setup;
      const { to, text: body } = routeChat(text, this.viewer, setup.players, this.session.game.sides);
      if (this.online) this.session.chat(to, body);
      else {
        this.chat.push({ from: this.viewer, to, text: body, at: this.time.now });
        this.sound.onEvent({ client: true, type: 'chat' });
      }
    }
    this.closeChat();
  }

  // The chat lines the viewer gets, newest last; they fade after a while.
  chatLines() {
    const setup = this.session.setup;
    const sides = this.session.game.sides;
    return this.chat
      .filter((m) => this.time.now - m.at < 20000 && (m.system || receives(m, this.viewer, setup.players, sides)))
      .slice(-6)
      .map((m) => m.system ?? chatLine(m, this.viewer, setup.players));
  }

  // Replays ------------------------------------------------------------------

  togglePlay() {
    this.session.replayPaused = !this.session.replayPaused;
  }

  followNext() {
    const n = this.session.setup.players.length;
    this.viewer = (this.viewer + 1) % n;
    this.world.setViewer(this.viewer);
  }

  // The end of the game (spec 10, The end of the game) -------------------

  endGame(winner) {
    if (this.ended) return;
    this.ended = true;
    this.sound.end();
    const setup = this.session.setup;
    const sides = this.session.game.sides;
    const humans = setup.players.map((p, i) => i).filter((i) => !setup.players[i].computer);
    const won = (i) => winner !== null && sides[i] === winner;
    let text;
    if (this.watching) {
      text = winner === null ? 'The game ended with no winner' : `${setup.players[winner].name}'s side won`;
    } else if (humans.every(won)) text = 'Victory';
    else if (!humans.some(won)) text = 'Defeat';
    else text = humans.map((i) => `${setup.players[i].name}: ${won(i) ? 'Victory' : 'Defeat'}`).join('\n');
    const { width, height } = this.scale;
    // Dims the game, and takes its clicks.
    this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0, 0).setDepth(50).setInteractive();
    const t = label(this, text, { size: 40, bold: true, align: 'center' }).setOrigin(0.5).setDepth(51).setPosition(width / 2, height / 2 - 40);
    t.setColor(text === 'Defeat' ? '#e8483b' : '#f0c419');
    new Button(this, 'Continue', {
      size: 16,
      onClick: () => this.scene.start('summary', {
        setup, sides, events: this.session.game.events, replay: this.session.replay(), watched: this.watching,
      }),
    }).setSize(160, 44).setPosition(width / 2 - 80, height / 2 + 30).setDepth(52);
  }

  quit() {
    this.sound.leave();
    if (this.online) {
      this.session.quit();
      this.scene.start('lobby');
      return;
    }
    this.scene.start('menu');
  }

  // Every frame ----------------------------------------------------------------

  update(_time, delta) {
    const ms = Math.min(100, delta);
    const session = this.session;
    session.advance(ms);
    const c = this.controls;
    if (c) {
      c.checkLevel();
      if (this.turner.turning) c.turnAim(this.turner.update(ms));
      const fired = c.meter.update(ms);
      if (fired !== null) this.fire(fired);
    }
    // Arrow keys, and Edge Scrolling.
    let dx = (this.arrows.right ? 1 : 0) - (this.arrows.left ? 1 : 0);
    let dy = (this.arrows.down ? 1 : 0) - (this.arrows.up ? 1 : 0);
    if (this.prefs.edgeScroll && this.pointer && !this.menu.open) {
      const { width, height } = this.scale;
      if (this.pointer.x < EDGE) dx = -1;
      if (this.pointer.x > width - EDGE) dx = 1;
      if (this.pointer.y < EDGE) dy = -1;
      if (this.pointer.y > height - EDGE) dy = 1;
    }
    if (dx || dy) this.cam.scrollBy((dx * ARROW_SPEED * ms) / 1000, (dy * ARROW_SPEED * ms) / 1000);
    this.updateTracking();
    this.cam.update(ms);
    this.world.draw(ms, this.cam, c);
    this.hud.update(ms);
    this.sound.update(ms);
    this.menu.update(ms);
    const flash = this.world.effects.flash;
    this.flashRect.setSize(this.scale.width, this.scale.height).setFillStyle(0xbfe8ff, flash > 0 ? (flash / 220) * 0.35 : 0);
  }
}

const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
