# Decisions

Answers to questions the spec left open, and our designs for its
"Choice:" items. One entry each: the date, the spec section, the
question, and what was decided.

Entries marked **Ours** were left to the implementation by the user
on 2026-10-25. Exact numbers chosen during tuning go in
`src/rules/constants.js`, with a pointer back to the entry here.

## D1. Rounding fractions — Ours
- **Date:** 2026-10-25
- **Spec:** 00 Energy; 04 What every unit has; 06 Scatter Shell, Surge
- **Question:** How are fractional energy, armor and damage rounded?
- **Decision:** Energy, armor and damage are whole numbers of tenths
  in the rules. Every result that isn't a whole tenth rounds down to
  one decimal place, as the spec's 0.7 fragment does. For example, a
  Surge 1 node back does 3 × (1 − 1/50) = 2.94 → 2.9.

## D2. How turn cycles are counted — Ours
- **Date:** 2026-10-25
- **Spec:** 03 Turn cycles; 04 Extractor; 06 Turn cycles used here
- **Question:** How exactly is "gone all the way around the table and
  moved past the seat" counted, including back-to-back turns and the
  change of round?
- **Decision:**
  - Play is tracked as a pointer that moves seat by seat around the
    fixed seating order. Empty seats (out of the round or the game,
    disconnected) are walked over like any other seat.
  - An effect is tied to the seat whose turn it started in. It ends
    the next time the pointer leaves that seat after a full lap.
  - Every change of turn moves the pointer at least one seat. So when
    one player takes back-to-back turns, the pointer makes a full lap
    between them.
  - When a round ends, the pointer walks forward from the last seat
    played to the next round's first player, and ends any effects it
    passes. That happens after income is paid (spec 03, 04), and
    before the next round starts.
  - When an effect ends as the pointer leaves seat S, and that starts
    a new effect (a Worm spreading), the new effect is tied to S. So
    it lasts exactly one more lap.

## D3. Stacking disables — Ours
- **Date:** 2026-10-25
- **Spec:** 06 Pulse, Worm
- **Question:** What happens when a disable lands on a unit that's
  already disabled?
- **Decision:**
  - Disables don't add up, except where the spec says so. A new
    disable (Pulse, or an Interceptor reloading) ends at whichever is
    later: its own end or the end already set.
  - The one exception is from the spec: a Pulse on a unit with a Worm
    pushes both the disable and the Worm's spreading back by one turn
    cycle.
  - A Worm that reaches a unit disabled by a Pulse infects it as
    usual. The infection runs its own turn cycle, and spreads when
    that ends. The unit stays disabled until both the infection and
    the Pulse disable have ended.
  - A newer Worm that takes over a unit restarts that unit's
    infection: a full turn cycle from the takeover.

## D4. A Pontoon on a tile that's only partly water — Ours
- **Date:** 2026-10-25
- **Spec:** 02 Pontoons; 06 Pontoon
- **Question:** A Pontoon lands well if the exact point is water. What
  happens to any dry or shore part of the tile, and to a tile whose
  center is dry?
- **Decision:** The Pontoon always moves to the tile's center. The
  whole tile, dry parts included, counts as flat ground at the
  Pontoon's top while the Pontoon stands. When it's destroyed, every
  point of the tile goes back to the terrain it had before.

## D5. A conduit that breaks while its building is still flying — Ours
- **Date:** 2026-10-25
- **Spec:** 05 Laying the conduit, Conduits that break
- **Question:** If a node breaks the conduit while the building is
  still in the air, what happens?
- **Decision:** No more nodes are laid after the break. The burn runs
  both ways from the breaking node, as usual. The building finishes
  its flight, and its landing fails when it comes down (or earlier,
  if something in the air stops it). It never becomes a working unit.

## D6. What "a node on top of a unit" includes — Ours
- **Date:** 2026-10-25
- **Spec:** 05 Conduits that break; 02 Pontoons
- **Question:** Which units break a conduit when a node settles on
  them?
- **Decision:** Any unit, measured by its footprint, except two: a
  Pontoon, because its tile is ground that conduits may cross, and the
  conduit's own building.

## D7. A floating Sky Probe's height span — Ours
- **Date:** 2026-10-25
- **Spec:** 04 What every unit has, Sky Probe; 08 How far things see
- **Question:** A Sky Probe never lands. What are its base and top?
- **Decision:** Its base is the altitude where it stops. Its top is
  its base plus its height (about 50 px). Hits, explosions, blasts
  and sight all use that span.

## D8. Shot explosions and underwater Rovers
- **Date:** 2026-10-25
- **Spec:** 09 Against Rovers (as updated); 06 Shot explosions
- **Question:** Do shot explosions reach an underwater Rover?
- **Decision:** Answered by the spec update: an underwater Rover is
  hard to shoot, not immune. Shot explosions use the normal height
  rule (D17), so one on nearby low ground can reach it. Shots that
  land on the water itself splash.

## D9. A Rover landing "close to an enemy unit" — Ours
- **Date:** 2026-10-25
- **Spec:** 04 Rover; 06 Rover; 07 What stops it
- **Question:** Do Pontoons and Sky Probes count when a Rover lands?
- **Decision:** No. They're left out, as they are while it drives.

## D10. Sight curves
- **Date:** 2026-10-25
- **Spec:** 08 How far things see (as updated)
- **Question:** How does sight grow with altitude?
- **Decision:**
  - **Units** follow one curve on the altitude of their top. It's
    piecewise linear, through about: top ≤ 10 → 130 px, 20 → 200,
    55 → 250, 90 → 300. It continues upward and stays below 500 for
    any ground unit. So a Rover or Pontoon standing high sees further
    than 130 (spec update).
  - **A Sky Probe** has its own curve, reaching 500 px at a full-power
    float.
  - **A Spire** sees a fixed 500 px. Nothing on the ground sees
    further.
  - **A conduit node** sees a fixed 130 px. The spec says it "reveals
    the smallest area", and nodes aren't units.
  - **Shots and Interceptor missiles** have their own curve, from
    130 px near the ground to 500 px at the top of a high Battery
    shot.
  - The oblique-view factor that moves revealed areas up the screen is
    a rules constant, shared by the drawing code.

## D11. Which conduit nodes reveal
- **Date:** 2026-10-25
- **Spec:** 05 Conduit lights; 08 What reveals the map; 12 The game
  state (as updated)
- **Question:** Which "one node in five" reveals the fog?
- **Decision:** On each conduit, counted from the launcher: the 5th,
  10th, 15th node, and so on. It's counted per conduit, with no
  counter shared between conduits.

## D12. When a new Barrier comes up — Ours
- **Date:** 2026-10-25
- **Spec:** 04 Barrier; 05 Landing
- **Question:** "When the turn passes to the next player": does that
  include back-to-back turns, and the change of round?
- **Decision:** It comes up at the next change of turn of any kind,
  including a turn to the same player and the first turn of the next
  round.

## D13. A driving Rover's pause before exploding — Ours
- **Date:** 2026-10-25
- **Spec:** 04 When a unit is destroyed; 07 What stops it
- **Question:** Does the ~1 s (or ~0.7 s) pause come before the ~1 s
  blast delay, or is it the same delay?
- **Decision:** It's the same delay. The Rover stops, is destroyed
  after the stated pause, and blasts at that moment.

## D14. How long a Worm infection lasts — Ours
- **Date:** 2026-10-25
- **Spec:** 06 Worm
- **Question:** "About one turn cycle": is it exactly one?
- **Decision:** Exactly one turn cycle (D2), unless a Pulse extends it
  (D3).

## D15. Interceptor missiles, Charges and units — Ours
- **Date:** 2026-10-25
- **Spec:** 06 Interceptors
- **Question:** Does a missile set off Charges, or hit units?
- **Decision:** No. A missile reacts only to its target shot and to
  Barrier domes.

## D16. Start positions and teams — Ours
- **Date:** 2026-10-25
- **Spec:** 02 Start positions; 12 Teams
- **Question:** How does the random choice of start positions respect
  teams?
- **Decision:** For each player count and team layout, a map lists its
  start positions in groups, one group per team. At the start, the
  teams are given groups at random, and players within a team are
  given that group's positions at random. Players on no team each get
  a group of one.

## D17. Targets the spec gives no number for — Ours
- **Date:** 2026-10-25
- **Spec:** 01, 02, 05, 06, 07 (as noted)
- **Question:** What values do we use where the spec gives none?
- **Decision:** Starting values, to be tuned by playing:

  | Item | Value |
  |---|---|
  | Tick rate (README) | 30 ticks a second |
  | A shot's radius (06) | 3 px |
  | "A few pixels" between a landing building and another conduit's nodes (05) | 3 px |
  | A building's size before it takes its full footprint (05) | The same as a shot |
  | Falling conduit nodes (05) | Straight down, at the shots' gravity |
  | How far above or below a shot explosion reaches (06) | A unit is in range if the gap between the explosion's altitude and the unit's base-to-top span is no more than the explosion's radius |
  | The Seeker's "ahead" (06) | Within ±45° of its heading across the ground; the 240 px is measured across the ground |
  | A Rover's "in front" (07) | Within ±45° of its heading |
  | A node settling near an armed Charge (05) | Within 90 px, in 3D |
  | Light and Medium wind (01) | About ⅓ and ⅔ of Strong; Medium varies by up to ±15% |
  | Map sizes (02) | 32, 40, 48, 56 and 64 tiles of 60 px (1,920 to 3,840 px) |
  | Fog cells (08) | 30 px |

## D18. Game end when only computers are left
- **Date:** 2026-10-25
- **Spec:** 03 The end of the game (as updated)
- **Question:** If only computer players are left in the last team,
  who wins?
