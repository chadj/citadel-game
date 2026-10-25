// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// Landforms (spec 02, Landforms; decision D55): tiles shaped from their
// corners, the cliff pieces, smooth joins, the water forms, and the maps
// the generator makes and the game comes with.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMap, sketchMap, LEVEL_OF } from '../../src/rules/terrain/map.js';
import { sampleTerrain, piecesFor, NW, NE, SE, SW } from '../../src/rules/terrain/terrain.js';
import { FLAT, SLOPE, WET, TILE, SLOPE_WIDTH, CLIFF_INSET, GROUND, MAP_SIZES } from '../../src/rules/constants.js';
import { PX, px } from '../../src/rules/math/fixed.js';
import { generateMap, STYLES } from '../../src/mapgen/generate.js';
import { MAPS, mapData } from '../../src/maps/index.js';

const T = TILE / PX;
const at = (map, x, y) => sampleTerrain(map, px(x), px(y));

// Generated maps across the styles, sizes and settings.
const GENERATED = [];
for (const style of STYLES) {
  for (const tiles of MAP_SIZES) {
    for (const [terrain, water] of [[0, 0], [2, 2], [4, 1], [3, 4]]) {
      GENERATED.push(generateMap({ style, tiles, planet: 'canyon', energy: 2, terrain, water }, tiles * 7 + terrain + water));
    }
  }
}
const ALL = [...GENERATED, ...MAPS];

// Each tile's four corner levels, and whether water lies in it.
function tiles(m) {
  const n = m.corners.length;
  const level = (x, y) => LEVEL_OF[m.corners[(y + n) % n][(x + n) % n]];
  const mark = (x, y) => {
    const c = m.water?.[(y + n) % n][(x + n) % n] ?? '.';
    return c === '.' ? 0 : Number(c);
  };
  const out = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const four = [level(x, y), level(x + 1, y), level(x + 1, y + 1), level(x, y + 1)];
      const arms = (mark(x, y) & 1 ? 1 : 0) | (mark(x + 1, y) & 2 ? 2 : 0) | (mark(x, y + 1) & 1 ? 4 : 0) | (mark(x, y) & 2 ? 8 : 0);
      out.push({ x, y, four, arms, pond: (mark(x, y) & 4) !== 0 });
    }
  }
  return out;
}

test('the generator and the built-in maps use only valid corner combinations', () => {
  for (const m of ALL) {
    for (const row of m.corners) assert.match(row, /^[~.+^]+$/, m.name);
    for (const t of tiles(m)) {
      const low = Math.min(...t.four);
      const high = Math.max(...t.four);
      // At most two levels, and those neighbors: never three, never
      // Ground with Mountain, never water with Plateau.
      assert.ok(high - low <= 1, `${m.name}: tile (${t.x}, ${t.y}) has ${t.four}`);
      // Water lies in Ground: no water in a tile with a raised corner.
      if (t.arms || t.pond || low === 0) assert.ok(high <= GROUND, `${m.name}: tile (${t.x}, ${t.y}) has water and a cliff`);
    }
    loadMap(mapData(m));
  }
});

test('no tile has both water and a cliff, sampled across every tile', () => {
  for (const m of [...MAPS, ...GENERATED.filter((g) => g.corners.length === 32)]) {
    const map = loadMap(mapData(m));
    for (let ty = 0; ty < map.tiles; ty++) {
      for (let tx = 0; tx < map.tiles; tx++) {
        let wet = false;
        let raised = false;
        for (let v = 1; v < T; v += 4) {
          for (let u = 1; u < T; u += 4) {
            const s = at(map, tx * T + u, ty * T + v);
            if (s.type === WET) wet = true;
            if (s.alt > 0) raised = true;
          }
        }
        assert.ok(!(wet && raised), `${m.name}: tile (${tx}, ${ty})`);
      }
    }
  }
});

// The pieces, rotated a quarter turn clockwise: NW goes to NE, and so on.
const turn = (c) => ((c << 1) | (c >> 3)) & 15;
const turnPoint = ([x, y]) => [TILE - y, x];
const key = (polys) => polys.map((p) => p.pts.map(([x, y]) => `${x},${y}`).sort().join(' ')).sort().join(' | ');

