# 04 — Units

A **unit** is anything that stays on the map after it lands. This
chapter gives each unit's numbers and says what it does once it has
landed. How buildings land and lay their conduits is chapter 05. What
weapons do is chapter 06.

## What every unit has

- **Armor.** A unit's health. It can have fractions, to one decimal
  place. Damage takes armor away point for point. A unit with no armor
  left is destroyed. Repairs can't take a unit above its starting
  armor.
- **Footprint radius.** How wide the unit is, measured from its center.
  It's used for hits, for blasts, and for how close things can be placed
  to it.
- **Height.** How tall the unit is.
  - A unit's **base** is the altitude it landed at. Its **top** is its
    base plus its height.
  - A shot hits a unit only between the unit's base and its top (chapter
    06).
  - Taller units see further through the fog (chapter 08).
  - Launchers fire from just above their top (chapter 01).
- **Owner.** The player who launched it. A player's units are drawn in
  their color and their faction's style.
- **Working or disabled.** A unit can be disabled for a while, by a Pulse,
  a Worm, or after firing (an Interceptor). A disabled unit does nothing:
  - a disabled Outpost or Battery can't launch;
  - an Extractor disabled at the end of a round earns nothing;
  - a disabled Interceptor doesn't fire;
  - a disabled Barrier doesn't block shots;
  - a disabled Charge doesn't go off;
  - a disabled Rover doesn't move.

  Disabled units that explode when destroyed don't explode while
  they're disabled.

## The units

| Unit | Level | Armor | Footprint radius | Height | Conduit |
|---|---|---|---|---|---|
| Outpost | 7 | 5 | about 15 px | about 20 px | Yes |
| Battery | 7 | 3 | about 15 px | about 20 px | Yes |
| Extractor | 7 | 5 | about 20 px | about 20 px | Yes |
| Barrier | 7 | 3 | about 15 px | about 20 px | Yes |
| Interceptor | 1 | 3 | about 20 px | about 20 px | Yes |
| Spire | 1 | 3 | about 15 px | about 100 px | Yes |
| Pontoon | 1 | 3 | about 30 px | about 10 px | No |
| Sky Probe | 3 | 1 | about 15 px | about 50 px | No |
| Proximity Charge (each of three) | 3 | 1 | about 10 px | about 20 px | No |
| Rover | 7 | 3 | about 5 px | nearly flat | No |

The level is also the energy cost. The Citadel is an ordinary Outpost;
only its role is special.

Keep these relationships when choosing exact sizes:
- The Extractor is the widest building, with the Interceptor close
  behind. So Extractors need the most room.
- The Spire is about five times as tall as the other buildings. That's
  what lets it see so far (chapter 08).
- A Pontoon fills the tile it lands in (chapter 02).
- A Rover is tiny and flat, so shots rarely hit it in the open.

### Outpost

- Launches any item, up to the Outpost power range (chapter 01).
- **The Citadel** is the Outpost a player starts with.
  - It earns 7 energy at the end of every round. Other Outposts earn
    nothing.
  - If it's destroyed, the player is out of the game, and their whole
    network burns away (chapter 05).
  - Whoever destroys an enemy's Citadel gains 7 energy at once.

### Battery

- Launches only the attacking weapons: Shell, Scatter Shell, Seeker,
  Pulse, Surge, Rover and Worm.
- Its power range reaches nearly twice as far as an Outpost's (chapter
  01).
- It can't launch buildings, so a network grows only from Outposts.

### Extractor

- Earns energy at the end of every round: 3 on an Energy Vent, 1 off one
  (chapter 02 says when an Extractor counts as on a vent).
- **Only the end of the round counts.** An Extractor that is disabled when
  the round ends earns nothing for that round. One that was disabled
  earlier, but is working again by the end of the round, earns in full.
  - Income is paid before effects wear off at the round's end (chapter
    03). So an Extractor due to recover at the round's end still misses
    that round's income.
- **Its animation shows whether it's on a vent.** On a vent, it animates
  visibly faster than off one. So players can tell at a glance which
  Extractors are earning the full 3.
- **It explodes when destroyed**, about 0.8 seconds later: damage 5,
  over a radius of about 150 px. That can destroy its neighbors, and
  set off more Extractors.
  - It doesn't explode if it's disabled when destroyed.
  - It doesn't explode if it's destroyed while still landing, because
    its landing failed.

