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
