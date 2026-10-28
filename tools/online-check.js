// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Plays an online game between two tabs of one headless Chrome, as two
// people sharing a browser would, and checks after every move that both
// tabs agree on the game, and that only the player whose turn it is can
// act (spec 12, Every machine plays the same game; decisions D56, D57).
// The guest's tab is in the background when the game starts, and each
// tab is brought forward only for its own turn, so a tab's game must
// catch up on moves made while it was hidden.
//
// The players take turns to launch a Shell and to pass, so passing
// leaves the other player several turns in a row.
//
//   npm start                      (in another terminal)
//   node tools/online-check.js     [--moves 8] [--shots dir] [--restart n]
//
//   --moves n     how many moves to play (8)
//   --shots dir   save a screenshot of each tab after each move
//   --restart n   after move n, restart the server (stop whatever serves
//                 the game's port, and start tools/serve.js again, its
//                 output going to serve-restart.log in the system's
//                 temporary folder), then check both tabs take their
//                 seats back and carry on (decision D63). The new server
//                 is left running.
//   CHROME=path   where Chrome is (the macOS default otherwise)
//   URL=...       the game (http://localhost:8080/)

import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL ?? 'http://localhost:8080/';
const PORT = 9361;
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 ? args[k + 1] : fallback;
};
const MOVES = Number(option('moves', 8));
const SHOTS = option('shots', null);
const RESTART = option('restart', null) === null ? null : Number(option('restart'));
const G = 'window.lunarCitadel';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A tab, driven over Chrome's DevTools protocol.
async function openTab(tag) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${URL}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const waiting = new Map();
  const errors = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) {
      waiting.get(d.id)(d);
      waiting.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id;
    waiting.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  const tab = {
    tag,
    errors,
    front: () => send('Page.bringToFront'),
    eval: async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(`${tag}: ${r.result.exceptionDetails.exception?.description}`);
      return r.result?.result?.value;
    },
    shot: async (file) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
  };
  await waitFor(tab, `!!(${G} && ${G}.scene.getScenes(true).length)`, 'the game to load');
  return tab;
}

async function waitFor(tab, expression, what, ms = 20000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
    if (await tab.eval(expression).catch(() => false)) return;
  }
  throw new Error(`${tab.tag}: timed out waiting for ${what}`);
}

// What a tab's game screen shows.
const view = (tab) => tab.eval(`(() => {
  const sc = ${G}.scene.getScene('game');
  const s = sc?.session;
  if (!s || !sc.hud) return null;
  return { me: s.me, turn: s.state.turn?.player, phase: s.state.phase, moves: s.moves.length,
    canAct: s.canAct(s.me), skip: sc.hud.skip.enabled, banner: sc.hud.turnText.text };
})()`);

// Brings a tab forward and waits until its game has played `moves`
// moves through.
async function caughtUp(tab, moves) {
  await tab.front();
  await waitFor(tab, `(() => { const s = ${G}.scene.getScene('game')?.session;
    return !!s && s.moves.length === ${moves} && (s.state.phase === 'turn' || s.state.phase === 'over'); })()`,
  `move ${moves} to play out`);
  await sleep(300); // a frame or two for the screen to follow
  return view(tab);
}

