// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The eighteen items on the build menu (spec 00, What can be launched;
// spec 04). An item's level is also its cost in energy. A Battery
// launches only the attacking weapons.

export const BUILDING = 'building'; // stays, joined by a conduit
export const FREE = 'free'; // stays, with no conduit
export const WEAPON = 'weapon'; // weapons and tools: nothing stays

const item = (level, category, battery = false) => Object.freeze({ level, category, battery });

export const ITEMS = Object.freeze({
  interceptor: item(1, BUILDING),
  spire: item(1, BUILDING),
  pontoon: item(1, FREE),
  shell: item(1, WEAPON, true),
  scatter: item(1, WEAPON, true),
  repair: item(1, WEAPON),
  skyProbe: item(3, FREE),
  charges: item(3, FREE),
  seeker: item(3, WEAPON, true),
  pulse: item(3, WEAPON, true),
  surge: item(3, WEAPON, true),
  salvager: item(3, WEAPON),
  extractor: item(7, BUILDING),
  barrier: item(7, BUILDING),
  battery: item(7, BUILDING),
  outpost: item(7, BUILDING),
  rover: item(7, FREE, true),
  worm: item(7, WEAPON, true),
});

// Whether `id` names one of the items: only the table's own names, so a
// move naming "toString", say, is no item.
export function isItem(id) {
  return typeof id === 'string' && Object.hasOwn(ITEMS, id);
}

// The energy an item costs, in tenths.
export function itemCost(id) {
  return ITEMS[id].level * 10;
}

// Whether a launcher of this kind can launch the item.
export function canLaunch(launcherKind, id) {
  if (!isItem(id)) return false;
  const it = ITEMS[id];
  if (launcherKind === 'outpost') return true;
  if (launcherKind === 'battery') return it.battery;
  return false;
}