- **Decision:** Answered by the spec update: that team wins. The
  no-winner ending applies only while two or more teams are still in
  the game and none of their players is a connected human. Chapter 03
  is followed where 00 and 12 still give the older wording (see
  `spec-changes.md`).

## D19. A disconnected player's put-aside energy — Ours
- **Date:** 2026-10-25
- **Spec:** 03 The end of a round, Players who disconnect
- **Question:** What happens to energy a disconnected player had put
  aside?
- **Decision:** It's lost at the next round end. Income, which
  includes put-aside energy, is paid only to connected players (spec
  03). A player who later rejoins doesn't get it back.

## D20. Which machine runs computer players — Ours
- **Date:** 2026-10-25
- **Spec:** 09 Taking part; 12 Every machine plays the same game
- **Question:** In an online game, which machine thinks for each
  computer?
- **Decision:** The server. So computers carry on whoever drops out.
  Against the computer and in hot seat, the local machine thinks for
  them, in a Web Worker.

## D21. Fixed-point numbers in the rules
- **Date:** 2026-10-25
- **Spec:** 12 Every machine plays the same game
- **Question:** How do the rules do arithmetic so every machine gets
  the same result?
- **Decision:** Every number in the game state is a whole number.
  Positions, altitudes and distances are in 1/1024 px. Velocities are
  in 1/65536 px per tick. Fractions and trig values are in 1/65536.
  Divisions round to the nearest whole number, halves away from zero,
  so mirrored shots fly mirrored paths. sin and cos come from a
  committed table of whole degrees (`tools/gen-trig.js`), built from
  0°–90° and mirrored so it's exactly symmetric. Square roots are exact
  integer roots. The rules never use floats in their results, and the
  state hash refuses any number that isn't whole (D27).

## D22. Aim and power in a move
- **Date:** 2026-10-25
- **Spec:** 01 Shots are hard to repeat exactly, Aiming, Power;
  12 Every machine plays the same game (a move holds the heading and
  the power)
- **Question:** What do a move's heading and power hold?
- **Decision:** The heading is a whole degree, 0 to 359: the coarser
  step the shot follows (spec 01). The client's aim can turn more
  finely, and is rounded to a whole degree when the shot fires. The
  power is a whole number from 0 to 1000. The client works it out from
  how many ticks Launch was held (D38).
  The square of the launch speed grows evenly with the power, so the
  distance grows about evenly too.

## D23. How the terrain is built from corners
- **Date:** 2026-10-25; revised 2026-10-26 for Landforms (D55)
- **Spec:** 02 Terrain, Levels, Slopes, Water, Landforms
- **Question:** The spec gives levels per tile and slopes about 40 px
  wide. Where do the slopes lie, and how are corners and shores shaped?
- **Decision** (`src/rules/terrain/terrain.js`):
  - **Corners carry the levels.** Each point where four tiles meet
    sits on one level; a tile's shape follows from its four corners.
    A tile mixes at most two neighboring levels: never three, never
    Ground with Mountain, never water with Plateau.
  - **Cliff pieces.** For each raised level (Plateau, and Mountain on
    top of it), the high ground in a tile is a convex piece whose
    sides run along the grid or at 45°: the top of the cliff crosses
    each tile edge 3 px (`CLIFF_INSET`) in from its high corner. So one
    high corner gives a small triangle (outside corner), two along a
    side a strip (straight edge), three the tile less a triangle cut
    corner to corner (inside corner), two opposite two triangles
    (saddle), four the whole tile (flat). All 16 combinations exist in
    all four facings. Runs of corners stepping across the grid make
    45° cliffs.
  - **Slopes.** The slope runs down from the high ground for 40 px,
    measured as the true (Euclidean) distance to it, computed exactly
    in whole numbers. So it's the same width whichever way it faces,
    rounds outside corners, and flows from one piece into the next with
    no step or gap. Crossed at an angle, it's wider (spec 02, Slopes).
    With the inset this small, a slope never reaches a tile with no
    high corner, so there's always Ground between a cliff and water.
  - **A Mountain's slope** runs down onto the Plateau around it.
  - **The climb** is linear plus rocky bumps up to 2 px, from smooth
    noise on a 6 px grid. The bumps fade out at both edges of the slope.
  - **Water** lies only in tiles with no raised corner, and never
    leaves its own tile. Lakes: the water corners blended across the
    tile, so straight shores, outside corners (water in one corner),
    points of land (land in one, two or three corners, opposite corners
    included, small and rounded). Channels: 30 px wide (`CHANNEL_HALF`
    15 px), running from the middle of the tile to the middle of each
    edge they cross, so straight runs, bends, T-junctions, crossings and
    dead ends (a channel's end is rounded at the tile's middle). Ponds:
    round, 28 px across, in the middle of a tile. Every water's edge is
    a 15 px shore slope at altitude 0. A channel stays inside the
    tiles it crosses, so one Pontoon (D4), which fills its tile, bridges
    it.

## D24. Planet heights
- **Date:** 2026-10-25
- **Spec:** 02 Planets, Levels
- **Question:** How high are each planet's Plateaus and Mountains?
- **Decision:** In px above Ground:

  | Planet | Plateau | Mountain |
  |---|---|---|
  | Tundra | 30 | 55 |
  | Canyon | 40 | 80 |
  | Toxic | 28 | 45 |
  | Glacier | 35 | 65 |
  | Plains | 25 | 38 |
  | Desert | 32 | 60 |

  Canyon's slopes climb about as far as they are wide; Plains' are the
  gentlest (spec 02, Steepness).

## D25. The flight model
- **Date:** 2026-10-25
- **Spec:** 01 The flight, Wind; Appendix A, 01 and 02
- **Question:** What are the tick order and the flight constants?
- **Decision:**
  - Each tick: gravity; then drag on movement across the ground (only
    across the wind, when the wind acts) and the wind's push toward its
    drift speed; then the move, wrapping at the edges; then the landing
    check. Collisions (spec 06) are added after the move.
  - Drag is a fixed share of the speed across the ground each tick.
  - The wind pushes only when the shot moves across the ground faster
    than about 5 px/s, and never past the drift speed.
  - A landing point is found within the tick's move: the move is
    checked in sixteenths, then narrowed by halving.
  - Shots start 2 px above the launcher's top.
  - Tuned values: gravity about 205 px/s², drag about 0.16 of the
    speed per second, Strong push about 88 px/s² with a drift of about
    68 px/s. Measured on flat Ground from a 20 px launcher:

    | Case | Got | Target |
    |---|---|---|
    | Outpost, full power | 503 px, 2.47 s, rises 145 px | 500 px, 2.5 s, 150 px |
    | Outpost, lowest power | 98 px, 1.13 s, rises 21 px | 100 px, 1.2 s, 20 px |
    | Battery, full power | 900 px, 3.40 s, rises 283 px | 900 px, 3.5 s, 300 px |
    | Without drag | 1.21 × as far | about a fifth further |
    | Strong tailwind / headwind | 609 / 338 px | 600 / 350 px |
    | Strong crosswind | 503 along, 143 sideways | 500, 150 |
    | From 75 px above the target | 546 px | 540 px |

  `node tools/calibrate.js` prints this table from the current values.

