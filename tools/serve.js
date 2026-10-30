// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Serves the game from this folder, and runs the online lobby and games
// over a WebSocket at /net (spec 12; decision D52):
//   npm start   then open http://localhost:8080
// Others on the network join at this machine's address.
// Every online game that finishes has its replay kept as a file in
// replays/ (set REPLAY_DIR for another folder; decision D62). Games under
// way are written down in games/ (GAMES_DIR) as they're played, and
// carry on when the server starts again (D63).
//
// The page can also be hosted elsewhere, with this only as its game
// server (decision D66; tools/build-site.js). Then set ALLOWED_ORIGINS
// to the sites whose pages may connect, separated by commas, such as
// https://example.github.io (an address only: no path). Unset, any page
// may.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { WebSocketServer } from 'ws';
import { Lobby } from '../src/server/lobby.js';
import { replayKeeper } from '../src/server/replay-files.js';
import { gameStore } from '../src/server/game-store.js';
import { NET_PATH } from '../src/net/protocol.js';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT ?? 8080);
const REPLAY_DIR = resolve(process.env.REPLAY_DIR ?? join(ROOT, 'replays'));
const GAMES_DIR = resolve(process.env.GAMES_DIR ?? join(ROOT, 'games'));
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
// Text is sent compressed to browsers that take it: Phaser shrinks from
// about 9 MB to 2.
const COMPRESS = new Set(['.html', '.js', '.json', '.webmanifest', '.css', '.svg']);
const squeeze = promisify(gzip);
// Each file's compressed copy, kept until the file changes.
const squeezed = new Map();
async function compressed(file, body) {
  const kept = squeezed.get(file);
  if (kept && kept.raw.equals(body)) return kept.gz;
  const gz = await squeeze(body);
  squeezed.set(file, { raw: body, gz });
  return gz;
}
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};
// Only the game's own files are served.
const ALLOWED = ['index.html', 'manifest.webmanifest', 'src', join('node_modules', 'phaser', 'dist'), 'assets'];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '') || 'index.html';
  const file = resolve(ROOT, path);
  const allowed = ALLOWED.some((a) => file === join(ROOT, a) || file.startsWith(join(ROOT, a) + sep));
  if (!allowed) {
    res.writeHead(404).end('not found');
    return;
  }
  try {
    let body = await readFile(file);
    const headers = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache', vary: 'accept-encoding' };
    if (COMPRESS.has(extname(file)) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      body = await compressed(file, body);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const keep = replayKeeper(REPLAY_DIR);
const lobby = new Lobby({
  store: gameStore(GAMES_DIR),
  // A replay that can't be kept leaves its game's file in games/, so
  // it's tried again when the server next starts.
  onReplay: (replay, name) => keep(replay, name).then(
    (path) => console.log(`replay kept: ${path}`),
    (e) => {
      console.error(`the replay of "${name}" could not be kept:`, e.message);
      throw e;
    },
  ),
});
const { resumed, ended } = lobby.restoreGames();
for (const name of resumed) console.log(`game carried on: ${name}`);
for (const { name, why } of ended) console.log(`game not carried on: ${name}: ${why}`);
// A browser says which site's page is connecting; with ALLOWED_ORIGINS
// set, only those sites' pages may.
const verifyClient = ORIGINS.length === 0 ? undefined : ({ origin }) => !origin || ORIGINS.includes(origin);
const sockets = new WebSocketServer({ server, path: NET_PATH, maxPayload: 64 * 1024, verifyClient });
sockets.on('connection', (ws) => {
  const conn = lobby.connect((text) => {
    if (ws.readyState === ws.OPEN) ws.send(text);
  });
  ws.on('message', (data) => {
    try {
      lobby.receive(conn, data.toString());
    } catch (e) {
      console.error(e);
    }
  });
  ws.on('close', () => lobby.close(conn));
});

server.listen(PORT, () => {
  console.log(`Lunar Citadel: http://localhost:${PORT}`);
  if (ORIGINS.length > 0) console.log(`pages that may connect: ${ORIGINS.join(', ')}`);
});
