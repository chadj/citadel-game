// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// sin and cos of whole degrees, in ONE units, from a committed table.
// Headings follow spec 01: 0° points east (+x), and angles grow
// clockwise on screen, because y points south.

import { SIN_TABLE } from './trig-table.js';

export function normDeg(d) {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

export function sinDeg(d) {
  return SIN_TABLE[normDeg(d)];
}

export function cosDeg(d) {
  return SIN_TABLE[normDeg(d + 90)];
}