## D26. The map format
- **Date:** 2026-10-25; revised 2026-10-26 for Landforms (D55)
- **Spec:** 02 (how maps are stored is up to the implementation)
- **Question:** How are maps stored?
- **Decision** (`src/rules/terrain/map.js`): as plain data:
  - a name, a suggested player count and a planet;
  - `corners`: one string per row of corners, north first (`~` Water,
    `.` Ground, `+` Plateau, `^` Mountain). Corner (x, y) is the
    north-west corner of tile (x, y); the map wraps, so there are as
    many corners as tiles;
  - `water` (optional): one string per row of tiles, one character
    each: `.` for none, or a digit adding up 1 (a channel crosses the
    tile's north edge), 2 (its west edge) and 4 (a pond). Each edge
    belongs to one tile, so the tiles on both sides agree;
  - `craters` (optional): painted craters, centers and radii in pixels;
  - the vents' centers in pixels with a size of large, medium or small
    (110, 80 and 45 px across).

  Start positions are listed in groups for each player count and team
  layout (D16), in pixels. Loading a map checks it and lists every
  problem found, including a tile with three levels, Ground with
  Mountain, or water with a cliff.
  - A game's setup holds the map data without the groups, plus
    `positions`: every start position the map offers, which anyone can
    know, without which player got which.
  - Tests and tools can sketch a map tile by tile; each corner then
    takes the highest level of its four tiles.

## D27. State hashing
- **Date:** 2026-10-25
- **Spec:** 12 Determinism checks
- **Question:** How are game states compared?
- **Decision:** The state is plain data. It's written out in a
  canonical form, with object keys sorted and every string prefixed
  with its length, and hashed to 64 bits (two 32-bit FNV-1a lanes).
  Anything that isn't plain data or a whole number is refused.

## D28. Shot clock values
- **Date:** 2026-10-25
- **Spec:** 03 The shot clock; Appendix A, 03
- **Question:** What exact limits does a turn get?
- **Decision:** The rules set each turn's limit, in milliseconds, when
  the turn starts. Whoever keeps the time (spec 12) applies it, and
  sends a timeout move when it runs out.
  - With the clock on: the setting plus 10% (15 → 16.5 s, 30 → 33 s,
    60 → 66 s).
  - A turn that follows the same player's own turn gets 75% of the
    last limit, but never less than 10 s. Any other turn, and the
    first turn of a round, gets the full limit.
  - With the clock off: no limit.
  - A player with no working Outpost or Battery: 10 s, whatever the
    setting.
  - The clock starts 1.5 s into the turn; the warning comes when 75%
    is gone.

## D29. Unit sizes
- **Date:** 2026-10-25
- **Spec:** 04 The units
- **Question:** What exact footprints and heights do units have?
- **Decision:** The spec's targets as they stand, in px, with one
  change: the Interceptor's radius is 18, so the Extractor (20) is the
  widest building with the Interceptor close behind. The Rover is 2 px
  tall ("nearly flat").

  | Unit | Armor | Radius | Height |
  |---|---|---|---|
  | Outpost | 5 | 15 | 20 |
  | Battery | 3 | 15 | 20 |
  | Extractor | 5 | 20 | 20 |
  | Barrier | 3 | 15 | 20 |
  | Interceptor | 3 | 18 | 20 |
  | Spire | 3 | 15 | 100 |
  | Pontoon | 3 | 30 | 10 |
  | Sky Probe | 1 | 15 | 50 |
  | Proximity Charge | 1 | 10 | 20 |
  | Rover | 3 | 5 | 2 |

## D30. Moves, refusals and the turn's phases
- **Date:** 2026-10-25
- **Spec:** 03 A turn; 12 Every machine plays the same game, What a
  replay records
- **Question:** How are moves applied, and what happens to one that
  doesn't count?
- **Decision:**
  - A move is a launch (launcher, item, heading, power), a pass, a
    timeout, or a disconnect. A disconnect can come at any time; the
    others only from the player whose turn it is, while the game waits
    for a move.
  - A move that doesn't count is refused with a reason, and changes
    nothing. Only moves that count go into a replay.
  - After a launch, the game runs a tick at a time until everything
    has settled, then the turn changes hands. No move but a disconnect
    counts meanwhile. Passes and timeouts change the turn at once.
  - Once a player is out for the round, they stay out until the next
    round, even if their energy rises again (for example from a
    Citadel bonus).

## D31. Conduits, building landings and Pontoons
- **Date:** 2026-10-25
- **Spec:** 05 (all of it but the lights and fog); 02 Pontoons; 06
  Shots in the air, Units
- **Question:** The spec gives targets and outcomes for conduits; how
  exactly do they work in the rules?
- **Decision:**
  - **Where the conduit starts.** The first node lies 20 px beyond the
    launcher's footprint, so 35 px from an Outpost's center, exactly on
    the launch heading. With the 12 px clearance between nodes, two
    conduits from one Outpost break below about 20° apart
    (2 × 35 × sin 10° ≈ 12 px). The warning checks for any node of the
    launcher's conduits (in or out) within 18 px of where the new first
    node would lie, which is about 30°. A building launched while the
    warning shows is refused unless the move says `override: true`.
  - **Laying.** The conduit starts on the first tick the building's
    track over the ground is 35 px or more long; the wind starts acting
    on it that same tick. Later nodes lie every 15 px along that track,
    trailing behind the building by its falling speed times 2 ticks, up
    to 20 px. On a good landing the nodes left are laid up to the
    building's footprint.
  - **Nodes** keep their place across the ground and fall straight down
    at the shots' gravity from the altitude they were laid at. A node
    breaks its conduit where it comes to rest on water, inside a unit's
    footprint (not a Pontoon's, a Sky Probe's, or its own building's;
    D6), or within 12 px of a node of another conduit.
  - **A building that comes down before its conduit started** (only
    possible from a much higher launcher) fails.
  - **Collisions in the air** are checked along each tick's move: the
    closest the move comes to a unit's center across the ground, while
    its altitude range overlaps the unit's base to top. Shots are 3 px
    across; a building takes its full footprint 6 ticks (0.2 s) after
    the top of its arc. Pontoons are never struck; a Sky Probe only by
    enemy shots.
  - **Landing checks**, in order: the conduit has broken; water; slope
    (only the exact landing point); another conduit's node within 3 px
    of the footprint. Barriers, Interceptors and Charges come in M4.
  - **Burns.** Each node burns 6 ticks (0.2 s) after the one before it.
    A node already due to burn keeps the earlier time. The building at
    the far end of a burning conduit is destroyed 6 ticks after the last
    node burns, unless it's the building whose destruction started the
    burn. Who gets the credit is whoever was credited with what started
    it; for a break, the player whose turn it is. A building destroyed
    because its own conduit broke has failed its landing; when units
    that explode come in (M4), it won't explode.
  - **The turn waits** while any shot flies, any node falls, or any burn
    is still going.
  - **Pontoons.** A destroyed Pontoon's tile is water at once, and the
    buildings standing on it are destroyed at once, without exploding.
    Each resting node in the tile falls in 9 ticks (0.3 s) later and
    burns both ways from there, which dooms the building at the far
    end. A Pontoon is lost if it comes down on anything but water, or
    in a tile that already holds a Pontoon or a Rover.
  - The user confirmed the Pontoon timing (buildings at once, conduits
    a moment later), reading 02's "at once" with 05's "a moment later".

## D32. Shots in the air, explosions and blasts — Ours
- **Date:** 2026-10-25
- **Spec:** 04 When a unit is destroyed; 06 Shots in the air, Explosions
  and damage, Weapons
- **Question:** In what order are things checked, and how exactly are
  explosions, blasts and domes measured?
- **Decision:**
  - **Each tick, in order:** shots move; Interceptors fire at shots that
    have come into range; missiles move; conduit nodes fall; burns move
    on; waiting effects (blasts, Pulses, Surges, Salvagers) go off;
    buildings reached by burns are destroyed. For each shot: a dome, a
    unit, a Charge, then the ground. Shots go in the order they were
    launched; a Scatter Shell's or Charges' new parts follow.
  - **Domes:** a point is inside if it's no lower than the Barrier's
    base and less than 160 px from the base in 3D. Where a shot or
    missile is stopped is found by halving its move. "Started inside"
    is checked where a shot is launched, and for a missile where it
    leaves its Interceptor.
  - **Shot explosions:** ground gap to the unit's edge ≤ radius, and
    height gap ≤ radius (D17); full damage if the ground gap is at most
    half the radius, else half rounded down to a tenth.
  - **Blasts** start from the exploding unit's center, halfway up, and
    reach a unit if its nearest part is within the radius in 3D.
  - **Where a Charge is measured from:** a shot, landing or node sets
    off the nearest armed Charge whose nearest part is within 90 px in
    3D. A building coming down near one fails with reason 'charge',
    checked before water and slope, so the Charge goes off wherever it
    lands near one.
  - **Splits:** the two outer parts turn by the spread and move 10%
    faster across the ground.
  - **Craters** are only events for the screen; they aren't game state.

## D33. Interceptors — Ours
- **Date:** 2026-10-25
- **Spec:** 04 Interceptor; 06 Interceptors (Choice: which Interceptor
  fires)
- **Decision:**
  - **Which one fires:** of the working enemy Interceptors within 180 px
    across the ground, sorted by id, the one picked by a hash of the
    shot's id and the tick. The same on every machine, not the nearest.
  - **The chase:** after 9 ticks (0.3 s), the missile flies straight at
    where its target is now, speeding up by about 900 px/s² to about
    690 px/s, never below the ground. It catches when it can reach the
    target within its move, plus 4 px. Measured by
    `tools/calibrate-missile.js`: typical chases 0.6–1.0 s, up to about
    1.3 s against shots climbing away near the launcher. Shots that
    come into range only just before they land can get away.
  - **A unit still landing** that the missile reaches is destroyed as a
    failed landing: an Extractor doesn't explode.

## D34. The Sky Probe's stop — Ours
- **Date:** 2026-10-25
- **Spec:** 04 Sky Probe; 06 Sky Probe
- **Decision:** For 45 ticks (1.5 s) from the top of its arc, gravity,
  drag and wind act on its movement across the ground as usual, and its
  speed across the ground is then scaled down evenly to nothing. Its
  altitude follows a fixed curve from the top of its arc: a 6 px dip
  over the first 8 ticks, then an easing rise to 33 px above it. It
  takes its full footprint 4 ticks in. Full power from an Outpost stops
  420 px away at altitude 200; at the lowest power it goes about 110 px,
  further than a Shell.

## D35. Weapon and tool details — Ours
- **Date:** 2026-10-25
- **Spec:** 06 Seeker, Pulse, Surge, Worm, Repair Pod, Salvager
- **Decision:**
  - **Seeker:** each tick from the top of its arc until it locks on, it
    looks for the nearest unit of another side within 240 px across the
    ground and within 45° of its heading (D17). Once locked, its
    velocity is blended toward a straight line at the target's base at
    its present speed (at least about 200 px/s, so it never stalls), by
    a share that grows from 1/30 to all of it over 30 ticks. While
    homing it skims 1 px above dry ground.
  - **Pulse:** goes off 45 ticks (1.5 s) after landing. A unit with a
    Worm has the Worm's end pushed back one lap (N steps) and stays
    disabled until then.
  - **Surge:** 4 ticks a node (7.5 nodes a second). After passing n
    nodes, 3 × (50 − n) / 50 is left, rounded down to a tenth: 1.8 after
    20. A Surge that hits a node counts that node as the first passed,
    both ways. It stops if the next node has burned away. A Surge that
    strikes a unit passes the first node of the conduit into it at
    once, before the unit takes its 3 (user's choice, 2026-10-26). So if
    that destroys the unit, the damage is already ahead of the burn
    (4 ticks a node against the burn's 6) and always reaches the far
    end. Past the last node it hits the unit there even if the conduit
    behind it has burned away since. Rules version 2.
  - **Worm:** a Worm never infects the same unit twice. So two units it
    infected together, with a conduit between them, don't pass it back
    and forth. It spreads only along conduits that have landed and
    aren't burning.
  - **Salvager:** takes 1 armor 30 ticks after landing and every 30
    ticks after. The last take may be less than 1. "About the same
    height" means a height gap of at most 20 px, the same as its reach.
  - **Repair Pod:** a struck unit that isn't damaged doesn't block the
    search for a damaged unit within 30 px.

## D36. Rovers — Ours
- **Date:** 2026-10-25
- **Spec:** 04 Rover; 06 Rover; 07; decisions D8, D9, D13
- **Decision:**
  - **In flight:** a Rover that hits a unit explodes on the spot: a blast
    1 s later at the point it hit. Stopped by a dome or a Charge, or
    caught in the air, it's simply gone. Caught on land, it's destroyed
    and explodes; underwater, the missile gives up.
  - **Landing:** it explodes (a blast 1 s later, where it landed) within
    12 px of any conduit node, or near an armed Charge (which goes off),
    or within 20 px of the edge of an enemy unit or any Rover (not
    Pontoons or Sky Probes). On water it sits 10 px below the surface.
  - **The drive** is a phase of its own at the end of the round, before
    income. Each working Rover goes in turn, in the order they landed,
    and the next starts only once everything has settled. It moves
    300 px over 40 ticks, checked every quarter of a tick's move
    (about 1.9 px), each position worked out from where this round's
    drive started, so it keeps exactly to its heading.
  - **At each position, in spec 07's order:** an enemy unit within 20 px
    of its edge (the Rover moves there, then explodes after the pause);
    a unit of its side within 20 px and within 45° ahead (it stops
    where it was); a conduit node within 12 px (enemy: moves there, then
    explodes after 0.7 s; its side's: stops where it was); an armed
    Charge (moves there and sets it off). Whose conduit it is follows
    the conduit's owner. A driving Rover sets a Charge off when the
    Charge's blast would reach it, so the blast always destroys it.
  - **Credit** while Rovers drive goes to the Rover's owner.

## D37. Fog of war in the rules — Ours
- **Date:** 2026-10-25
- **Spec:** 08; 12 The game state; decisions D10, D11
- **Decision:**
  - **Cells:** 30 px. A cell is revealed by a revealer when the cell's
    center is within its sight. Counts are kept per side, in the state.
  - **Sight curves**, on the altitude of the top in pixels: units
    130 px up to 10, 200 at 20, 250 at 55, 300 at 90, then 1.5 px more
    per px, up to 480. Sky Probes 200 at 50, rising to 500 at 250.
    Shots and missiles 130 at 0, rising to 500 at 300. Spires 500;
    conduit nodes 130.
  - **The oblique shift:** what's revealed is centered half the
    revealer's altitude up the screen (toward smaller y). The client
    draws with the same factor. Conduit nodes aren't shifted.
  - **Lingering:** where a weapon or tool's flight ends, by any means,
    its view stays for 30 ticks (1 s) at the shot's sight there. The
    turn waits for it. With fog off there's nothing to linger.
  - **When it's worked out:** at every turn's start, which is when the
    state is compared and when computer players look. Nothing in the
    rules depends on the fog during a flight, so a screen that shows
    the flight asks for the counts tick by tick. The state at a turn's
    start is the same either way.
  - **Hashing:** fog counts go into the canonical form as one 16-bit
    character per cell (D27).
  - **The fog lifts** for a side with no human player who still has a
    Citadel, unless that side has won.

## D38. Aiming, the meter and the keys on screen — Ours
- **Date:** 2026-10-25
- **Spec:** 01 Shots are hard to repeat exactly, Aiming, Power; 10 The
  launching view, Keys; decision D22
- **Decision:**
  - **Ticks (user's choice, 2026-10-25):** holding an arrow and holding
    Launch both work at the rules' 30 ticks a second, not frame by
    frame. The aim turns and the meter moves once a tick. The coarse
    steps are part of what makes a shot hard to repeat.
  - **The aim** turns in eighths of a degree. A press turns it 1⅛° at
    once. Held, it waits 1 tick (about 30 ms; the user found 0.25 s,
    then 60 ms, too long), then turns at 7.1°/s, rising evenly to
    147°/s over 27 ticks (0.9 s): about 4.9° a tick at full speed
    (speeds the user chose). A shot follows it to
    the nearest whole degree.
  - **The targeting marks** show the heading to the nearest 3°, so two
    aims that look the same can fly a degree or two apart. Besides the
    ring, the heading is one round mark in the player's color, 34 px
    out from the ring (user's choice, 2026-10-25: a line of marks
    pointed too precisely).
  - **The build menu** lists each level's items in three columns. At
    level 1 the weapons (Shell, Scatter Shell, Repair Pod) are the top
    row and the buildings (Interceptor, Spire, Pontoon) the bottom row
    (user's choice, 2026-10-26).
  - **The conduit marker** is a pulsing yellow ring around the
    heading's mark, not marks on the conduit itself (user's choice,
    2026-10-25: marks along the conduit also formed a line). Proposed
    spec wording is in docs/spec-changes.md.
  - **The meter** fills in 38 ticks (about 1.27 s) and empties in 38;
    the power is the share full × 1000, from the ticks Launch was held,
    so there are 38 powers each way. The quickest tap counts as 1 tick
    held (power 26). It shows in 19 steps (the user's
    choice; spec 01 asks for roughly 20): a power of p lights
    ⌈19p / 1000⌉ of them.
  - **Launch** stops the clock when pressed. If the launch is then
    refused, the clock runs again. Launch isn't pressed at all if the
    building's conduit marker shows and isn't overridden.
  - **Override:** the override key, held with Launch. Touch screens
    have no keys, so the launching view also has an Override button
    while the marker shows.
  - **Default keys:** B damage bars, R range circles, C center, E next,
    Q previous, O closest Outpost, A last attacked, T chat, Z and X turn
    the aim, L launch, V override. Every letter can be changed; a
    letter does one thing only.
  - **The meter sits above Launch** (2026-10-28, asked for by the
    user): on a phone, a finger holding Launch would hide a meter below
    it. The aim arrows stay either side of Launch.

## D39. Who sees the launch (Choice) — Ours
- **Date:** 2026-10-25
- **Spec:** 01 What players see (Choice: who sees the launch)
- **Decision:** The charging and the burst show on the launching
  player's screen only. Opponents aren't told that a shot is coming.
  In a hot-seat game everyone shares the screen anyway.

## D40. Screen details — Ours
- **Date:** 2026-10-25
- **Spec:** 10; 03 What players see; 08 What players see; 12 Watching a
  replay; 02 What players see
- **Decision:**
  - **Camera:** a glide takes 0.7 s, easing in and out. Tracking closes
    the gap smoothly (63% every 90 ms). Steady Camera starts following
    once the shot is 80% of the way from the center to the view's edge.
    A drag starts after the pointer moves 8 px. Arrow keys and Edge
    Scrolling (the outer 10 px) scroll at 700 px/s. A click within
    22 px of one of the player's launchers selects it.
  - **Watch Cam** ends where it last saw the shot.
  - **The end of a round** is announced, and Rovers start driving
    1.2 s later. A computer's turn shows for at least 1.5 s (D45).
  - **The game menu pauses** a local game only when every other player
    is a computer, as spec 10 says; a hot-seat game with two humans
    doesn't pause.
  - **Hot seat:** the view changes hands at once, with no hand-over
    screen. Chat shows the messages the player whose view it is gets.
  - **Chat:** `/team …` or `/t …` to the team, `@name …` to the one
    player whose name starts with `name`. 120 characters at most. The
    sender sees `[to team]` or `[to Name]`; a private message shows
    `[just for you]`; a team message `[team]`.
  - **Unit limit:** none.
  - **Rovers** show their facing to the nearest 20°.
  - **Craters:** at most 120; the oldest 30 fade.
  - **Replays** play a move 0.7 s after the last one settled. The
    followed player's fog shows at about 40% darkness.
  - **The summary:** a hit is an attacking shot that damages, disables
    or infects an opponent's unit; a Rover counts when it explodes at
    the end of a round. Energy earned is income and Citadel bonuses,
    less energy put aside coming back.
  - **Effects in the fog** (spec 08: they show through it) glow over
    the black, and their smoke and debris turn pale there.
  - **Sharp on dense screens:** the game draws at the screen's own
    resolution (up to 2 pixels per CSS pixel), shown at the window's
    size; every screen's camera zooms by that, so layouts stay in CSS
    pixels, and text is drawn at the same resolution.
  - **The fog's edge** (spec 08: soft, not a grid of squares): the
    fog picture has 6 pixels per fog cell; each pixel blends the four
    nearest cells, and the middle 27% of that blend becomes the edge,
    eased. The edge is about 8 px wide, with rounded corners.
  - **Explosions** are mostly fire: a white flash, a fireball that
    swells to the blast's radius and burns down over about 1 to 1.5 s,
    a shock ring and thrown embers. A light trail of smoke follows as
    the fire dies, gone in about 2 to 3 s; units destroyed without a
    blast leave the same.
  - **A damaged unit smokes** for as long as it's damaged, through the
    fog too (spec 04, Damage): more smoke, and sparks, when it's badly
    damaged (40% of its armor or less). Over the fog the smoke is pale
    and larger, so a damaged enemy can be spotted from afar.
  - **Factions** are named Ion Mercantile, Rivet & Ash, Toroid Drift
    and Crater Born (chosen by the user, 2026-10-26, replacing
    Meridian, Ostrevan, Deepbore and Ruuk), and differ in the outline of their units. The six
    colors are red, blue, green, yellow, violet and orange.

## D41. The hand-drawn maps — Ours
- **Date:** 2026-10-25
- **Spec:** 02 Start positions, Maps that come with the game; D16
- **Decision:** Two maps are drawn by hand: Quiet Basin (32 tiles,
  tundra) and Shallow Crossing (40 tiles, desert), each with four
  corner starts grouped for every player count and team layout as D16
  describes. They stay in the set alongside the generated ones (D47).
- **Revised 2026-10-26 (D55):** both redrawn on corners, each mirrored
  into four matching quarters. Quiet Basin: a diamond of Plateau with
  a Mountain core in the middle and smaller Plateau diamonds east and
  west, all with 45° cliffs; a lake north and south, each with a point
  of land; from each lake channels run east and west, bend away to dead
  ends and branch (T-junctions); a pond and painted craters in each
  quarter. Shallow Crossing: seas in the map's corners, a middle lake
  with a small island, channels into it that cross north-south ones,
  mesas north and south, Plateaus east and west, and painted craters.
## D42. The chat key while typing
- **Date:** 2026-10-25
- **Spec:** 10 Chat, Keys
- **Question:** The chat key is a letter, yet "the chat key or Enter
  sends the line". Pressing it while typing would then send the line,
  so that letter could never be typed. How does it work?
- **Answer (user):** The chat key opens the line. While typing, only
  Enter sends, and the chat key types its letter. Esc drops the line.
  Proposed wording is in `docs/spec-changes.md`.

## D43. Computers work out which Outpost is the Citadel — Ours
- **Date:** 2026-10-25
- **Spec:** 09 Playing fair (Choice), Finding the enemy's Citadel
- **Decision:** A computer isn't told. It plans on a copy of the game
  in which no enemy unit is marked as a Citadel, and keeps its own
  odds for each enemy Outpost it knows of:
  - an Outpost it saw a conduit run into was built, so it isn't one;
  - an Outpost destroyed while its owner played on wasn't one;
  - an Outpost within about 60 px of one of the map's start positions
    is much likelier, and one first seen in the first two rounds
    likelier still;
  - some of the odds stay with Outposts it hasn't seen yet: more with
    fog on.
  To let its copy of the game play on as the real one does, each
  enemy's likeliest Outpost stands in for its Citadel there; the odds,
  not the stand-in, decide what a hit on it is worth, and the bonus
  the copy pays for the stand-in isn't counted.

## D44. The personalities — Ours
- **Date:** 2026-10-25
- **Spec:** 09 Personalities
- **Decision:** Seven, hardest first, plus Random. Aim is how far the
  heading may stray either way, in degrees; power is how far the power
  may stray either way, as a share of the launcher's range (the full
  power scale); the error is even across that span.

  | Name | Aim | Power | Judgment | Whims | Style |
  |---|---|---|---|---|---|
  | Warden | 0° | 0 | 1.0 | 3% | Defender |
  | Forge | 3° | 3% | 0.9 | 7% | Builder |
  | Lancer | 6° | 6% | 0.8 | 12% | Aggressor |
  | Mason | 11° | 10% | 0.65 | 20% | Builder |
  | Sentry | 17° | 14% | 0.5 | 28% | Defender |
  | Raider | 25° | 19% | 0.35 | 38% | Aggressor |
  | Drifter | 35° | 25% | 0.2 | 50% | Builder |

  - **Judgment** sets how many of the candidate moves it weighs (40% to
    all of them), how much noise its weighing has, and how many rounds
    ahead it counts income (3 to 8, fewer as the game goes on).
  - **Style** weighs the parts of a position: a Builder counts economy
    at 1.35, an Aggressor attack at 1.35, a Defender the threats to it
    at 1.4.
  - **A whim** picks another kind of move it weighed at random, then
    one of its moves, as long as that isn't clearly worse than
    passing (within 0.5 energy).
  - **Judgment noise** reorders the moves that beat passing; it never
    makes a move worse than passing look worth launching. (With dozens
    of candidates, noise alone would otherwise always find one.)
  - **Getting its eye in:** a shot exactly like its last one, from the
    same launcher, strays by 60%, 30%, 10%, then none of its error.

## D45. How computers think — Ours
- **Date:** 2026-10-25
- **Spec:** 09 (Taking part, Playing fair, Choosing what to do, Making
  a shot)
- **Decision:**
  - **What it knows.** It looks at the game at the start of every turn,
    through its side's fog, and remembers enemy units and conduit
    nodes it has seen until it sees their place empty.
  - **How it chooses.** It lists candidate moves for each working
    launcher: buildings in a ring and toward vents, unseen starts and
    the enemy; defenses beside its threatened buildings; weapons at the
    enemy units and conduits it knows of. It aims each with the game's
    own flight rules. It plays each one out on its copy of the game,
    with the game's own rules, and scores where it leaves it: energy
    next round up to the cap, its units less the enemy's (what burns
    is counted by the burn itself), what its launchers reach, the
    threats to its units less what covers them, Rover lines, Worms,
    blasts from its own Extractors and Charges, and with fog on, how
    much it sees. It plays the best few out again with its own error,
    and keeps the average.
  - **Passing.** It passes when nothing beats keeping the energy.
  - **Not getting stuck.** An attack on a target that did it no harm
    counts for less each further time; a move repeated more than three
    times running counts for less.
  - **Timing.** It waits 1.5 s at the start of its turn, thinks in
    slices of about 8 ms a frame, and makes the best move it has after
    25 s.
  - **Its aim.** If its error would put a building's heading in the
    conduit warning, it aims again, as a human would.

## D46. The map generator — Ours
- **Date:** 2026-10-25
- **Spec:** 02 Generated maps, Start positions, Energy Vents
- **Decision:**
  - **Deterministic.** The same settings and a 32-bit seed always give
    the same map on every machine (`src/mapgen/generate.js`, checked
    by the purity test). The host rolls the seed and puts the whole map
    in the setup, so the other players and the replay get it as data.
  - **The controls:** Style (Mirrored or Grown), Size (the five sizes),
    Planet (the six), and Energy, Terrain and Water with five steps
    each, 0 to 4, each also Random. Random picks any style, size or
    planet, and steps 1 to 3 of the other three.

    | Step | Energy | Terrain | Water |
    |---|---|---|---|
    | 0 | Scarce: 4 vents per 1,024 tiles | Smooth: 15% raised | None |
    | 1 | Low: 7 | Gentle: 25% | Little: 6% of the map |
    | 2 | Normal: 11 | Normal: 35% | Some: 13% |
    | 3 | Rich: 15 | Hilly: 45% | Much: 24% |
    | 4 | Abundant: 22 | Rough: 55% | Islands: 50% |

    Raised land is a share of the land; Mountains are 20% to 50% of
    it, rising with the step, and rougher steps add finer hills. (The
    Terrain shares were raised, and are now measured on the finished
    map, in D61; they were 5% to 36%.) More
    energy also means larger vents.
  - **How it builds a map** (revised 2026-10-26 for Landforms, D55):
    two fields of smooth noise, one for water and one for height, cut
    at the shares above, set each corner's level, so cliffs and shores
    step across the grid at 45° as freely as they run along it. Every
    raised corner and every water corner must belong to at least one
    whole tile of its level, so each hill has a flat top and each lake
    some open water (no knife-edge ridges or specks); a corner of land
    with water all round goes under. Then any corner more than one level
    above a neighbor comes down (D23). The Islands step uses finer water
    noise, so the land breaks up.
  - **Channels** (by Water step 0 to 4: 0, 3, 5, 7, 5 per 1,024 tiles)
    start in dry tiles, half of them beside a lake, and wander 4 to 12
    tiles with straight runs and bends that turn back and forth. A
    channel ends where it reaches raised land (a dead end), opens into a
    lake, or meets another channel (a T-junction), though it may carry
    on across it (a crossing); now and then a short branch leaves it.
    It never runs alongside another channel, and one shorter than three
    edges is taken back. **Ponds** (0, 2, 3, 3, 2 per 1,024 tiles) go in
    flat Ground tiles with no water beside them. Starts and the tiles
    near them get none.
  - **Painted craters** (by Terrain step: 1, 2, 2, 3, 4 per 1,024
    tiles, at least one where there's room), 80 to 160 px across, on
    flat ground of one level 3 tiles square, clear of starts and vents.
  - **Mirrored:** a quarter of corners is built, then mirrored into the
    other three (corner x to n − x, tile x to n − 1 − x), with its
    start, channels, ponds, vents and craters. Starts lie near the
    middle of each quarter.
  - **Grown:** four starts as far apart as possible, on dry, flat
    Ground where there is any; teams of two get the closer pairs
    (D16). Each start first gets a vent within about 8 tiles, if
    there's room, then the rest go anywhere. A start may end up cut
    off by water: computers can cross (D48).
  - **Flat ground.** A start is made Ground for 2 tiles all around.
    A large vent needs one dry level for 2 tiles all around its tile,
    a smaller one for 1, so slopes and shores never reach it. Vents
    stay at least 3 tiles from starts and from each other.
  - **Suggested players:** 2 for 32 and 40 tiles, 3 for 48, 4 for 56
    and 64.
    Start positions are given for 2, 3 and 4 players and every layout.

## D47. The maps that come with the game — Ours
- **Date:** 2026-10-25
- **Spec:** 02 Maps that come with the game
- **Decision:** Twelve, in all five sizes and on all six planets: the
  two drawn by hand (D41) and ten made with the generator by
  `tools/make-maps.js`, which records each one's settings and seed.
  They're kept as data (`src/maps/generated.js`), so a later change to
  the generator doesn't change them; a test checks the file still
  matches what the tool makes.

  | Map | Tiles | Planet | Style | Energy, Terrain, Water |
  |---|---|---|---|---|
  | Quiet Basin | 32 | Tundra | drawn | |
  | Red Steps | 32 | Canyon | Mirrored | 2, 3, 1 |
  | Green Haze | 32 | Toxic | Grown | 2, 2, 0 |
  | Shallow Crossing | 40 | Desert | drawn | |
  | Twin Ridges | 40 | Plains | Mirrored | 1, 3, 2 |
  | Sump Flats | 40 | Toxic | Grown | 2, 1, 2 |
  | Ice Shelf | 48 | Glacier | Mirrored | 2, 2, 3 |
  | Long Meadow | 48 | Plains | Grown | 3, 1, 1 |
  | Broken Mesa | 56 | Canyon | Grown | 2, 4, 1 |
  | Scattered Isles | 56 | Tundra | Mirrored | 3, 2, 4 |
  | Great Erg | 64 | Desert | Mirrored | 2, 3, 0 |
  | Floe Field | 64 | Glacier | Grown | 3, 2, 4 |
- **Revised 2026-10-26 (D55):** the ten generated maps were rebuilt
  from the same recipes with the corner-based generator; the two drawn
  maps were redrawn (D41).
## D48. Computers cross water — Ours
- **Date:** 2026-10-25
- **Spec:** 09 Planning ahead (water needs a Pontoon first),
  Opportunities (Pontoons)
- **Decision:**
  - **Pontoons are planned with what follows.** It considers a
    Pontoon on each water tile its land first meets, looking out every
    15° from each Outpost. It weighs one by playing it out, then
    supposing Pontoons on the rest of the water along the same line
    (up to about 400 px), and its turn again with enough for an
    Outpost, and playing out the best Outpost onto the land beyond (or
    the Pontoons alone, if they already let it build across). Of what
    that adds, less 1 energy for each further Pontoon, it counts 80%
    for each Pontoon the crossing still needs, the first included.
  - **It carries a crossing on:** Outposts aimed onto its own Pontoons,
    and 70 and 130 px past them, are among its candidates.
  - **Reach respects water.** A vent or unseen start counts as in reach
    of an Outpost only if the line to it crosses no water without a
    Pontoon (or counts for a fifth). In reach counts in full; out of
    reach counts at most 60%, less the further it is.
  - **Enemy Pontoons** are attacked like any other target: playing a
    shot out shows what sinks and burns with them.

## D49. Sound effects and where they're heard — Ours
- **Date:** 2026-10-25
- **Spec:** 11 Volumes, Where effects are heard, The effects, Menu
  sounds
- **Decision:**
  - **By name.** The game asks for every sound by name
    (`explosion.large`, `launch.battery`, `ui.click`, …). One table,
    `src/client/audio/sounds.js`, says where each name comes from: a
    recipe made in the browser with the Web Audio API, or recorded
    files (one picked at random each time). Swapping in a recording
    changes that table only.
  - **Placement.** Heard from the middle of the view: volume falls as
    (1 − d / 1300 px)², the short way around the map; pan leans fully
    (85%) at 700 px to the side. In the fog: half volume, no pan. A
    replay hears everything as seen.
  - **Following.** The launch sound follows its shot until the shot
    ends; the Seeker's lock tone (a loop, from the lock until the
    shot ends), the Interceptor missile's sound and a driving Rover's
    sound are loops that follow what made them, and stop with it.
  - **Which sound:** explosions small, medium and large below 25 and
    35 px of radius; a blast below 100 px is a Charge's, below 160 px
    an Extractor's, else a Rover's, each its own sound. A unit that
    blasts is heard only in its blast. Units without a blast make a
    large or small destruction sound by kind; a disabled unit makes
    its own power-down sound. Landings thud heavy (Outpost, Battery,
    Extractor), medium or light; Pontoons and anything coming down in
    water splash, more heavily for heavier things.
  - **Clear mix.** At most 12 effects and interface sounds at once
    (the oldest that isn't a loop makes room). Each play varies pitch
    by up to ±6% and volume by up to ±10%; each sound has a shortest
    gap between plays (25–120 ms). A compressor sits on the output.
  - **Levels.** Each volume setting is a bus, at (setting/100)² of its
    level. Music's level is 0.32 of the effects', the interface's 0.7.
  - **Interface.** Menu-screen buttons sound on hover and on click; in
    the game, only Launch's press makes an interface sound. Chat
    sounds when a message is sent (hot seat; online play will sound
    it on arrival). Letting go of an Options volume slider plays an
    explosion, a chord, an aide line or a click at the new volume.

## D50. The aide — Ours
- **Date:** 2026-10-25
- **Spec:** 11 The aide
- **Decision:**
  - **Lines.** Three or four per event (`src/client/core/aide.js`),
    each with an id `aide.<event>.<n>`. It waits 0.7 s before speaking
    and pauses 0.45 s after a line. Up to 3 items wait; a waiting item
    for the same event is replaced by the newer one.
  - **"Your shot hit an enemy"** counts only units the shot's
    explosions damaged or destroyed. A building taken down because the
    burn reached it along its conduit doesn't count, though the shot's
    player gets the credit for it (user's report, 2026-10-26: the aide
    announced each building in a chain as a fresh hit). Losing one's
    own units that way off screen still counts as a loss.
  - **Its voice** is the browser's own speech, at the Voice volume, at
    the voice's own pitch and a rate of 1.05. Each faction has its own
    system voice, chosen by name from a list of US English voices for
    that faction (user's choice, 2026-10-26): two women's voices, Ion
    Mercantile (Samantha on a Mac or iPhone; Ava or Allison where
    installed) and Toroid Drift (Shelley; Zoe where installed), and two
    men's, Rivet & Ash (Reed; Alex or Tom where installed) and Crater
    Born (Eddy; Evan or Nathan where installed). The lists cover macOS
    and iOS, Chrome's own voices and Windows. Where there aren't enough
    US voices of the right kind (Windows has one woman's, Chrome's own
    voices one US voice), a British or other English voice of the same
    kind stands in. Novelty voices (singing, bleating and the like) are
    never used, and no two factions share a voice where there are
    enough. Where no listed voice is there (as on Android, whose voice
    names don't say who speaks), a faction takes the next US English
    voice not taken, then any English one. A recording can stand
    in for any line: `AIDE_FILES` in `sounds.js`, keyed by
    `aide.<faction>.<event>.<n>` (factions `ion-mercantile`,
    `rivet-and-ash`, `toroid-drift`, `crater-born`).
  - **Hot seat:** the aide is the player's at the screen; it starts
    afresh when the screen changes hands. Watching a replay, there is
    no aide.
  - **A reminder** comes every 30 s of a turn when the shot clock is
    off, and is stale once the turn has passed or anything is moving.
  - **Shots hit** means damage or destruction by the player's own shot
    on their own turn; salvaging and failed landings don't count.

## D51. The music — Ours
- **Date:** 2026-10-25
- **Spec:** 11 The music, What it listens for, Other music
- **Decision:**
  - **Made a bar at a time,** in the browser, at 88 beats a minute in
    4/4, each bar made just before it plays, so every change falls on
    a bar's start.
  - **The game song** has four layers, added as intensity rises: a pad
    (always), a bass line (1), an arpeggio (2), drums and a busier bass
    (3). Each mood has its own four-chord progression.
  - **Excitement** rises with blasts (0.5), explosions (0.25),
    Interceptor fire (0.3), the player's side's buildings landing
    (0.15) and knock-outs, each scaled by how loudly it's heard (half
    in the fog), and halves every 9 s. Intensity is 1, 2 or 3 at 0.15,
    0.45 and 0.9.
  - **Mood** goes from −1 to 1, moved 0.35 for each unit of good or bad
    news: hurting the enemy (by damage, out of 30), destroying or
    salvaging their units, building, enemy defenses going down; and
    the reverse. Losing or taking an Outpost counts double. A
    knock-out counts double again. It drifts halfway back every 25 s;
    it's upbeat above 0.3, dark below −0.3.
  - **Other songs:** a menu song; a victory or defeat song on the
    summary (victory when watching, or if any human at this screen
    won), four bars, then the menu song. Leaving a game fades its
    music over 1 s before the menu song starts.
  - **Recordings** can replace any part: a slot is `music.menu`,
    `music.victory`, `music.defeat` or `music.game.<intensity>.<mood>`,
    listed in `MUSIC_FILES` in `src/client/audio/music.js` with its
    tempo and length in bars. A slot's file starts on a bar and plays
    through before the music next changes.

## D52. Online play — Ours
- **Date:** 2026-10-25
- **Spec:** 12 Ways to play (online), The lobby, Setting up a game,
  When the game starts, Every machine plays the same game, Dropping
  out, Rejoining, Determinism checks; 03 Players who disconnect
- **Decision:**
  - **One server** (`npm start`) serves the game and runs the lobby
    and every online game over a WebSocket at `/net` (the `ws`
    library). Messages are JSON; `src/net/protocol.js` lists them.
  - **The server orders the moves.** A player's move goes to the
    server, which checks it with the rules (only the turn's player,
    only for themselves), numbers it and sends it to everyone, the
    sender included. Every machine plays moves only from the server,
    in order, each once the previous one has played out. A player's
    own move is played when it comes back, not before.
  - **The server runs the game too,** settling each move at once, and
    keeps the state hash after every move. Each machine sends its hash
    once a move has played out; a different one warns every player
    that the game has gone out of step, and is logged.
  - **The random choices at the start** (order, start positions, wind,
    a generated map) are rolled once on the server; the whole setup,
    map included, goes to every player. So a map a player doesn't
    have is always sent.
  - **Computers think on the server**, in slices so other games carry
    on, and their moves are sent like anyone's. Each machine waits
    1.5 s into a computer's turn before playing its move.
  - **The shot clock** is kept by the turn's player's own machine: when
    its time is up, it sends the timeout move. The others show the
    clock running from when the turn started on their screen. The
    server steps in with a timeout only if none has come 10 s after it
    should have (allowing for how long the move before takes to play
    out), so a slow connection never shortens a turn.
  - **Losing touch:** machines ping every 5 s. After 60 s of silence
    the others are told the player isn't responding (chat line, aide,
    and a note by the order of play); after 120 s the server sends a
    disconnect move. Quitting sends it at once. A disconnect is a move
    like any other, so every machine and the replay have it at the
    same point.
  - **Rejoining:** offered only before the player is disconnected. A
    machine keeps a token for the tab; reconnecting (by itself after a
    dropped connection, or through Play online after a reload) takes
    back the seat, and the game is caught up at once from the moves so
    far, without playing out the shots. A disconnected player can't
    come back.
  - **The spec's Choice** to let the remaining side claim victory is
    not offered: they knock out the undefended Citadels.
  - **The setup screen online:** the host changes the seats (empty,
    open for a player, or a computer), teams, the map and the
    settings; each player changes only their own faction and color.
    The server decides colors in the order requests arrive. The host's
    Start is enabled when every open seat is filled and every other
    human is Ready. The host leaving closes the game; another player
    leaving opens their seat again.
  - **Lobby listing:** "joined" counts humans who joined plus
    computers; "needed" counts the seats in use.
  - **Chat** goes through the server, which sends each message only to
    the players who get it.

## D53. Destroyed units that don't explode still show an explosion
- **Date:** 2026-10-26
- **Spec:** 04 When a unit is destroyed ("The other seven units don't
  explode. They're destroyed with a debris effect."); 08 Some things
  show through the fog
- **Question:** Does "don't explode" mean no explosion is shown?
- **Answer (user):** No. It means their destruction does no damage
  around them. Every destroyed unit still shows an explosion, so other
  players can see each loss, through the fog too. This matters most
  when a burning conduit takes down a chain of buildings.
- **Decision:** a unit destroyed without a blast of its own shows an
  explosion sized to it (a radius of 1.5 times its footprint, at least
  16 px), with debris thrown up and out, and smoke. Burning conduit
  nodes glow in the fog. A building whose landing fails, in the air or
  where it comes down, shows a small explosion (22 px, 1.2 s), with debris
  (user's choice). Units salvaged or sunk show debris only. Proposed spec wording is in
  docs/spec-changes.md.

## D54. Conduit lights — Ours
- **Date:** 2026-10-26
- **Spec:** 05 Conduit lights
- **Decision:**
  - A light runs along each conduit toward its launcher, and so, from
    conduit to conduit, toward the Citadel. It moves one node (15 px)
    every 140 ms, about 107 px a second (the user found 70 ms too
    fast). Lights are 8 nodes apart, about
    120 px.
  - Each light is a brighter, larger node with a soft glow, and a tail
    fading over the 3 nodes behind it, so the direction of flow shows
    at a glance.
  - Every conduit runs off the screen's one clock, with nodes counted
    from the launcher, so all conduits pulse in step.
  - On the conduit into a disabled unit, lights run 5 times slower
    (about 21 px a second). Those pulse in step with each other.
  - Burning and falling nodes show no lights. Nodes hidden by the fog
    aren't drawn, so neither are their lights.
  - These were missed when conduits were first built (D31 covered
    everything in spec 05 but the lights), and added when the user
    noticed.


## D55. Landforms: gaps in the terrain, maps and generator
- **Date:** 2026-10-26
- **Spec:** 02 Landforms (new), Slopes, Water, Pontoons, Generated maps
- **Questions (answered by the user, 2026-10-26):**
  - *Channels and ponds* run through tiles whose four corners are all
    Ground, so "a tile's shape follows from its four corners" can't
    describe them. **Answer:** corners set the levels, cliffs and lakes;
    the map also records which tile edges water crosses (a channel
    through the edge's middle) and which tiles hold a pond.
  - *Points of land in three corners* and *an outside corner* both
    have three land corners and one water corner. **Answer:** water
    crossing the edges between the land corners splits the land into
    small rounded points; otherwise the land is joined and the tile is
    an outside corner.
  - Proposed wording for both is in docs/spec-changes.md.
- **Gaps** (the current model is D23, D26 and D46):
  1. **Levels sit on tiles, not corners.** Each tile has one level
     (D23, D26). The spec now puts a level on each corner, where four
     tiles meet, and shapes each tile from its four corners.
  2. **No tile mixes two levels.** A raised tile is flat all over and
     its slope lies in the lower neighbor. The mixing rule (at most two
     levels per tile; never three; never Ground with Mountain) is only
     enforced as "neighbors differ by at most one level".
  3. **Water and cliffs.** A Ground tile between a Plateau and water
     can hold both a cliff's slope and a shore. The new rule needs
     Ground between them inside the tiles themselves.
  4. **Cliff pieces.** Only square blocks exist. There are no outside
     corner, inside corner or saddle pieces as the spec describes them.
     Outside corners are square, since distance is measured as the
     larger of the east-west and north-south gaps.
  5. **No diagonal cliffs.** Every cliff runs north-south or east-west,
     so landforms are all squares and rectangles.
  6. **Joins.** Slopes join without steps, but only along straight
     edges and square corners. Nothing turns into a 45° run.
  7. **Water takes one form:** whole tiles. There are no half-tile
     channels (straight, bend, T, crossing, dead end), no ponds, no
     straight shores or outside corners inside a tile, no points of
     land, and no channels opening into lakes.
  8. **Variety.** Plain ground and open water have one look each (a
     faint ripple on water). There are no alternative looks for
     pieces, and maps can't carry painted craters.
  9. **The map format (D26)** stores one level per tile. It needs
     corners, the water shapes that corners can't express (see the
     questions), and painted craters.
  10. **The generator (D46)** works on tile levels: its cliffs step in
      squares, and it makes no channels, ponds or points of land.
  11. **The built-in maps** (D41, D47) are tile data: the ten generated
      ones must be regenerated and the two hand-drawn ones redrawn.
  12. **Tests.** The terrain tests and the Appendix A sketches describe
      tile levels.
  13. **Drawing** is per pixel from the rules' terrain, so it follows any
      new shapes. It needs the looks (gap 8) and painted craters.
  14. **Computers** aim a Pontoon at the center of the first water tile
      they find. On a tile that's only partly water the center may be
      dry, and a Pontoon must land on water.
  15. **Rules version.** Terrain changes play, so the rules version
      goes up (old replays won't play back).
- **How each gap was closed (2026-10-26):**
  - 1–6: corner levels and cliff pieces with exact Euclidean slopes
    (D23); the map checks reject three levels in a tile, Ground with
    Mountain, and water with a cliff (D26).
  - 7: lakes from water corners, channels and ponds from water marks
    (D23, D26).
  - 8, 13: each level's plain surface, and open water, has three looks
    (the color itself, a darker, warmer one with grain, a lighter one
    with streaks), blended by smooth noise on 120 px and 48 px cells,
    which don't line up with the tiles. Painted craters are drawn into
    the ground as a bowl shadowed on its north-west side, with a lighter
    rim; they're marks only, like explosion craters. *Choice:* the
    optional alternative looks for common cliff pieces aren't done;
    slopes keep their rocky texture from the bumps.
  - 9: the format in D26.
  - 10: the generator in D46.
  - 11: D41 and D47.
  - 12: the tests now sketch on corners where it matters, plus new
    Landforms tests (`test/rules/landforms.test.js`).
  - 14: computers aim a Pontoon at the point of the tile with the most
    water around it (on a 15 px grid), to allow for their aim error;
    they leave tiles holding only a pond alone, since a pond leads
    nowhere. Their check for water on a line samples every 15 px, as
    closely as conduit nodes settle, so ponds and channels aren't
    stepped over.
    A Pontoon is also weighed by how likely it is to land (user's
    choice, 2026-10-26): the computer flies 25 shots over an even spread
    of its own aim error (heading and power each at −1, −½, 0, ½ and 1
    of the most it strays), and the share that come down on free water
    is the Pontoon's chance. The crossing counts that often; the rest of
    the time it has spent a Pontoon for nothing. So computers that stray
    favor wide water over a channel; the hardest, which never strays, is
    unchanged. The Pontoon isn't replayed with error again among the
    best moves, since its chance already counts.
  - 15: the rules version is 3.

## D56. Telling players apart online
- **Date:** 2026-10-26
- **Spec:** 12 The lobby, Rejoining; 10 Options
- **Question (answered by the user, 2026-10-26):** two players in one
  online game can choose the same name (both kept the default
  "Player"), so "Your turn, Player" and "Waiting for Player" read the
  same and no one can tell whose turn it is. The spec doesn't say what
  happens. **Answer:** the server numbers repeats.
- **Decision:**
  - When a player joins a game with a name already in it, the server
    gives them the lowest free number, as "Player 2", for that game
    only: in the seats, the setup's chat, and the game itself. Their
    chosen name is unchanged.
  - **A duplicated tab doesn't take the seat.** A tab keeps its token
    for taking back a seat (D52) per tab, so a reload takes the seat
    back; but duplicating a tab copies it. So before using a kept
    token, a tab asks the other open tabs of the same browser (a
    broadcast channel) whether one already holds it, and waits 200 ms;
    if one does, it starts afresh as a new player.
  - **A tab in the background misses no moves.** A browser runs no
    frames in a hidden tab, so a game's screen opens only when the tab
    is shown. Moves that arrive between the game's start and its
    screen opening wait on the connection for it; before, they were
    lost, and that tab stayed a move behind, waiting for a player who
    was waiting for it.

## D57. The order of play doesn't show who has passed
- **Date:** 2026-10-26
- **Spec:** 03 The order of play (its look is up to us)
- **Decision (asked for by the user):** a player's marker looks the
  same whether they're still in the round or have passed or run out
  of energy. Showing it would tell the others too much. Only the
  marks the spec asks for change it: knocked out, and disconnected.

## D58. Computers bridge water only where it's in the way
- **Date:** 2026-10-26
- **Spec:** 09 Planning ahead (water needs a Pontoon first), What
  things are worth; 02 Water, Landforms
- **Problem (reported by the user):** computers laid many Pontoons
  over channels that land already goes round. In 12-round games
  between computers, most of the hardest computer's Pontoons (10 to
  18 a game) crossed water with the same land on both sides.
- **Decision (ours: how computers weigh moves is up to us):**
  - A computer works out once a map which stretches of land join up,
    and how far it is round by land from each vent and start.
  - A vent or start over the water from a launcher counts as far away
    as the way round by land. Only where land doesn't get there does
    it count for little, as before.
  - A crossing's plan counts only what an Outpost past the water adds
    over the best Outpost this side of it.
  - And only where the way round by land to the far shore is more
    than twice as long as straight across, or there's none.

## D59. Computers watch every turn, and answer attacks
- **Date:** 2026-10-26
- **Spec:** 09 Playing fair, Threats, How the priorities shift
  (Emergencies come first), What things are worth (a defense),
  Protecting the Citadel, Defense playbook; 08 What players see (some
  things show through the fog)
- **Problem (reported by the user):** computers didn't use the
  explosions and damage they could see in the fog to find players, and
  didn't respond to being attacked, even when their Citadel was hit.
  - They looked at the game only when their own turn started. A shot
    from a launcher in the fog left them nothing to go on but lost
    armor, and they counted danger only from enemy launchers they
    had seen. With their Citadel shelled down from 50 armor to 20 by a
    Battery in the fog, every computer built an Extractor or passed.
  - Their Citadel counted for less the more it was hurt, the opposite
    of how urgent it is.
  - Danger stopped growing after two enemy launchers in reach.
- **Decision (the user's definition of under attack, and that a guess at
  where a shot came from be no closer than a person's; the weights are
  ours):**
  - **What counts as an attack** on a building: damage; a shot that
    comes down near it, whether it explodes or not; a shot its
    Interceptors catch; a Pulse; a Worm; a Surge; an enemy Rover's
    line running into it. A conduit burning doesn't count.
  - **What can be under attack:** its Citadel, Outposts, Batteries and
    Extractors, within about 130 px of the attack.
  - **How long:** three turn cycles, since an attacker may wait a turn
    cycle for the Interceptors to reload.
  - **Watching every turn.** A computer watches every flight, tick by
    tick, as a player watches the screen. Only what its side can see
    counts:
    - an enemy shot seen in flight is followed back along its arc to
      where it left at 45° (spec 01), without allowing for the wind.
      It judges that place as a person would by eye, not exactly: from
      where it saw the shot, the way it came is up to 8° off, and how
      far up to 30% off, distance being harder to judge. More shots
      from the same place (guesses within 250 px) sharpen the guess,
      to their average. An Outpost stands in for a launcher there in
      its plans. It's
      trusted less each time the computer fires at it, and dropped
      once the place can be seen, or once a launcher it has seen
      explains it;
    - explosions in the fog, and the sign of damage on enemy units it
      can't see, are leads: places worth scouting and expanding toward.
  - **The response,** in this order of how it weighs them:
    - **An Interceptor,** cheap and easy, around what's under attack.
    - **A Barrier,** if it can afford one.
    - **Firing back** at the launcher it has seen or guessed, which
      can make the attacker turn to its own defense.
  - **Its Citadel:**
    - it counts for the same however hurt it is, and its danger grows
      as its armor falls;
    - in enemy reach with nothing covering it, it's an emergency (spec
      09), more so when under attack;
    - once it's under attack, the enemy knows where it is, so nothing
      holds back how many defenses go around it.
  - **Barriers aimed where they can land.** A computer aimed a
    Barrier 45 px from the building it protects, closer than the
    shortest throw (about 100 px), so it could never cover a launcher
    from that launcher. It now aims 110 px out, well inside the dome.
  - **Charges weighed as they work** (asked for by the user, after a
    game where they did little). Laid from one launch, three Charges
    land inside each other's blast and go off together (spec 04,
    Blasts can chain), so one 1-energy Shell clears all three; and
    the owner's own shots set them off (spec 06), so Charges between
    a launcher and the enemy block its own fire back. A computer
    counted each as 15% cover, for good.
    - Now Charges within each other's blast count as one shot stopped.
    - Its own Charges near one of its launchers, by the line toward an
      enemy launcher in reach, count against it.
    - Its own Charges whose blast reaches one of its units (within
      about 90 px of the unit's edge) count by the harm they'd do: any
      shot sets them off, and each in reach does 3, so enough of them
      to destroy the unit count as losing it. More so where an enemy
      launcher reaches the unit, or it's under attack. They give it no
      cover, since they do it the harm of the shot they stop.
    - Charges are weighed as its own aim would land them, short and
      long as well as true, since a little short puts their blast on
      what they guard. (A user's game: an easier computer's Charges
      landed beside its Citadel, and the user set them off for the
      kill.)
    - So the Interceptor is its everyday defense against shots.
  - **Interceptors placed where they work** (from the same game: its
    Citadel's three Interceptor aims were all where a new conduit may
    not start, so only Charges were left to it):
    - aimed 110 px out (the shortest throw is about 100 px; the old
      75 px aim landed only by luck), on the enemy's side within
      about 45°, where a new conduit from the launcher may start;
    - counted as cover by the side they stand on. Tried against
      Shells from 300 and 450 px: 75 to 150 px out on the enemy's side,
      or 45° off it, an Interceptor caught all of them; 90° off, a
      third to most; behind what it guards, none, since the shot comes
      within its 180 px only as it lands;
    - Barriers, whose dome guards from any side, go any way round.
  - **More attackers count for more:** each enemy launcher in reach
    past the first adds 0.6 of the first. Before, the count stopped
    at two.
  - **Personality:**
    - its style's weight on defense scales all of this, so a defender
      answers hardest and an aggressor fires back most;
    - poorer judgment notices less: it always notices a hit for the
      hardest computer, and 68% of hits for the easiest. It notices a
      near miss for 44% to 100%. The easiest judges where a shot came
      from up to 18° and 54% off. From one Battery shot at 600 px,
      the hardest computer's guess was a median 49 px off and the
      easiest's 89 px; after four shots, 25 px and 56 px.

## D60. Installing the game to a home screen
- **Date:** 2026-10-28
- **Spec:** none. A feature the user asked for, not from the spec;
  10 Layout is the nearest chapter.
- **Asked for:** the game can be installed to a phone's or tablet's
  home screen ("Add to Home Screen"). Opened from there it fills the
  whole screen without the browser's bars, and keeps clear of notches,
  rounded corners and the home indicator. On iPhone, Safari can't make
  a page element full screen, so installing is the way to get full
  screen there.
- **Choice:**
  - A web app manifest (`manifest.webmanifest`) with `display:
    fullscreen`, the game's dark background as its colours, and our
    own icons. On iPhone and iPad, the Apple home-screen tags too, with
    the status bar see-through over the game's background.
  - The page runs edge to edge (`viewport-fit=cover`), and the game's
    element keeps to the screen's safe area (`env(safe-area-inset-*)`).
    The game sizes itself to that element, not the window, and follows
    it as it changes (turning the phone moves the safe area). Outside
    the safe area is the plain background. In an ordinary browser tab
    the safe area is the whole page, so nothing changes there.
  - No offline mode (no service worker): the game is still loaded from
    the server, which online play needs anyway.
  - The icons are drawn by `tools/make-icons.js`: a Citadel's dome and
    spire on a moon's horizon, kept inside the middle 80% so phones
    that cut icons to a circle keep all of it.
- **Limits:** Android's Chrome installs a full-screen app only from
  https or `localhost`; from a plain http address on the network,
  "Add to Home screen" makes a shortcut that opens in the browser.

## D61. Hillier maps
- **Date:** 2026-10-28
- **Spec:** 02 Generated maps (Terrain: "from smooth to rough"),
  Levels, Landforms, Maps that come with the game. The spec leaves the
  shares to us.
- **Problem (reported by the user):** the maps, built-in and generated,
  all skewed too flat: too little raised ground and too few Mountains.
  - The Terrain steps aimed for 5% to 36% of the land raised, and
    random maps (steps 1 to 3) for at most 28%.
  - The generator undershot even those: making every hill flat-topped,
    with no knife edges, trims raised land, and so does flattening the
    starts. A "Normal" map came out 6% to 18% raised, with 0% to 4%
    Mountain. The two hand-drawn maps were 6% to 7% raised.
- **Asked for:** more raised ground and more Mountains, with "Normal"
  about a third of the land raised, for a start; the built-in maps
  regenerated, and the hand-drawn ones redrawn hillier.
- **Choice:**
  - Terrain steps: 15%, 25%, 35%, 45% and 55% of the land raised, with
    Mountains 20%, 28%, 35%, 42% and 50% of the raised land. Random
    (steps 1 to 3) gives 25% to 45%.
  - The shares are measured on the finished land: the generator cuts
    its height noise, builds and trims the land, measures it, and cuts
    again until it's within 1% (at most 8 tries; the noise is the same
    each time, so a seed still gives one map). Mirrored maps flatten
    their starts before measuring. Maps with the Islands water step come
    out lower (about 28% to 42% raised), since small islands can't hold
    flat-topped hills.
  - Vents: where hills leave no flat square for a vent, the spot that
    is closest to one is levelled to its lowest level (so a vent can sit
    on a Plateau), in every mirror image; a levelling that would wear
    away the flat ground of a start or a vent already placed is undone
    and the next spot tried.
  - Craters: where hills leave no room 3 tiles from every vent, a
    smaller crater (radius 40 to 50 px) may sit 2 tiles from one. A
    small, hilly map may still have none (Red Steps), as island maps
    may.
  - The ten generated maps were rebuilt from the same recipes and seeds
    (D47). Quiet Basin and Shallow Crossing were redrawn with the same
    water, starts and vents, and new hills: about 35% raised and 10%
    Mountain each. Some of their craters moved onto flat hilltops.
  - Old replays keep the maps they were played on, as a replay carries
    its map.
- **Measured** (two computers, 12 games over six maps, against the old
  maps): failed landings on slopes 35 against 22, in about 700 launches
  each; games ended at about the same pace.