### Barrier

- Raises a dome, about 160 px in radius, measured from the Barrier's
  base.
- Enemy shots can't enter the dome: a shot that tries is destroyed at
  its edge. Friendly shots pass through.
- Rovers drive in under the dome.
- **A new Barrier isn't up straight away.** It starts working, and
  shows its dome, when the turn passes to the next player.
- Details of what the dome stops: chapter 06.

### Interceptor

- Fires a missile at an enemy shot that comes within about 180 px of
  it, measured across the ground. Shots from teammates are left alone.
- **The chase.** The missile usually catches the shot and destroys it.
  - After a short delay, about 0.3 seconds, the missile leaves the
    Interceptor and speeds up quickly.
  - It chases where the shot is now, in all three dimensions. It never
    flies below the ground.
  - It usually catches the shot within about half a second to a second
    and a half.
  - What happens in unusual cases: chapter 06.
- After firing, the launcher is disabled for one turn cycle while it
  reloads (chapter 03). That's true even if the missile fails.
- **Barriers can stop the missile.** The missile obeys the same rule as a
  shot: it can't cross the edge of a dome belonging to an enemy. For the
  missile, the enemy is the attacker's side.
  - If the chase would take the missile into one of the attacker's
    domes, the missile is destroyed at the dome's edge. The shot is
    saved: it carries on and lands as if nothing had happened.
  - That happens when the shot is inside the attacker's dome when the
    missile reaches it. It also happens when the dome lies between the
    missile and the shot, and the missile clips it on the way.
  - Domes are nearly as large as the Interceptor's range. So an
    attacker who puts a Barrier near an Interceptor can protect their
    shots as they fly past it.
  - The rule also works the other way. If an enemy puts a Barrier over
    your Interceptor, its missile starts inside that dome and is
    destroyed as soon as it tries to leave. The launcher is then nearly
    useless, except against shots that stay inside the same dome.
  - Barriers of the Interceptor's own side, or of its teammates, never
    stop its missiles. Neither do disabled Barriers.
- The missile can also fail if the shot is destroyed some other way
  first.
- Details: chapter 06.

### Spire

- Sees further through the fog of war than any other unit on the
  ground: about 500 px in every direction, wherever it stands. That's
  about 2.5 times as far as an Outpost on Ground. Chapter 08 has the full
  rule for how far every unit sees.
- Its conduit is often used to fence in an area: a Rover stops at its
  own side's conduits (chapter 07).

### Pontoon

- Can only land on water. It snaps to the center of the tile it lands in
  and turns that tile into flat ground (chapter 02).
- Buildings can land on it, and conduits can cross it.
- If it's destroyed, everything on it falls into the water (chapter 02).

### Sky Probe

- **Its flight has three phases:**
  1. **The climb.** It flies exactly like any other shot until the top
     of its arc.
  2. **The stop.** From the top of its arc, it slows to a stop over
     about 1.5 seconds.
     - As it deploys, it dips briefly, then rises a little before it
       settles.
     - Wind keeps acting on it while it slows down.
  3. **Floating.** It stays exactly where it stopped, as a lookout.
- **It doesn't go as far as a normal shot,** except at the lowest
  powers.
- **It ends up a bit higher than the top of its arc.**

  At full power from an Outpost, it stops about 420 px away, at an
  altitude of about 200.

- **Power decides how far it sees.** The higher it floats, the further
  it sees (chapter 08).
  - A full-power Sky Probe from an Outpost sees about as far as a
    Spire.
  - A minimum-power one sees much less.
- More on its flight: chapter 06.
- **It's fragile.** An enemy shot that touches it destroys it, and the
  shot ends there. A friendly shot passes straight through, unless it's
  another Sky Probe.
- If it reaches the ground before it stops, it's destroyed.

### Proximity Charges

- Split into three at the top of their arc. Each lands as a separate
  Charge.
- **Arming.** A Charge is armed once everything from that launch has
  settled. So Charges being laid can't set each other off.
- **Going off.** An armed Charge goes off when anything comes within
  about 90 px of it:
  - a shot flying past, including the owner's own shots. The shot is
    destroyed too;
  - a building, a Charge or a Rover landing;
  - a Rover driving.
- When it goes off, it explodes about 0.5 seconds later: damage 3, over
  a radius of about 90 px.