// Stops the server on the game's port and starts it again.
async function restartServer() {
  const port = new globalThis.URL(URL).port || '80';
  const pids = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN || true`).toString().split('\n').filter(Boolean);
  for (const pid of pids) process.kill(Number(pid));
  for (let k = 0; k < 50 && (await fetch(URL).then(() => true, () => false)); k++) await sleep(100);
  const log = openSync(join(tmpdir(), 'serve-restart.log'), 'a');
  spawn(process.execPath, [join(import.meta.dirname, 'serve.js')], { detached: true, stdio: ['ignore', log, log], env: { ...process.env, PORT: port } }).unref();
  for (let k = 0; k < 100 && !(await fetch(URL).then((r) => r.ok, () => false)); k++) await sleep(100);
  console.log(`restarted the server (output in ${join(tmpdir(), 'serve-restart.log')})`);
}

const problems = [];
const check = (ok, text) => {
  if (!ok) problems.push(text);
};

const profile = mkdtempSync(join(tmpdir(), 'lunar-citadel-check-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1280,800', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
try {
  for (let k = 0; k < 50; k++) {
    if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) break;
    await sleep(200);
  }
  if (!(await fetch(URL).then((r) => r.ok, () => false))) throw new Error(`nothing at ${URL}: run npm start first`);

  // The host sets up a game; the guest joins it and is ready.
  const host = await openTab('host');
  await host.eval(`${G}.scene.getScenes(true)[0].scene.start('lobby')`);
  await waitFor(host, `!!${G}.registry.get('net')?.open`, 'the connection');
  await host.eval(`${G}.scene.getScene('lobby').host()`);
  await waitFor(host, `${G}.scene.isActive('setup')`, 'the setup screen');
  const guest = await openTab('guest');
  await guest.front();
  await guest.eval(`${G}.scene.getScenes(true)[0].scene.start('lobby')`);
  await waitFor(guest, `(${G}.scene.getScene('lobby').games ?? []).length > 0`, 'the game in the lobby');
  await guest.eval(`${G}.scene.getScene('lobby').join(0)`);
  await waitFor(guest, `${G}.scene.isActive('setup')`, 'the setup screen');
  await guest.eval(`${G}.registry.get('net').send('ready', { ready: true })`);
  await sleep(500);

  // The host starts it, with the guest's tab in the background.
  await host.front();
  await host.eval(`${G}.scene.getScene('setup').startGame()`);
  const tabs = [host, guest];
  for (let n = 0; n <= MOVES; n++) {
    const views = [];
    for (const tab of tabs) views.push({ tab, v: await caughtUp(tab, n) });
    const [a, b] = views.map((x) => x.v);
    console.log(`after move ${n}: turn P${a.turn}; host "${a.banner}" skip ${a.skip ? 'on' : 'off'}; ` +
      `guest "${b.banner}" skip ${b.skip ? 'on' : 'off'}`);
    check(a.turn === b.turn && a.phase === b.phase, `after move ${n}, the tabs disagree on the turn`);
    for (const { tab, v } of views) {
      const mine = v.turn === v.me && v.phase === 'turn';
      check(v.canAct === mine, `after move ${n}, ${tab.tag} ${mine ? "can't" : 'can'} act`);
      check(v.skip === mine, `after move ${n}, ${tab.tag}'s Skip is ${v.skip ? 'on' : 'off'}`);
      if (SHOTS) {
        await tab.front();
        await tab.shot(join(SHOTS, `move-${n}-${tab.tag}.png`));
      }
    }
    if (n === MOVES || a.phase === 'over') break;
    if (n === RESTART) {
      // Each tab's game starts again once it has its seat back: until
      // then, the old one still shows.
      for (const tab of tabs) await tab.eval(`window.oldSession = ${G}.scene.getScene('game').session`);
      await restartServer();
      for (const tab of tabs) {
        await tab.front();
        await waitFor(tab, `(() => { const sc = ${G}.scene.getScene('game');
          return ${G}.registry.get('net')?.open && !!sc?.session && sc.session !== window.oldSession; })()`, 'its seat back');
        await caughtUp(tab, n);
        check(await tab.eval(`${G}.scene.isActive('game')`), `after the restart, ${tab.tag} isn't in the game`);
      }
      const after = await Promise.all(tabs.map((t) => view(t)));
      console.log(`after the restart: both tabs back at move ${n}, turn P${after[0].turn}`);
      check(after[0].turn === after[1].turn, 'after the restart, the tabs disagree on the turn');
    }
    // Whoever's turn it is moves: a Shell on even moves, a pass on odd.
    const mover = views.find(({ v }) => v.me === a.turn).tab;
    await mover.front();
    await mover.eval(`(() => {
      const sc = ${G}.scene.getScene('game');
      if (${n % 2} === 1 || !sc.controls.pick('shell')) sc.skip();
      else sc.fire(700);
    })()`);
  }
  for (const tab of tabs) for (const e of tab.errors) problems.push(`${tab.tag} console: ${e}`);
} catch (e) {
  problems.push(e.message);
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
if (problems.length > 0) {
  console.log(`\nProblems:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nOK: both tabs agreed after every move, and only the player whose turn it was could act${RESTART === null ? '' : ', before and after the server restarted'}.`);
