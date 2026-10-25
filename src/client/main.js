// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game in the browser: Phaser draws it, takes the input, moves the
// camera and runs the interface (CLAUDE.md, Architecture). The rules
// run as plain JavaScript underneath (src/rules).

import * as Phaser from 'phaser';
import { loadPrefs } from './core/prefs.js';
import { MenuScene } from './scenes/menu.js';
import { OptionsScene } from './scenes/options.js';
import { SetupScene } from './scenes/setup.js';
import { GameScene } from './scenes/game.js';
import { SummaryScene } from './scenes/summary.js';
import { ReplaysScene } from './scenes/replays.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0f14',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  dom: { createContainer: true },
  disableContextMenu: true,
  input: { activePointers: 3 },
  scene: [MenuScene, OptionsScene, SetupScene, GameScene, SummaryScene, ReplaysScene],
});

game.registry.set('prefs', loadPrefs());

// For looking into the game from the browser's console.
window.lunarCitadel = game;
