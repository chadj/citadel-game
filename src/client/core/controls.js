// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// One human player's controls: the selected launcher, each launcher's
// aim, the build menu and the launching view (spec 10, Selecting a
// launcher, The build menu, The launching view). In a hot-seat game,
// each human has their own, along with where their camera was.

import { ITEMS, itemCost, canLaunch } from '../../rules/items.js';
import { isLauncher, isWorking, findUnit, citadelOf } from '../../rules/units.js';
import { aimFromHeading, wrapAim } from './aim.js';
import { Meter } from './meter.js';

export const LEVELS = Object.freeze([1, 3, 7]);

// The items of a level, in menu order.
export const ITEMS_BY_LEVEL = Object.freeze(Object.fromEntries(
  LEVELS.map((level) => [level, Object.keys(ITEMS).filter((id) => ITEMS[id].level === level)]),
));

export class PlayerControls {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    const citadel = citadelOf(game.state, player);
    this.selected = citadel?.id ?? null;
    this.aims = new Map(); // launcher id → aim, in fine steps
    this.level = 1; // the open level of the build menu
    this.item = null; // the item picked: the launching view is open
    this.launched = false; // Launch was pressed, and its shot is in the air
    this.meter = new Meter();
    this.camera = citadel ? { x: citadel.x / 1024, y: citadel.y / 1024 } : null; // filled in by the screen
  }

  get state() {
    return this.game.state;
  }

  // The player's launchers, in the order they were built.
  launchers() {
    return this.state.units.filter((u) => u.owner === this.player && isLauncher(u)).sort((a, b) => a.id - b.id);
  }

  selectedUnit() {
    return this.selected === null ? null : findUnit(this.state, this.selected);
  }

  aim() {
    return this.aims.get(this.selected) ?? 0;
  }

  setAim(fine) {
    if (this.selected !== null) this.aims.set(this.selected, wrapAim(fine));
  }

  turnAim(steps) {
    if (this.launched || this.meter.holding) return;
    this.setAim(this.aim() + steps);
  }

  // Selects a launcher. Changing launcher resets the menu, unless the
  // new one is the same kind as the old and both are working.
  select(id) {
    const unit = findUnit(this.state, id);
    if (!unit || unit.owner !== this.player || !isLauncher(unit) || this.meter.holding) return false;
    if (id === this.selected) return true;
    const old = this.selectedUnit();
    const keep = old && old.kind === unit.kind && isWorking(this.state, old) && isWorking(this.state, unit);
    this.selected = id;
    if (!keep) this.resetMenu();
    return true;
  }

  // Steps through the launchers in build order, wrapping round.
  step(dir) {
    const list = this.launchers();
    if (list.length === 0) return null;
    const at = list.findIndex((u) => u.id === this.selected);
    const next = list[(((at < 0 ? 0 : at + dir) % list.length) + list.length) % list.length];
    this.select(next.id);
    return next;
  }

  // The selected launcher is gone: the next one in build order, without
  // moving the view.
  onDestroyed(id) {
    if (id !== this.selected) return;
    const list = this.launchers();
    this.selected = null;
    this.resetMenu();
    if (list.length === 0) return;
    // The first launcher built after the lost one, wrapping round.
    const next = list.find((u) => u.id > id) ?? list[0];
    this.selected = next.id;
  }

  // A launcher was built: it starts with the heading it was launched at.
  onBuilt(unit, heading, selectNew) {
    if (unit.owner !== this.player || !isLauncher(unit)) return;
    if (heading !== undefined) this.aims.set(unit.id, aimFromHeading(heading));
    if (this.selected === null || selectNew) this.select(unit.id);
  }

  energy() {
    return this.state.players[this.player].energy;
  }

  // Whether a level can be opened: the player has at least that much
  // energy (spec 10, The build menu).
  levelOpen(level) {
    return this.energy() >= level * 10;
  }

  // The items the menu offers at a level: none for a disabled launcher,
  // only the attacking weapons for a Battery.
  items(level = this.level) {
    const unit = this.selectedUnit();
    if (!unit || !isWorking(this.state, unit)) return [];
    return ITEMS_BY_LEVEL[level].filter((id) => canLaunch(unit.kind, id));
  }

  // Whether the menu is open at all: with no energy, it closes.
  get menuOpen() {
    return this.levelOpen(1);
  }

  openLevel(level) {
    if (!this.levelOpen(level) || this.meter.holding) return false;
    this.level = level;
    this.resetMenu();
    return true;
  }

  // If the open level can't be afforded any more, drop to the next
  // lower one that can.
  checkLevel() {
    if (this.levelOpen(this.level)) return;
    const lower = [...LEVELS].reverse().find((l) => l < this.level && this.levelOpen(l));
    this.level = lower ?? 1;
    if (this.item && !this.levelOpen(ITEMS[this.item].level) && !this.launched) this.resetMenu();
  }

  pick(id) {
    if (!this.items().includes(id) || itemCost(id) > this.energy()) return false;
    if (this.meter.holding) return false;
    this.item = id;
    this.launched = false;
    this.meter.clear();
    return true;
  }

  // Cancel works only until Launch is pressed.
  cancel() {
    if (this.launched || this.meter.holding) return false;
    this.resetMenu();
    return true;
  }

  // Back to the open level's items.
  resetMenu() {
    this.item = null;
    this.launched = false;
    this.meter.clear();
  }
}
