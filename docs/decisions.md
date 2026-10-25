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
  how long Launch was held, so it isn't limited to one step per tick.
  The square of the launch speed grows evenly with the power, so the
  distance grows about evenly too.

## D23. How the terrain is built from tiles
- **Date:** 2026-10-25
- **Spec:** 02 Terrain, Levels, Slopes, Water
- **Question:** The spec gives levels per tile and slopes about 40 px
  wide. Where do the slopes lie, and how are corners and shores shaped?
- **Decision:**
  - Each tile has one level. Raised tiles are flat on top all over.
  - A raised level's slope lies just outside its tiles, running down
    across the lower neighbor, 40 px wide straight across. Distance to
    the raised tiles is the larger of the east-west and north-south
    gaps, so slopes are the same width whichever way they face, and
    wider where crossed at a corner (spec 02).
  - A Mountain's slope runs across the Plateau around it, which leaves
    a 20 px Plateau ledge per tile before the Plateau's own slope.
  - The climb is linear plus rocky bumps up to 2 px, from smooth noise
    on a 6 px grid. The bumps fade out at both edges of the slope.
  - The shore is a 15 px strip of slope at altitude 0 on the Ground
    beside water. Water tiles are water all over, so a Pontoon's tile
    (D4) is always fully water.
  - Neighboring tiles, corners included, may differ by at most one
    level: Ground never touches a Mountain, and water never touches a
    Plateau.

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
- **Date:** 2026-10-25
- **Spec:** 02 (how maps are stored is up to the implementation)
- **Question:** How are maps stored?
- **Decision:** As plain data: a name, a suggested player count, a
  planet, one string of tile characters per row (`~` Water, `.`
  Ground, `+` Plateau, `^` Mountain), and the vents' centers in pixels
  with a size of large, medium or small (110, 80 and 45 px across).
  Start positions are added with D16 in M8. Loading a map checks it
  and lists every problem found.

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
    both ways. It stops if the next node has burned away.
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
  - **The aim** turns in eighths of a degree. A press turns it 1⅛°.
    Held, it waits 0.25 s, then turns at 15°/s, rising evenly to 150°/s
    over 0.9 s. A shot follows it to the nearest whole degree.
  - **The targeting marks** show the heading to the nearest 3°, so two
    aims that look the same can fly a degree or two apart.
  - **The meter** fills in 1.25 s and empties in 1.25 s; the power is
    the share full × 1000, from how long Launch was held. The quickest
    tap counts as 40 ms held (power 32). It shows in 20 steps: a power
    of p lights ⌈p / 50⌉ of them.
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
  - **Factions** are named Meridian, Basalt Union, Lumen Order and
    Drift Clans, and differ in the outline of their units. The six
    colors are red, blue, green, yellow, violet and orange.

## D41. Maps until the full set — Ours
- **Date:** 2026-10-25
- **Spec:** 02 Start positions, Maps that come with the game; D16
- **Decision:** Until the maps that come with the game are made (with
  the generator), the client offers two: Quiet Basin (32 tiles,
  tundra) and Shallow Crossing (40 tiles, desert), each with four
  corner starts grouped for every player count and team layout as D16
  describes.

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
  - **A whim** picks another of the moves it weighed at random, as
    long as that isn't clearly worse than passing.
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
