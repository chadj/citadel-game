// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Takes a screenshot of a game in a headless Chrome, for checking how
// the screen draws something (spec 10). It starts a game from the setup
// screen as it stands, runs a script of yours in the page to set the
// scene up, waits for it to draw, and saves a PNG.
//
//   npm start                                   (in another terminal)
//   node tools/screenshot.js out.png [--scene setup.js] [--wait 1500]
//
//   --scene file  a script run in the page once the game has started:
//                 the body of an async function given `sc` (the game
//                 scene) and `load(path)`, which imports a module of
//                 the game, such as '/src/rules/units.js'. What it
//                 returns is printed.
//   --wait ms     how long to let it draw before the screenshot (1500)
//   CHROME=path   where Chrome is (the macOS default otherwise)
//   URL=...       the game (http://localhost:8080/)
//
// For example, a scene with a Barrier over some of the viewer's units:
//
//   const { addUnit, citadelOf } = await load('/src/rules/units.js');
//   const { sampleTerrain } = await load('/src/rules/terrain/terrain.js');
//   const { updateFog } = await load('/src/rules/fog.js');
//   const game = sc.session.game;
//   const c = citadelOf(game.state, sc.viewer);
//   const put = (kind, dx, dy) => {
//     const x = c.x + dx * 1024, y = c.y + dy * 1024;
//     return addUnit(game.state, { kind, owner: sc.viewer, x, y, base: sampleTerrain(game.map, x, y).alt });
//   };
//   put('barrier', 0, -150).up = true;
//   put('spire', 80, -100);
//   updateFog(game);
//   sc.cam.centerOn(c.x / 1024, c.y / 1024 - 150);
//
// Things that make the screen come out black or empty:
//   - A tab in the background doesn't draw: it's brought to the front.
//   - Units of a player other than `sc.viewer` are hidden by the fog,
//     and new units need `updateFog` to see around them.
//   - Move the view with the game's camera, `sc.cam.centerOn(x, y)`, in
//     pixels. The game sets Phaser's camera from it every frame; moving
//     Phaser's camera (`sc.cameras.main`) instead leaves a blank screen.
//   - Chrome runs with WebGL off, so Phaser draws with its Canvas
//     renderer, which a headless screenshot captures reliably.
// Chrome is always closed at the end, even after an error. Don't pipe
// this into `head`: a closed pipe ends it before it can close Chrome.

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL ?? 'http://localhost:8080/';
const PORT = 9363;
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 ? args[k + 1] : fallback;
};
const out = args[0];
if (!out || out.startsWith('--')) {
  console.error('Usage: node tools/screenshot.js out.png [--scene setup.js] [--wait ms]');
  process.exit(1);
}
const scene = option('scene', null);
const WAIT = Number(option('wait', 1500));
const G = 'window.lunarCitadel';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'lunar-citadel-shot-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1280,800', '--disable-3d-apis', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let failed = false;
try {
  for (let k = 0; k < 50; k++) {
    if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) break;
    await sleep(200);
  }
  if (!(await fetch(URL).then((r) => r.ok, () => false))) throw new Error(`nothing at ${URL}: run npm start first`);
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${URL}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) {
      waiting.get(d.id)(d);
      waiting.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') console.error('page error:', d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id;
    waiting.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const run = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  await send('Runtime.enable');
  await send('Page.bringToFront');
  const until = async (expression, what) => {
    for (const end = Date.now() + 20000; Date.now() < end; await sleep(200)) {
      if (await run(expression).catch(() => false)) return;
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  await until(`!!(${G} && ${G}.scene.getScenes(true).length)`, 'the game to load');
  await run(`${G}.scene.getScenes(true)[0].scene.start('setup')`);
  await until(`${G}.scene.isActive('setup')`, 'the setup screen');
  await run(`${G}.scene.getScene('setup').startGame()`);
  await until(`!!${G}.scene.getScene('game')?.world`, 'the game screen');
  await sleep(1000);
  if (scene) {
    const body = readFileSync(scene, 'utf8');
    const said = await run(`(async (sc, load) => {\n${body}\n})(${G}.scene.getScene('game'), (path) => import(path))`);
    if (said !== undefined) console.log(said);
  }
  await sleep(WAIT);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(`saved ${out}`);
} catch (e) {
  console.error(e.message);
  failed = true;
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
if (failed) process.exit(1);
