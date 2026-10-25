// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The keys (spec 10, Keys). Every action spec 10 lists has a letter the
// player can change in the options, besides the arrow keys and Esc. We
// add letters to turn the aim and to launch: they turn in the same
// steps as the on-screen controls, and the launch key fills the meter
// the same way, so they don't change what a move can be.

export const KEY_ACTIONS = Object.freeze([
  ['damageBars', 'Damage bars on or off'],
  ['rangeCircles', 'Range circles on or off'],
  ['center', 'Center on the selected launcher'],
  ['next', 'Next launcher'],
  ['previous', 'Previous launcher'],
  ['closestOutpost', 'Outpost closest to the center'],
  ['lastAttacked', 'Unit attacked last'],
  ['chat', 'Start or send a chat line'],
  ['turnLeft', 'Turn the aim counterclockwise'],
  ['turnRight', 'Turn the aim clockwise'],
  ['launch', 'Launch (hold)'],
  ['override', 'Override the conduit marker (hold with Launch)'],
]);

export const DEFAULT_KEYS = Object.freeze({
  damageBars: 'B',
  rangeCircles: 'R',
  center: 'C',
  next: 'E',
  previous: 'Q',
  closestOutpost: 'O',
  lastAttacked: 'A',
  chat: 'T',
  turnLeft: 'Z',
  turnRight: 'X',
  launch: 'L',
  override: 'V',
});

// Sets an action's letter. A letter can only do one thing, so an action
// that had it takes this action's old letter. Returns the new keys.
export function rebind(keys, action, letter) {
  const key = letter.toUpperCase();
  if (!/^[A-Z]$/.test(key) || !(action in keys)) return keys;
  const next = { ...keys };
  const other = Object.keys(next).find((a) => next[a] === key);
  if (other && other !== action) next[other] = next[action];
  next[action] = key;
  return next;
}

// The action a letter does, or null.
export function actionFor(keys, letter) {
  const key = letter.toUpperCase();
  return Object.keys(keys).find((a) => keys[a] === key) ?? null;
}
