// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Saved replays (spec 12, Saving a replay, Watching a replay): as many
// as the player likes, each with a name, kept in the browser's storage.
// A replay can also be saved to a file and opened from one; the file's
// format is in docs/formats.md (Replay files).

import { RULES_VERSION } from '../../rules/version.js';

const STORAGE_KEY = 'lunar-citadel.replays';

export function listReplays(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list, storage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Adds a replay under a name. Returns false if it couldn't be saved.
export function saveReplay(name, replay, storage = globalThis.localStorage, now = new Date()) {
  const list = listReplays(storage);
  list.push({ id: `${now.getTime()}-${list.length}`, name: name.trim() || 'Replay', saved: now.toISOString(), replay });
  return write(list, storage);
}

export function deleteReplay(id, storage = globalThis.localStorage) {
  return write(listReplays(storage).filter((r) => r.id !== id), storage);
}

// A replay as a file's text, and back. Reading checks it's a replay,
// and says if it was made under other rules (spec 12, What a replay
// records): such a replay is refused.
export function replayToText(replay) {
  return JSON.stringify({ format: 'lunar-citadel-replay', ...replay });
}

export function replayFromText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file isn\'t a replay.' };
  }
  if (data?.format !== 'lunar-citadel-replay' || !data.setup || !Array.isArray(data.moves)) {
    return { ok: false, reason: 'That file isn\'t a replay.' };
  }
  if (data.rulesVersion !== RULES_VERSION) {
    return { ok: false, reason: `That replay was made under rules version ${data.rulesVersion}, and this game uses ${RULES_VERSION}. It can't be played back.` };
  }
  const replay = { ...data };
  delete replay.format;
  return { ok: true, replay };
}

export function playable(replay) {
  return replay?.rulesVersion === RULES_VERSION;
}
