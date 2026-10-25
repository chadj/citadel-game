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

// Slopes (spec 02, Slopes, Landforms; decisions D23, D55).
export const SLOPE_WIDTH = px(40); // about 40 px straight across
export const CLIFF_INSET = px(3); // a cliff's top lies this far in from its high corners
export const SHORE_WIDTH = px(15); // about 10 to 20 px

// Water's shapes (spec 02, Landforms; decision D55).
export const CHANNEL_HALF = px(15); // channels about half a tile wide
export const POND_RADIUS = px(14); // a small round pond inside one tile
export const LAKE_BIAS = px(2); // joins water across opposite corners
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

// Energy, in tenths (spec 00, Energy; spec 03; decision D1).
export const TENTHS = 10;
export const START_ENERGY = 110; // 11
export const ENERGY_CAP = 350; // 35
export const CITADEL_INCOME = 70; // 7
export const VENT_EXTRACTOR_INCOME = 30; // 3
export const EXTRACTOR_INCOME = 10; // 1
export const TIMEOUT_COST = 10; // 1
export const CITADEL_BONUS = 70; // 7
export const MIN_TO_PLAY = 10; // below 1, a player can't afford anything

// The shot clock (spec 03, The shot clock; decision D28). Times are in
// milliseconds: the rules set each turn's limit, and whoever keeps the
// time (spec 12) applies it.
export const CLOCK_SETTINGS = Object.freeze([0, 15, 30, 60]); // seconds; 0 is off
export const CLOCK_GRACE = 110; // percent of the setting: about 10% more
export const CLOCK_SHRINK = 75; // percent of the last turn's limit, for back-to-back turns
export const CLOCK_MIN = 10000; // about 10 seconds
export const NO_LAUNCHER_LIMIT = 10000; // about 10 seconds
export const CLOCK_START_DELAY = 1500; // about 1.5 seconds into the turn
export const CLOCK_WARNING = 75; // percent of the limit gone

// Players (spec 00, Players and setup; spec 12).
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_COMPUTERS = 3;
export const FACTIONS = 4;
export const COLORS = 6;

// Shots in the air (spec 06, Shots in the air; spec 05, As the building
// comes down; decision D17).
export const SHOT_RADIUS = px(3);
export const FULL_FOOTPRINT_DELAY = 6; // ticks after the top of the arc: about 0.2 s

// Conduits (spec 05; decision D31).
export const NODE_SPACING = px(15); // about 15 px apart
// The first node lies this far beyond the launcher's footprint. With the
// 12 px clearance, it makes two conduits from one Outpost break at about
// 20° apart, and the warning come on at about 30° (spec 05).
export const CONDUIT_START_GAP = px(20);
export const NODE_CLEARANCE = px(12); // nodes of different conduits
export const WARNING_DISTANCE = px(18); // about 30° at the first node
export const LANDING_CLEARANCE = px(3); // "a few pixels" from a landing building's footprint
// Nodes trail behind the building, more so as it comes down: by its
// falling speed times this many ticks, up to the most.
export const NODE_TRAIL_TICKS = 2;
export const NODE_TRAIL_MAX = px(20);
export const BURN_TICKS = 6; // about 0.2 s per node
export const PONTOON_FALL_DELAY = 9; // "a moment" before conduits fall in: about 0.3 s

// Shot explosions (spec 06, Shot explosions, Weapons; decision D32).
// Radii are measured to a unit's edge. Damage is in tenths.
export const SHELL_DAMAGE = 30;
export const SHELL_DIRECT = px(40);
export const SHELL_GROUND = px(30);
export const FRAGMENT_DAMAGE = 15;
export const FRAGMENT_DIRECT = px(40);
export const FRAGMENT_GROUND = px(20);
export const PULSE_DAMAGE = 20;
export const PULSE_RADIUS = px(30);
export const PULSE_REACH = px(200); // disables, across the ground
export const PULSE_DELAY = 45; // about 1.5 s after landing
export const SURGE_DAMAGE = 30;
export const SURGE_DIRECT = px(40);
export const SURGE_GROUND = px(30);
export const SURGE_TICKS_PER_NODE = 4; // about 7 nodes a second
export const SURGE_FADE_NODES = 50; // nothing is left after about 50 nodes
export const WORM_REACH = px(50); // in 3D
export const WORM_DAMAGE = 10;
export const WORM_FLOOR = 1; // the Worm never takes a unit below 0.1
export const REPAIR_AMOUNT = 10;
export const REPAIR_REACH = px(30);
export const SALVAGE_REACH = px(20);
export const SALVAGE_ENEMY_MAX = 30; // up to 3 from an enemy, or a unit with a Worm
export const SALVAGE_STEP = 10; // 1 armor
export const SALVAGE_TICKS = 30; // about every second

