// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The camera over the wrapping map (spec 10, The camera). Positions
// here are in pixels on the screen's map: x across, and y up and down
// the oblique view (a point's y less half its altitude). The camera is
// the point at the center of the main view.
//
// - Scrolling moves it at once, and stops a glide or a tracking camera.
// - Centering glides there over about 0.7 s, speeding up then slowing
//   down, the short way around.
// - Tracking keeps a moving target near the center, catching up
//   smoothly; once the target ends, it finishes the move to where it
//   ended and stops.
// - Snap Back: where the view was before tracking first moved it, until
//   the player moves the view themselves.

export const GLIDE_MS = 700;
// Tracking closes this share of the gap every TRACK_MS: smooth, but it
// catches up quickly.
export const TRACK_MS = 90;
// With Steady Camera, tracking waits until the target is this share of
// the way from the center to the view's edge.
export const STEADY_EDGE = 0.8;

// The short way from a to b on a wrapping axis.
export function wrapDelta(a, b, size) {
  let d = (b - a) % size;
  if (d < 0) d += size;
  if (d > size / 2) d -= size;
  return d;
}

export const wrapPx = (v, size) => ((v % size) + size) % size;

const ease = (t) => t * t * (3 - 2 * t);

export class Camera {
  constructor(size, x = 0, y = 0) {
    this.size = size;
    this.x = wrapPx(x, size);
    this.y = wrapPx(y, size);
    this.width = 800; // the main view, in pixels
    this.height = 600;
    this.glide = null;
    this.track = null;
    this.snap = null; // where to go back to, for Snap Back
  }

  setView(width, height) {
    this.width = width;
    this.height = height;
  }

  // The player scrolls by hand.
  scrollBy(dx, dy) {
    this.glide = null;
    this.track = null;
    this.snap = null;
    this.moveTo(this.x + dx, this.y + dy);
  }

  moveTo(x, y) {
    this.x = wrapPx(x, this.size);
    this.y = wrapPx(y, this.size);
  }

  // Jumps, as when the hot seat passes to another player.
  jumpTo(x, y) {
    this.glide = null;
    this.track = null;
    this.snap = null;
    this.moveTo(x, y);
  }

  // Glides there; stops any tracking.
  centerOn(x, y) {
    this.snap = null;
    this.glideTo(x, y);
  }

  glideTo(x, y) {
    this.track = null;
    this.glide = {
      fromX: this.x,
      fromY: this.y,
      dx: wrapDelta(this.x, x, this.size),
      dy: wrapDelta(this.y, y, this.size),
      ms: 0,
    };
  }

  get gliding() {
    return this.glide !== null;
  }

  get tracking() {
    return this.track !== null;
  }

  // Starts following a target. `where()` gives its position, or null
  // while it can't be followed yet (hidden in the fog). `steady` is the
  // Steady Camera preference.
  follow(where, { steady = false } = {}) {
    this.glide = null;
    if (!this.snap) this.snap = { x: this.x, y: this.y, moved: false };
    this.track = { where, steady, started: !steady, last: null, ended: false, moved: false };
  }

  // The target has ended at its last known position: finish there.
  endFollow(last = null) {
    if (!this.track) return;
    if (last) this.track.last = last;
    this.track.ended = true;
    // A target never seen leaves the camera where it is.
    if (!this.track.last) this.track = null;
  }

  stopFollow() {
    this.track = null;
  }

  // Time passes. Returns true if the camera moved.
  update(ms) {
    if (this.glide) {
      const g = this.glide;
      g.ms += ms;
      const t = Math.min(1, g.ms / GLIDE_MS);
      const e = ease(t);
      this.moveTo(g.fromX + g.dx * e, g.fromY + g.dy * e);
      if (t >= 1) this.glide = null;
      return true;
    }
    if (!this.track) return false;
    const tr = this.track;
    if (!tr.ended) {
      const p = tr.where();
      if (p) tr.last = p;
    }
    if (!tr.last) return false;
    const dx = wrapDelta(this.x, tr.last.x, this.size);
    const dy = wrapDelta(this.y, tr.last.y, this.size);
    if (!tr.started) {
      // Steady Camera: still until the target nears the edge.
      const near = Math.abs(dx) > (this.width / 2) * STEADY_EDGE || Math.abs(dy) > (this.height / 2) * STEADY_EDGE;
      if (!near) {
        if (tr.ended) this.track = null;
        return false;
      }
      tr.started = true;
    }
    const k = 1 - Math.exp(-ms / TRACK_MS);
    if (tr.ended && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      this.moveTo(tr.last.x, tr.last.y);
      this.track = null;
      if (this.snap) this.snap.moved = true;
      return true;
    }
    this.moveTo(this.x + dx * k, this.y + dy * k);
    if (this.snap) this.snap.moved = true;
    return true;
  }

  // The turn has passed: with Snap Back, the view goes back to where the
  // player had it, if tracking moved it.
  snapBack(enabled) {
    const snap = this.snap;
    this.snap = null;
    if (!enabled || !snap?.moved) return false;
    this.glideTo(snap.x, snap.y);
    return true;
  }
}
