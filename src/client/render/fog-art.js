// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The fog as a picture (spec 08, What players see): black where hidden
// and clear where visible. Each fog cell is FOG_SUB pixels across, and
// the screen draws the pixels sharp. A pixel's darkness comes from
// blending the four nearest cells; across the edge that blend is
// dithered, a fixed pattern of dark and clear dots, so the fog's edge is
// soft and rounded, not a grid of squares, and not blurred. A border of
// one cell, copied from the far side, keeps the edge right where the
// map wraps.

export const FOG_SUB = 8;
// The blend's range that becomes the dithered edge.
const EDGE_LOW = 0.15;
const EDGE_HIGH = 0.85;
// A 4 × 4 ordered dither pattern: a dot is dark where the edge's
// darkness is above its threshold.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// For each pixel along a row or column: the cell before it, and how far
// it is toward the next, measured between cell middles.
const steps = new Map();
function stepsFor(w) {
  let s = steps.get(w);
  if (!s) {
    const n = w * FOG_SUB;
    s = { at: new Int32Array(n), f: new Float32Array(n) };
    for (let I = 0; I < n; I++) {
      const u = (I + 0.5) / FOG_SUB - 0.5;
      const i0 = Math.max(0, Math.min(w - 2, Math.floor(u)));
      s.at[I] = i0;
      s.f[I] = Math.max(0, Math.min(1, u - i0));
    }
    steps.set(w, s);
  }
  return s;
}

// Fills `out` (RGBA, (cells + 2) * FOG_SUB pixels square) from a side's
// counts. `alpha` is how dark hidden cells are, 0 to 255.
export function fogPixels(counts, cells, out, alpha = 255) {
  const w = cells + 2;
  // Each cell's darkness, 0 or 1, with the border.
  const dark = new Uint8Array(w * w);
  for (let j = 0; j < w; j++) {
    const cy = (j - 1 + cells) % cells;
    for (let i = 0; i < w; i++) {
      const cx = (i - 1 + cells) % cells;
      dark[j * w + i] = counts[cy * cells + cx] > 0 ? 0 : 1;
    }
  }
  const n = w * FOG_SUB;
  const { at, f } = stepsFor(w);
  const span = EDGE_HIGH - EDGE_LOW;
  for (let J = 0; J < n; J++) {
    const j0 = at[J];
    const fy = f[J];
    const row0 = j0 * w;
    const row1 = row0 + w;
    const bayerRow = (J & 3) * 4;
    let o = J * n * 4 + 3;
    for (let I = 0; I < n; I++, o += 4) {
      const i0 = at[I];
      const a = dark[row0 + i0];
      const b = dark[row0 + i0 + 1];
      const c = dark[row1 + i0];
      const d = dark[row1 + i0 + 1];
      // Away from an edge: all dark or all clear.
      if (a === b && a === c && a === d) {
        out[o] = a ? alpha : 0;
        continue;
      }
      const fx = f[I];
      const v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      const e = (v - EDGE_LOW) / span;
      out[o] = e > BAYER[bayerRow + (I & 3)] ? alpha : 0;
    }
  }
  return out;
}
