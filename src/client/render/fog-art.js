// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The fog as a picture (spec 08, What players see): black where hidden
// and clear where visible. Each fog cell is FOG_SUB pixels across. A
// pixel's darkness comes from blending the four nearest cells, then
// sharpening that blend into a narrow edge, so the fog's edge is soft
// and rounded, not a grid of squares, without a wide blur. A border of
// one cell, copied from the far side, keeps the edge smooth where the
// map wraps.

export const FOG_SUB = 4;
// The blend's range that becomes the edge: below EDGE_LOW it's clear,
// above EDGE_HIGH it's fully dark.
const EDGE_LOW = 0.3;
const EDGE_HIGH = 0.7;

// Fills `out` (RGBA, (cells + 2) * FOG_SUB pixels square) from a side's
// counts. `alpha` is how dark hidden cells are, 0 to 255.
export function fogPixels(counts, cells, out, alpha = 255) {
  const w = cells + 2;
  // Each cell's darkness, 0 or 1, with the border.
  const dark = new Float32Array(w * w);
  for (let j = 0; j < w; j++) {
    const cy = (j - 1 + cells) % cells;
    for (let i = 0; i < w; i++) {
      const cx = (i - 1 + cells) % cells;
      dark[j * w + i] = counts[cy * cells + cx] > 0 ? 0 : 1;
    }
  }
  const n = w * FOG_SUB;
  const span = EDGE_HIGH - EDGE_LOW;
  for (let J = 0; J < n; J++) {
    // Where this pixel's middle falls, measured between cell middles.
    const v = (J + 0.5) / FOG_SUB - 0.5;
    const j0 = Math.max(0, Math.min(w - 1, Math.floor(v)));
    const j1 = Math.min(w - 1, j0 + 1);
    const fy = Math.max(0, Math.min(1, v - j0));
    for (let I = 0; I < n; I++) {
      const u = (I + 0.5) / FOG_SUB - 0.5;
      const i0 = Math.max(0, Math.min(w - 1, Math.floor(u)));
      const i1 = Math.min(w - 1, i0 + 1);
      const fx = Math.max(0, Math.min(1, u - i0));
      const top = dark[j0 * w + i0] * (1 - fx) + dark[j0 * w + i1] * fx;
      const bottom = dark[j1 * w + i0] * (1 - fx) + dark[j1 * w + i1] * fx;
      let d = (top * (1 - fy) + bottom * fy - EDGE_LOW) / span;
      d = d <= 0 ? 0 : d >= 1 ? 1 : d * d * (3 - 2 * d);
      const o = (J * n + I) * 4;
      out[o] = 0;
      out[o + 1] = 0;
      out[o + 2] = 0;
      out[o + 3] = Math.round(d * alpha);
    }
  }
  return out;
}
