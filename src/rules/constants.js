// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chad Johnson

// The exact values the rules use. Where the spec gives a target, the
// value here is our choice near it, and the comment names the target.
// Once chosen, these are part of the rules: changing one means bumping
// RULES_VERSION.

import { PX, VEL, ONE, px } from './math/fixed.js';

// Time (README; decision D17).
export const TICKS_PER_SECOND = 30;

// The map (spec 02).
export const TILE = px(60); // tiles about 60 px
export const MAP_SIZES = Object.freeze([32, 40, 48, 56, 64]); // in tiles: 1,920 to 3,840 px (D17)

// Terrain levels (spec 02, Levels).
export const WATER = 0;
export const GROUND = 1;
export const PLATEAU = 2;
export const MOUNTAIN = 3;

// Terrain types at a point (spec 02, Terrain).
export const FLAT = 0;
export const SLOPE = 1;
export const WET = 2;

// Slopes (spec 02, Slopes; decision D23).
export const SLOPE_WIDTH = px(40); // about 40 px straight across
export const SHORE_WIDTH = px(15); // about 10 to 20 px
export const BUMP_CELL = px(6); // spacing of the rocky bumps; divides a tile
export const BUMP_HEIGHT = px(2); // the bumps rise or dip up to this much

// Launching and flight (spec 01; decisions D22, D25). Velocities are in
// VEL units per tick, accelerations in VEL units per tick per tick.
// Tuned with tools/calibrate.js.
export const HEADING_STEPS = 360; // a shot follows the aim in whole degrees
export const POWER_MAX = 1000; // power runs from 0 to this
export const LAUNCH_CLEARANCE = px(2); // shots start just above the launcher's top
export const GRAVITY = 14928; // about 205 px/s²
export const DRAG = 345; // per tick, in ONE units: about 0.16 of the speed per second
// Per-axis launch speed at the lowest and highest power. At 45°, the
// shot climbs and moves across the ground at the same speed.
export const OUTPOST_SPEED_MIN = 212000;
export const OUTPOST_SPEED_MAX = 540000;
export const BATTERY_SPEED_MIN = 212000;
export const BATTERY_SPEED_MAX = 752000;

// Wind (spec 01, Wind; decision D17). Strong is tuned; Light and Medium
// are about a third and two thirds of it.
export const WIND_NONE = 0;
export const WIND_LIGHT = 1;
export const WIND_MEDIUM = 2;
export const WIND_STRONG = 3;
export const STRONG_PUSH = 6407; // about 88 px/s²
export const STRONG_DRIFT = 148600; // about 68 px/s
export const WIND_SHARE = Object.freeze([0, ONE / 3, (2 * ONE) / 3, ONE].map(Math.round));
export const MEDIUM_VARIATION = Math.round(ONE * 0.15); // Medium varies by up to ±15%
// A shot moving sideways slower than this isn't pushed.
export const WIND_MIN_SPEED = Math.round((5 * VEL) / TICKS_PER_SECOND); // about 5 px/s

export { PX, VEL, ONE };
