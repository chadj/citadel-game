// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The fog as a picture (spec 08, What players see): one pixel per fog
// cell, black where hidden and clear where visible. The screen stretches
// it over the map with smooth filtering, so the fog's edge looks soft,
// not like a grid of squares. A border of one cell, copied from the far
// side, keeps the edge smooth where the map wraps.

// Fills `out` (RGBA, (cells + 2) pixels square) from a side's counts.
// `alpha` is how dark hidden cells are, 0 to 255.
export function fogPixels(counts, cells, out, alpha = 255) {
  const w = cells + 2;
  for (let j = 0; j < w; j++) {
    const cy = (j - 1 + cells) % cells;
    for (let i = 0; i < w; i++) {
      const cx = (i - 1 + cells) % cells;
      const o = (j * w + i) * 4;
      out[o] = 0;
      out[o + 1] = 0;
      out[o + 2] = 0;
      out[o + 3] = counts[cy * cells + cx] > 0 ? 0 : alpha;
    }
  }
  return out;
}
