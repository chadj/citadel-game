// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The game in the browser: Phaser draws it, takes the input, moves the
// camera and runs the interface (CLAUDE.md, Architecture). The rules
// run as plain JavaScript underneath (src/rules).

import * as Phaser from 'phaser';
import { loadPrefs } from './core/prefs.js';
import { AudioEngine } from './audio/engine.js';
import { Music } from './audio/music.js';
import { AideVoice } from './audio/voice.js';
import { MenuScene } from './scenes/menu.js';
import { OptionsScene } from './scenes/options.js';
import { SetupScene } from './scenes/setup.js';
import { GameScene } from './scenes/game.js';
import { SummaryScene } from './scenes/summary.js';
import { ReplaysScene } from './scenes/replays.js';
import { LobbyScene } from './scenes/lobby.js';
import { DPR } from './ui/kit.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0f14',
  // Drawn at the screen's own resolution, shown at the window's size.
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth * DPR, height: window.innerHeight * DPR, zoom: 1 / DPR },
  dom: { createContainer: true },
  disableContextMenu: true,
  input: { activePointers: 3 },
  // The game makes its own sound (src/client/audio).
  audio: { noAudio: true },
  scene: [MenuScene, OptionsScene, SetupScene, GameScene, SummaryScene, ReplaysScene, LobbyScene],
});

window.addEventListener('resize', () => game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR));

const prefs = loadPrefs();
game.registry.set('prefs', prefs);
const engine = new AudioEngine(prefs);
game.registry.set('audio', { engine, music: new Music(engine), voice: new AideVoice(engine, prefs) });

// For looking into the game from the browser's console.
window.lunarCitadel = game;
