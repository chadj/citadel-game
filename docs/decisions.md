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