test('every cliff piece exists in all four facings', () => {
  const area = (pts) => Math.abs(pts.reduce((s, [x, y], k) => {
    const [x2, y2] = pts[(k + 1) % pts.length];
    return s + x * y2 - x2 * y;
  }, 0)) / 2;
  const total = (c) => piecesFor(c).reduce((s, p) => s + area(p.pts), 0);
  const a = CLIFF_INSET;
  for (let c = 0; c < 16; c++) {
    const turned = piecesFor(c).map((p) => ({ pts: p.pts.map(turnPoint) }));
    assert.equal(key(turned), key(piecesFor(turn(c))), `case ${c} turned`);
  }
  // Flat; a straight edge; an outside corner; an inside corner; a saddle.
  assert.equal(total(0), 0);
  assert.equal(total(15), TILE * TILE);
  assert.equal(total(NW | NE), TILE * a);
  assert.equal(total(NW), (a * a) / 2);
  assert.equal(total(NW | NE | SE), TILE * TILE - ((TILE - a) * (TILE - a)) / 2);
  assert.equal(piecesFor(NW | SE).length, 2);
  assert.equal(total(NE | SW), a * a);
  // Every side runs along the grid or at 45°.
  for (let c = 0; c < 16; c++) {
    for (const p of piecesFor(c)) for (const s of p.sides) assert.ok(s.sx === 0 || s.sy === 0 || Math.abs(s.sx) === Math.abs(s.sy));
  }
});

test('diagonal cliffs appear on the maps', () => {
  for (const m of [...MAPS, ...GENERATED.filter((g) => g.settings.terrain >= 2)]) {
    const diagonal = tiles(m).filter((t) => {
      const high = Math.max(...t.four);
      const up = t.four.filter((l) => l === high).length;
      return high > GROUND && Math.min(...t.four) < high && up !== 2;
    }).length;
    assert.ok(diagonal >= 8, `${m.name}: ${diagonal} outside and inside corners`);
  }
});

// The slope's width around a point on it: its distance to the flat top
// plus its distance to the flat foot, from samples every 2 px.
function widths(map, x0, y0, w, h) {
  const step = 2;
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const kind = new Int8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const s = at(map, x0 + i * step, y0 + j * step);
      kind[j * cols + i] = s.type === SLOPE ? 1 : s.alt > 0 ? 2 : 0; // slope, top, foot
    }
  }
  const reach = Math.ceil((SLOPE_WIDTH / PX + 6) / step);
  const out = [];
  for (let j = reach; j < rows - reach; j++) {
    for (let i = reach; i < cols - reach; i++) {
      if (kind[j * cols + i] !== 1) continue;
      let top = Infinity;
      let foot = Infinity;
      for (let dj = -reach; dj <= reach; dj++) {
        for (let di = -reach; di <= reach; di++) {
          const k = kind[(j + dj) * cols + i + di];
          const d = Math.hypot(di, dj) * step;
          if (k === 2) top = Math.min(top, d);
          else if (k === 0) foot = Math.min(foot, d);
        }
      }
      out.push({ x: x0 + i * step, y: y0 + j * step, width: top + foot });
    }
  }
  return out;
}

test('slopes stay about the same width across joins: straight edges, corners and diagonal runs', () => {
  // A Plateau with straight edges, outside and inside corners and a
  // diagonal run that turns into straight edges at both ends.
  const map = sketchMap({
    at: [4, 4],
    corners: [
      '+++++.......',
      '++++++......',
      '+++++++.....',
      '++++++++....',
      '++++++++....',
      '++++++++....',
      '+++.........',
      '+++.........',
    ],
  });
  const slope = SLOPE_WIDTH / PX;
  const found = widths(map, 2 * T, 2 * T, 12 * T, 10 * T);
  assert.ok(found.length > 1000);
  // Sampling every 2 px blurs each distance by a pixel or two.
  for (const p of found) assert.ok(Math.abs(p.width - slope) <= 6, `${p.width} at ${p.x}, ${p.y}`);
  const near = found.filter((p) => Math.abs(p.width - slope) <= 3).length;
  assert.ok(near / found.length > 0.98, `${near} of ${found.length}`);
});

