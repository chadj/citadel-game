// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// From the rules' positions to the screen's map (spec 01, The view). The
// view is oblique: a point is drawn up the screen by half its altitude,
// the same share the fog uses (constants.js, OBLIQUE). Things are drawn
// from their real altitude, not their height above the ground.

import { PX, ONE, OBLIQUE } from '../../rules/constants.js';

export const LIFT = OBLIQUE / ONE;

export const toPx = (v) => v / PX;

// A point on the screen's map, in pixels.
export function lift(x, y, z = 0) {
  return { x: x / PX, y: (y - Math.max(0, z) * LIFT) / PX };
}

// Where the point at map pixels (mx, my) is drawn in a view of
// width × height centered on the camera: every copy that could show,
// since a wide screen may see the same spot twice on a small map.
export function screenCopies(cam, mx, my, margin = 64) {
  const size = cam.size;
  const out = [];
  const left = cam.x - cam.width / 2;
  const top = cam.y - cam.height / 2;
  let sx0 = mx - left;
  sx0 -= Math.floor(sx0 / size) * size;
  let sy0 = my - top;
  sy0 -= Math.floor(sy0 / size) * size;
  for (let sx = sx0 - size; sx < cam.width + margin; sx += size) {
    if (sx < -margin) continue;
    for (let sy = sy0 - size; sy < cam.height + margin; sy += size) {
      if (sy < -margin) continue;
      out.push([sx, sy]);
    }
  }
  return out;
}

// The one copy nearest the view's center.
export function screenAt(cam, mx, my) {
  let dx = (mx - cam.x) % cam.size;
  if (dx < -cam.size / 2) dx += cam.size;
  if (dx > cam.size / 2) dx -= cam.size;
  let dy = (my - cam.y) % cam.size;
  if (dy < -cam.size / 2) dy += cam.size;
  if (dy > cam.size / 2) dy -= cam.size;
  return [cam.width / 2 + dx, cam.height / 2 + dy];
}

// The map pixel under a point of the view.
export function mapAt(cam, sx, sy) {
  const size = cam.size;
  const x = cam.x - cam.width / 2 + sx;
  const y = cam.y - cam.height / 2 + sy;
  return { x: ((x % size) + size) % size, y: ((y % size) + size) % size };
}
