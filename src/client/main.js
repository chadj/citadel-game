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

// The game fills its element, which index.html keeps to the screen's
// safe area (clear of notches and the home indicator).
const holder = document.getElementById('game');

// Opened from an iPhone's Home Screen, the page can come out shorter than
// the screen by about the status bar's height (seen on iOS 26), leaving
// an empty strip along the bottom. There the game's element is given the
// screen's height instead. It can't stay `position: fixed`: iOS doesn't
// draw a fixed element below the short page. Only when the app fills the
// screen's width, so an iPad app in a window of its own is left alone.
function fillScreen() {
  if (!navigator.standalone) return;
  const portrait = window.innerHeight >= window.innerWidth;
  const [across, tall] = portrait
    ? [Math.min(screen.width, screen.height), Math.max(screen.width, screen.height)]
    : [Math.max(screen.width, screen.height), Math.min(screen.width, screen.height)];
  const probe = document.createElement('div');
  probe.style.cssText = 'position: fixed; top: 0; bottom: 0; visibility: hidden';
  document.body.append(probe);
  const short = tall - probe.getBoundingClientRect().height;
  probe.remove();
  const fix = window.innerWidth === across && short > 0 && short <= 80;
  Object.assign(holder.style, fix
    ? { position: 'absolute', bottom: 'auto', height: `calc(${tall}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))` }
    : { position: '', bottom: '', height: '' });
}
fillScreen();
window.addEventListener('resize', fillScreen);

const size = () => [Math.max(1, holder.clientWidth) * DPR, Math.max(1, holder.clientHeight) * DPR];

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0f14',
  // Drawn at the screen's own resolution, shown at the window's size.
  scale: { mode: Phaser.Scale.NONE, width: size()[0], height: size()[1], zoom: 1 / DPR },
  dom: { createContainer: true },
  disableContextMenu: true,
  input: { activePointers: 3 },
  // The game makes its own sound (src/client/audio).
  audio: { noAudio: true },
  scene: [MenuScene, OptionsScene, SetupScene, GameScene, SummaryScene, ReplaysScene, LobbyScene],
});

// Turning the phone moves the safe area as well as resizing the window.
new ResizeObserver(() => game.scale.resize(...size())).observe(holder);

const prefs = loadPrefs();
game.registry.set('prefs', prefs);
const engine = new AudioEngine(prefs);
game.registry.set('audio', { engine, music: new Music(engine), voice: new AideVoice(engine, prefs) });

// For looking into the game from the browser's console.
window.lunarCitadel = game;