test('pieces join without a step or a gap: the altitude is continuous', () => {
  const map = sketchMap({ at: [4, 4], corners: ['+++.', '++..', '+.+.', '....'] });
  for (let y = 3 * T; y < 9 * T; y += 3) {
    let last = at(map, 3 * T, y).alt;
    for (let x = 3 * T + 1; x < 9 * T; x++) {
      const { alt } = at(map, x, y);
      // Bumps aside, a 1 px step climbs about plateau / slope width.
      assert.ok(Math.abs(alt - last) < px(8), `${x}, ${y}: ${last} to ${alt}`);
      last = alt;
    }
  }
});

test('every water form is on the built-in maps', () => {
  const forms = {
    straight: 0, bend: 0, tJunction: 0, crossing: 0, deadEnd: 0, pond: 0,
    shore: 0, outsideCorner: 0, pointOfLand: 0, oppositePoints: 0, openingIntoLake: 0,
  };
  for (const m of MAPS) {
    for (const t of tiles(m)) {
      const arms = [1, 2, 4, 8].filter((b) => t.arms & b).length;
      const water = t.four.filter((l) => l === 0).length;
      if (water === 0 && arms === 1) forms.deadEnd++;
      if (arms === 2) forms[t.arms === 5 || t.arms === 10 ? 'straight' : 'bend']++;
      if (arms === 3) forms.tJunction++;
      if (arms === 4) forms.crossing++;
      if (t.pond) forms.pond++;
      if (water === 2 && t.four[0] === t.four[2]) forms.oppositePoints++;
      else if (water === 2) forms.shore++;
      if (water === 1) forms.outsideCorner++;
      if (water === 3) forms.pointOfLand++;
      if (water > 0 && arms > 0) forms.openingIntoLake++;
    }
  }
  for (const [form, count] of Object.entries(forms)) assert.ok(count > 0, `${form}: ${count}`);
});

test('the generator makes channels, ponds and lakes, and paints craters', () => {
  const wet = GENERATED.filter((g) => g.settings.water >= 2);
  const count = (pred) => wet.reduce((s, m) => s + tiles(m).filter(pred).length, 0);
  assert.ok(count((t) => t.arms !== 0 && Math.min(...t.four) > 0) > 50, 'channels');
  assert.ok(count((t) => [3, 6, 12, 9].includes(t.arms)) > 10, 'bends');
  assert.ok(count((t) => [7, 11, 13, 14].includes(t.arms)) > 0, 'T-junctions');
  assert.ok(count((t) => t.pond) > 5, 'ponds');
  assert.ok(count((t) => t.arms !== 0 && Math.min(...t.four) === 0) > 5, 'channels opening into lakes');
  // Craters where there's room for them: some island maps have none.
  assert.ok(GENERATED.filter((g) => g.craters?.length > 0).length >= 0.8 * GENERATED.length, 'craters');
});

test('a channel is narrow enough for one Pontoon to bridge', () => {
  const map = sketchMap({ water: Array(32).fill('...1') });
  for (let x = 0; x < 32 * T; x++) {
    if (at(map, x, 100).type === WET) assert.equal(Math.floor(x / T), 3, `${x}`);
  }
});

test('painted craters are marks only: the terrain under them is the same', () => {
  const m = MAPS.find((x) => x.craters?.length > 0);
  const map = loadMap(mapData(m));
  const bare = loadMap({ ...mapData(m), craters: [] });
  for (const c of m.craters) {
    for (const [dx, dy] of [[0, 0], [c.r / 2, 0], [0, -c.r / 2]]) {
      assert.deepEqual(at(map, c.x + dx, c.y + dy), at(bare, c.x + dx, c.y + dy));
      assert.equal(at(map, c.x + dx, c.y + dy).type, FLAT);
    }
  }
});
