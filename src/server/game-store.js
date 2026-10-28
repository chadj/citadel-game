// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Online games kept on disk while they're played, so they survive the
// server restarting (decision D63). Each game is a file in a folder,
// `<id>.jsonl`: a first line with what the game started from, then a
// line for each move, added as it's played:
//
//   { "format": "lunar-citadel-game", "rulesVersion", "name", "setup",
//     "tokens": [token or null, ...], "started" }
//   { "type": "launch", ... }
//   ...
//
// `tokens` are the human players' seat tokens, by player (null for a
// computer), so each can take back their seat. The file goes once the
// game's replay is kept. Writing is synchronous, so a move is on disk
// before anyone is told of it.

import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FORMAT = 'lunar-citadel-game';
const EXT = '.jsonl';

export function gameStore(dir) {
  const path = (id) => join(dir, `${id}${EXT}`);
  const journal = (id) => ({
    move(move) {
      appendFileSync(path(id), `${JSON.stringify(move)}\n`);
    },
    finish() {
      rmSync(path(id), { force: true });
    },
  });
  return {
    dir,
    // Starts a game's file. Returns its journal: `move(move)` adds a
    // move, `finish()` removes the file.
    start(id, { rulesVersion, name, setup, tokens }) {
      mkdirSync(dir, { recursive: true });
      const head = { format: FORMAT, rulesVersion, name, setup, tokens, started: new Date().toISOString() };
      writeFileSync(path(id), `${JSON.stringify(head)}\n`, { flag: 'wx' });
      return journal(id);
    },
    // The journal of a game already on disk.
    journal,
    // Every game on disk: { id, head, moves }, or { id, problem } for a
    // file that can't be read. A last line cut short (the server stopped
    // while writing it) is left out: that move was never sent to anyone.
    load() {
      let names;
      try {
        names = readdirSync(dir).filter((f) => f.endsWith(EXT)).sort();
      } catch (e) {
        if (e.code === 'ENOENT') return [];
        throw e;
      }
      return names.map((f) => {
        const id = f.slice(0, -EXT.length);
        try {
          const lines = readFileSync(join(dir, f), 'utf8').split('\n').filter((l) => l !== '');
          const head = JSON.parse(lines[0]);
          if (head?.format !== FORMAT || !head.setup || !Array.isArray(head.tokens)) return { id, problem: 'not a saved game' };
          const moves = [];
          for (let k = 1; k < lines.length; k++) {
            try {
              moves.push(JSON.parse(lines[k]));
            } catch {
              if (k === lines.length - 1) break;
              return { id, problem: `line ${k + 1} isn't a move` };
            }
          }
          return { id, head, moves };
        } catch (e) {
          return { id, problem: e.message };
        }
      });
    },
  };
}
