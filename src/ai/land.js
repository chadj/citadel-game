// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Which stretches of land join up without crossing water, and how far it
// is round by land (spec 02, Water, Landforms). A channel can end, and a
// pond sits in open ground: land on both sides of it is still one
// stretch, and a building can get round the water. Only water that cuts
// the land in two, or that is a long way round, is worth Pontoons (spec
// 09, Planning ahead).
//
// The map is sampled as closely as conduit nodes settle, so a channel
// half a tile wide always shows; each is worked out once a map.

import { NODE_SPACING, WET } from '../rules/constants.js';
import { sampleTerrain } from '../rules/terrain/terrain.js';

const cache = new WeakMap();

// The stretches of land: for each sample point, its stretch's number, or
// -1 on water.
function regions(map) {
  let r = cache.get(map);
  if (r) return r;
  const n = Math.floor(map.size / NODE_SPACING);
  const id = new Int32Array(n * n).fill(-2);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (sampleTerrain(map, x * NODE_SPACING, y * NODE_SPACING).type === WET) id[y * n + x] = -1;
    }
  }
  let next = 0;
  const stack = [];
  for (let k = 0; k < id.length; k++) {
    if (id[k] !== -2) continue;
    id[k] = next;
    stack.push(k);
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % n;
      const y = (i - x) / n;
      for (const j of [y * n + (x + 1) % n, y * n + (x + n - 1) % n, ((y + 1) % n) * n + x, ((y + n - 1) % n) * n + x]) {
        if (id[j] === -2) {
          id[j] = next;
          stack.push(j);
        }
      }
    }
    next += 1;
  }
  r = { n, id };
  cache.set(map, r);
  return r;
}

// The sample point at a point, or on the land just beside it; -1 if
// there's only water.
function pointAt(map, x, y) {
  const { n, id } = regions(map);
  const gx = Math.round(x / NODE_SPACING);
  const gy = Math.round(y / NODE_SPACING);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = ((((gy + dy) % n) + n) % n) * n + ((((gx + dx) % n) + n) % n);
    if (id[k] >= 0) return k;
  }
  return -1;
}

// The stretch of land at a point, or -1 for water. A point just off the
// shore takes the land beside it.
export function landAt(map, x, y) {
  const k = pointAt(map, x, y);
  return k < 0 ? -1 : regions(map).id[k];
}

// How far every sample point is from one, over land: in steps of half
// the spacing, 2 straight and 3 diagonally; -1 where land doesn't reach.
// A diagonal step needs land on both sides of it.
const fields = new WeakMap();
function field(map, from) {
  let byMap = fields.get(map);
  if (!byMap) fields.set(map, (byMap = new Map()));
  let dist = byMap.get(from);
  if (dist) return dist;
  const { n, id } = regions(map);
  dist = new Int32Array(n * n).fill(-1);
  const buckets = [[from]];
  dist[from] = 0;
  for (let d = 0; d < buckets.length; d++) {
    for (const i of buckets[d] ?? []) {
      if (dist[i] !== d) continue;
      const x = i % n;
      const y = (i - x) / n;
      const at = (dx, dy) => ((y + dy + n) % n) * n + ((x + dx + n) % n);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const j = at(dx, dy);
          if (id[j] < 0) continue;
          if (dx !== 0 && dy !== 0 && (id[at(dx, 0)] < 0 || id[at(0, dy)] < 0)) continue;
          const nd = d + (dx !== 0 && dy !== 0 ? 3 : 2);
          if (dist[j] >= 0 && dist[j] <= nd) continue;
          dist[j] = nd;
          (buckets[nd] ??= []).push(j);
        }
      }
    }
  }
  byMap.set(from, dist);
  return dist;
}

// How far it is from one point to another the way round by land, in
// fixed-point units; Infinity if water parts them. Worked out from
// `from` once a map, so `from` should be a place that stays, such as a
// vent or a launcher.
export function landDistance(map, from, to) {
  const a = pointAt(map, from.x, from.y);
  const b = pointAt(map, to.x, to.y);
  if (a < 0 || b < 0) return Infinity;
  const d = field(map, a)[b];
  return d < 0 ? Infinity : (d * NODE_SPACING) / 2;
}

// Whether land joins two points without crossing water.
export function sameLand(map, a, b) {
  const la = landAt(map, a.x, a.y);
  return la >= 0 && la === landAt(map, b.x, b.y);
}