// Splitting shots (spec 06, Scatter Shell, Proximity Charges).
export const SCATTER_SPREAD = 20; // degrees to either side
export const CHARGES_SPREAD = 35;
export const SPLIT_SPEEDUP = Math.round(ONE * 1.1); // "a little faster"

// The Seeker (spec 06, Seeker; decision D17).
export const SEEKER_RANGE = px(240); // across the ground
export const SEEKER_STEER_TICKS = 30; // steering grows to full over about 1 s
export const SKIM_HEIGHT = px(1); // above dry ground while homing
// It homes at least this fast, so it always reaches its target: about 200 px/s.
export const SEEKER_MIN_SPEED = Math.round((200 * VEL) / TICKS_PER_SECOND);

// Blasts (spec 04, When a unit is destroyed; spec 06, Blasts).
export const EXTRACTOR_BLAST = Object.freeze({ damage: 50, radius: px(150), delay: 24 }); // 0.8 s
export const CHARGE_BLAST = Object.freeze({ damage: 30, radius: px(90), delay: 15 }); // 0.5 s
export const ROVER_BLAST = Object.freeze({ damage: 40, radius: px(180), delay: 30 }); // 1 s

// Barriers (spec 04 Barrier; spec 06 Barriers).
export const DOME_RADIUS = px(160);

// Proximity Charges (spec 04, spec 06).
export const CHARGE_TRIGGER = px(90); // in 3D
export const CHARGE_NODE_CLEARANCE = px(15);

// Interceptors (spec 04, spec 06; decision D33). Speeds in VEL units per
// tick. Tuned with tools/calibrate-missile.js.
export const INTERCEPTOR_RANGE = px(180); // across the ground
export const MISSILE_DELAY = 9; // about 0.3 s
export const MISSILE_ACCEL = 65000; // per tick: about 900 px/s²
export const MISSILE_MAX_SPEED = 1500000; // about 690 px/s
export const MISSILE_CATCH = px(4);

// The Sky Probe's stop (spec 04, spec 06; decision D34). Offsets in
// position units.
export const PROBE_STOP_TICKS = 45; // about 1.5 s
export const PROBE_DEPLOY_TICK = 4; // it takes its full footprint here
export const PROBE_DIP_TICKS = 8;
export const PROBE_DIP = px(6);
export const PROBE_RISE = px(33); // it ends a bit above the top of its arc

// Rovers (spec 04 Rover; spec 06 Rover; spec 07; decisions D9, D13,
// D36).
export const ROVER_LAND_NODE = px(12); // it explodes landing this near a conduit node
export const ROVER_REACH = px(20); // from another unit's edge
export const ROVER_UNDERWATER = px(10); // below the surface
export const ROVER_DRIVE = px(300); // a round's drive
export const ROVER_DRIVE_TICKS = 40; // about 1.3 s
export const ROVER_SUBSTEPS = 4; // checks per tick, so it stops close to where it first comes in reach
export const ROVER_NODE_REACH = px(12);
export const ROVER_UNIT_PAUSE = 30; // about 1 s before it explodes at an enemy unit
export const ROVER_CONDUIT_PAUSE = 21; // about 0.7 s at an enemy conduit

// Fog of war (spec 08; decisions D10, D11, D17, D37). Sight is in
// position units.
export const FOG_CELL = px(30);
export const NODE_SIGHT = px(130);
export const SPIRE_SIGHT = px(500);
export const SIGHT_MAX = px(500);
export const GROUND_SIGHT_MAX = px(480); // nothing on the ground but a Spire sees further
// The unit curve: [altitude of its top, sight], in pixels, joined by
// straight lines, and rising 1.5 px per px above the last point.
export const UNIT_SIGHT_CURVE = Object.freeze([[10, 130], [20, 200], [55, 250], [90, 300]]);
// Sky Probes: 200 px at a top of 50, rising to 500 at the 250 of a
// full-power float.
export const PROBE_SIGHT_CURVE = Object.freeze([[50, 200], [250, 500]]);
// Shots and missiles: 130 px at the ground, rising to 500 at about 300,
// the top of a high Battery shot.
export const SHOT_SIGHT_CURVE = Object.freeze([[0, 130], [300, 500]]);
export const LINGER_TICKS = 30; // a weapon's view stays about 1 s after it lands
// The oblique view: what's revealed is centered this share of the
// revealer's altitude up the screen, which is toward smaller y. The
// screen uses the same value.
export const OBLIQUE = ONE / 2;

export { PX, VEL, ONE };