- A Charge that lands on a unit, a conduit, or water is lost.

### Rover

- Can land anywhere, even underwater.
- It explodes if it hits any unit in flight, its own side's included
  (chapter 06).
- It explodes at once if it lands:
  - within about 12 px of any conduit, even its own side's;
  - close to an enemy unit, or to any Rover.

  It also sets off an armed Charge if it lands near one.
- At the end of every round, it drives up to about 300 px in a straight
  line, along the heading it was launched at. Wind can bend its flight,
  but not its heading.
- It explodes when it reaches an enemy unit or conduit. It stops when it
  reaches one of its own side's units or conduits.
- **When it explodes**, about 1 second later: damage 4, over a radius of
  about 180 px.
- A disabled Rover doesn't move, and can be destroyed without
  exploding.
- Movement in detail: chapter 07.

## When a unit is destroyed

Only three units explode when they're destroyed:

| Unit | When it goes off | Damage | Radius |
|---|---|---|---|
| Extractor | About 0.8 s after it's destroyed | 5 | About 150 px |
| Proximity Charge | About 0.5 s after it's set off | 3 | About 90 px |
| Rover | About 1 s after it's destroyed | 4 | About 180 px |

- **A disabled unit doesn't explode.** An Extractor, Charge or Rover that
  is disabled when it's destroyed is simply removed.
- **Blasts can chain.** A blast that destroys another Extractor, Charge or
  Rover sets that one off too, and so on.
- Who a blast reaches, and how it destroys Barriers, is in chapter 06.
  A blast does its full damage everywhere in range.

The other seven units don't explode. They're destroyed with a debris
effect. What follows depends on the unit:
- **A building's conduits burn away,** destroying everything built from it
  (chapter 05).
- **A Citadel** puts its owner out of the game (chapter 03), and pays 7
  energy to whoever destroyed it.
- **A Pontoon** drops whatever is on it into the water (chapter 02).

## Weapons and tools

These items don't stay on the map. Their effects are in chapter 06.

| Item | Level | Effect in short |
|---|---|---|
| Shell | 1 | Damage 3 |
| Scatter Shell | 1 | Three fragments, damage 1.5 each |
| Repair Pod | 1 | Restores 1 armor |
| Seeker | 3 | Homes in from the top of its arc; damage 3 |
| Pulse | 3 | Disables units over a wide area; damage 2 near the blast |
| Surge | 3 | Damage 3, running along conduits |
| Salvager | 3 | Turns armor into energy |
| Worm | 7 | Disables, spreads along conduits; 1 damage per unit |

## How units show their state

Units have to tell players about the game at a glance. How each state
looks is up to the implementation. What it must show:

- **Disabled units look disabled.** A disabled unit is clearly different
  from a working one, and stops animating. It goes back to normal when
  it recovers.
- **Barrier domes.**
  - A working Barrier shows its dome.
  - A new Barrier shows no dome until it's up.
  - A Pulse or a Worm hides the dome until the Barrier recovers. So a
    Barrier that's down is easy to spot.
- **Worm infection.** An infected unit is marked as infected, in a way
  that shows which player's Worm it is. The mark stays while the Worm
  spreads on from it, and goes when the unit recovers. A unit disabled
  by a Pulse has no such mark, so players can tell the two apart.
- **Damage.**
  - A damaged unit shows that it's damaged, more so when it's badly
    damaged.
  - The sign goes when the unit is repaired to full armor.
  - **Damage shows through the fog of war.** So a damaged enemy unit
    gives away its position, even where the unit itself is hidden.
  - A repair shows briefly on the unit it fixes.
  - Players can also show a damage bar over each of their units (chapter
    10).
- **A Rover's facing.** A Rover faces roughly the heading it will drive
  along. Players can tell its general direction, to within about 20°,
  but not its exact path. When it drives, it shows that it's moving.
- **Where a Sky Probe is.** Something on the ground directly below the
  Sky Probe shows where it is. It helps players judge its position,
  since the Sky Probe itself is drawn high in the air.
- **Extractors** animate faster on a vent than off one (see Extractor,
  above).

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- How buildings land, lay conduits, and are destroyed: chapter 05.
- Explosions, blast radii, and each weapon's effect: chapter 06.
- How Rovers move: chapter 07.
- How far each unit sees: chapter 08.
