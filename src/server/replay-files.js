// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Keeps the replay of every online game that finishes, as a replay file
// in a folder on the server (spec 12, Saving a replay: "an
// implementation may also save every online game's replay by itself";
// decision D62). The files are the same as a player saves from the
// summary, so the game's Replays screen opens them.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { replayFileName, replayToText } from '../client/core/replay-store.js';

// A function to hand each finished game's replay to: it writes the file
// into `dir`, made if need be, and resolves to its path. A file's name is
// the game's name (or its players', if it has none) and the date and
// time; a name already there gets a number after the time.
export function replayKeeper(dir, { now = () => new Date() } = {}) {
  return async (replay, name) => {
    await mkdir(dir, { recursive: true });
    const title = name?.trim() || replay.setup.players.map((p) => p.name).join(' vs ');
    const when = now();
    const text = replayToText(replay);
    for (let k = 1; ; k++) {
      const path = join(dir, replayFileName(title, when, k === 1 ? '' : String(k)));
      try {
        await writeFile(path, text, { flag: 'wx' });
        return path;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }
  };
}
