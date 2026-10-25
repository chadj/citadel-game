// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// What the interface calls things (spec 04, The units; spec 00, What
// can be launched), with short labels for small buttons, and a line on
// what each item does for its tip.

export const ITEM_NAMES = Object.freeze({
  interceptor: ['Interceptor', 'Interceptor', 'Fires at enemy shots that come within reach.'],
  spire: ['Spire', 'Spire', 'A tall lookout that sees far through the fog.'],
  pontoon: ['Pontoon', 'Pontoon', 'Turns a water tile into ground you can build on.'],
  shell: ['Shell', 'Shell', 'Explodes where it lands.'],
  scatter: ['Scatter Shell', 'Scatter', 'Splits in three at the top of its arc.'],
  repair: ['Repair Pod', 'Repair', 'Repairs a damaged unit where it lands.'],
  skyProbe: ['Sky Probe', 'Sky Probe', 'Stops in the air and floats there as a lookout.'],
  charges: ['Proximity Charges', 'Charges', 'Three charges that go off when an enemy comes near.'],
  seeker: ['Seeker', 'Seeker', 'Homes in on an enemy unit after the top of its arc.'],
  pulse: ['Pulse', 'Pulse', 'Disables everything nearby for a while.'],
  surge: ['Surge', 'Surge', 'Its damage runs along the conduit it hits.'],
  salvager: ['Salvager', 'Salvager', 'Turns a unit\'s armor into energy for you.'],
  extractor: ['Extractor', 'Extractor', 'Earns energy every round; more on a vent.'],
  barrier: ['Barrier', 'Barrier', 'A dome that stops enemy shots.'],
  battery: ['Battery', 'Battery', 'A launcher for attacking weapons, with longer range.'],
  outpost: ['Outpost', 'Outpost', 'A launcher that can launch anything.'],
  rover: ['Rover', 'Rover', 'Drives on at the end of every round and explodes at the enemy.'],
  worm: ['Worm', 'Worm', 'Disables units and spreads along their conduits.'],
});

export const itemName = (id) => ITEM_NAMES[id]?.[0] ?? id;
export const itemShort = (id) => ITEM_NAMES[id]?.[1] ?? id;
export const itemTip = (id) => ITEM_NAMES[id] ? `${ITEM_NAMES[id][0]}: ${ITEM_NAMES[id][2]}` : id;

export const UNIT_NAMES = Object.freeze({
  outpost: 'Outpost', battery: 'Battery', extractor: 'Extractor', barrier: 'Barrier', interceptor: 'Interceptor',
  spire: 'Spire', pontoon: 'Pontoon', skyProbe: 'Sky Probe', charge: 'Proximity Charge', rover: 'Rover',
});

export const WIND_NAMES = Object.freeze(['No wind', 'Light wind', 'Medium wind', 'Strong wind']);
