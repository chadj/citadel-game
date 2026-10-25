// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What the game remembers between visits (spec 10, Tracking shots,
// Preferences, Damage bars and range circles, Options; spec 12, The
// lobby, What each player chooses, What the host chooses). Kept in the
// browser's storage; if storage isn't available, the defaults are used
// and nothing is saved.

import { DEFAULT_KEYS } from './keys.js';

const STORAGE_KEY = 'lunar-citadel.prefs';

export function defaultPrefs() {
  return {
    name: 'Player',
    faction: 0,
    color: 0,
    keys: { ...DEFAULT_KEYS },
    // The four camera preferences, all off by default.
    edgeScroll: false,
    selectNew: false,
    steadyCamera: false,
    snapBack: false,
    // The tracking cameras, off at first.
    chaseCam: false,
    watchCam: false,
    damageBars: false,
    rangeCircles: false,
    volumes: { effects: 80, music: 60, aide: 80, ui: 70 },
    aideChatter: true,
    // The host's settings (spec 12).
    host: { map: null, clock: 60, wind: 0, fog: true },
  };
}

// Merges what was saved over the defaults, keeping only known fields of
// the right type.
export function mergePrefs(saved) {
  const prefs = defaultPrefs();
  if (!saved || typeof saved !== 'object') return prefs;
  for (const [k, v] of Object.entries(prefs)) {
    const got = saved[k];
    if (got === undefined || got === null) continue;
    if (typeof v === 'object' && v !== null) {
      if (typeof got !== 'object') continue;
      for (const [k2, v2] of Object.entries(v)) {
        if (got[k2] !== undefined && (v2 === null || typeof got[k2] === typeof v2)) v[k2] = got[k2];
      }
    } else if (typeof got === typeof v) {
      prefs[k] = got;
    }
  }
  return prefs;
}

export function loadPrefs(storage = globalThis.localStorage) {
  try {
    return mergePrefs(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
