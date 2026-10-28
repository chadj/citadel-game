// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Serves the game from this folder, and runs the online lobby and games
// over a WebSocket at /net (spec 12; decision D52):
//   npm start   then open http://localhost:8080
// Others on the network join at this machine's address.
// Every online game that finishes has its replay kept as a file in
// replays/ (set REPLAY_DIR for another folder; decision D62).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import { Lobby } from '../src/server/lobby.js';
import { replayKeeper } from '../src/server/replay-files.js';
import { NET_PATH } from '../src/net/protocol.js';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT ?? 8080);
const REPLAY_DIR = resolve(process.env.REPLAY_DIR ?? join(ROOT, 'replays'));
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
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const keep = replayKeeper(REPLAY_DIR);
const lobby = new Lobby({
  onReplay: (replay, name) => keep(replay, name).then(
    (path) => console.log(`replay kept: ${path}`),
    (e) => console.error(`the replay of "${name}" could not be kept:`, e.message),
  ),
});
const sockets = new WebSocketServer({ server, path: NET_PATH, maxPayload: 64 * 1024 });
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
});
