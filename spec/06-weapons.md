# 06 — Weapons and tools

This chapter covers what happens to a shot while it flies, and when it
ends: what it collides with, Barriers, Interceptors, explosions and
damage, and what each weapon and tool does. It also covers the flights
of the free-standing units: Pontoon, Sky Probe, Proximity Charges and
Rover.

The flight itself is in chapter 01. How buildings land and lay conduits is
in chapter 05.

## Shots in the air

Each tick, a shot can be stopped by a Barrier, hit a unit, set off a
Charge, or draw an Interceptor's fire. The order of these checks is up to
the implementation, but every client must use the same one.

A shot has a small size of its own, a few pixels across. It touches
things when its edge reaches them, not only its center.

### Barriers

- A shot is stopped when it **enters** the dome of a working Barrier
  that belongs to an enemy of the player whose turn it is.
- A shot is also stopped when it **leaves** an enemy dome it started
  inside. So a launcher under an enemy dome can only hit things inside
  that same dome.
- **The dome** is a half-sphere, about 160 px in radius, centered on the
  Barrier's base. A shot is stopped when it reaches the dome's edge.
- **Friendly Barriers are ignored completely.** The domes of the player's
  own Barriers, and their teammates', never stop their shots, going in or
  coming out. Disabled Barriers are ignored in the same way.
  - A friendly shot can still hit the Barrier itself, like any
    other unit, and friendly explosions damage it.
- The shot ends at the edge. What that means for each item:
  - weapons and tools do nothing;
  - a building, Pontoon, Sky Probe or Proximity Charge is destroyed;
  - a Rover is destroyed without exploding.
- The dome flickers and makes a sound when a shot or an Interceptor
  missile enters or leaves it.

### Units

- **A shot hits a unit** when it overlaps the unit's footprint, at an
  altitude between the unit's base and its top.
- A building in flight is small until shortly after the top of its arc.
  Then it takes on its full footprint (chapter 05).
- Units of every side count, the player's own included.
- **Pontoons are never hit.** A Pontoon's tile counts as ground, so a shot
  just lands on it.
- **Sky Probes** are hit only by enemy shots, and by any other Sky
  Probe. The Sky Probe is destroyed, and the shot ends there as a direct
  hit. Friendly shots fly straight through.
- A shot that hits a unit ends at once, in the air if need be. That's a
  **direct hit**.

### Proximity Charges

- A shot sets off the nearest armed Charge within about 90 px of it,
  measured in 3D.
- The owner's own shots count too.
- The shot is destroyed with no effect of its own. The Charge explodes
  about 0.5 seconds later (chapter 04).

### The ground

- The shot lands when it comes down to the ground beneath it.
- Landing on dry ground is a **ground hit**. Landing on water is a
  **water landing**. What each item does then is below.

## Interceptors

### When it fires

- A working Interceptor fires at a shot from a player who
  isn't on its side.
- It fires as soon as the shot comes within about 180 px of it,
  measured across the ground. The shot's altitude doesn't matter.
- **Only one missile chases each shot.** Once a shot is being chased, no
  other launcher fires at it, even if the chase later fails.
- **Choice: which launcher fires.** When more than one Interceptor could
  fire, it needn't be the nearest one. A pick that players can't easily
  predict keeps defenses interesting: a player can't be sure which of
  several Interceptors will answer a shot. The implementation designs
  its own pick. It must be deterministic, so every client picks the same
  one.
- After firing, the launcher is disabled for one turn cycle (chapter
  03), whatever happens to the missile.

### The chase

- After a short delay, about 0.3 seconds, the missile leaves the
  Interceptor and speeds up quickly.
- It chases where the shot is now, in all three dimensions. It never
  flies below the ground.
- **Catching the shot.** When the missile reaches the shot, the shot is
  destroyed where it is, and does nothing. Both disappear in a large
  burst, with a hit sound.
- **How long it takes.** For a typical shot from an Outpost:
  - most chases take about 0.6 to 1.2 seconds from firing, including
    the delay;
  - the longest, about 1.6 seconds, are against fast shots climbing
    away just after launch;
  - nearly every shot that comes into range is caught before it lands.

### When the chase fails

- **The shot ends first.** It hits a unit, hits a Charge, or lands on the
  ground.
  - The shot does whatever it would have done anyway. For example, a
    Shell that lands while it's being chased goes off as a normal ground
    hit.
  - The missile gives up at once. It's removed where it is, with a small
    burst and a miss sound. It does no damage.
  - If the shot ends before the missile has even left, the missile gives
    up without leaving.
  - The launcher still reloads for a full turn cycle.
- **A Barrier stops the missile.** The missile obeys the Barrier rule as
  if it were a shot of the Interceptor's side. So it's stopped by
  entering a dome of that side's enemies, or by leaving one it started
  in. Chapter 04 explains what this means for play.
  - The shot is then **saved**. It carries on and ends as if nothing had
    happened.
  - The missile is removed at the dome's edge, with the same small burst
    and miss sound. The dome flickers.
- **Units that land while they're being chased aren't safe yet.**
  - A building, Pontoon, Sky Probe, Proximity Charge or Rover that comes
    down while a missile is after it waits for the chase to end.
  - The missile keeps flying to where it landed. If it gets there, the
    unit is destroyed. If a Barrier stops the missile, the unit stays.
  - A Rover that has gone underwater is safe. The missile gives up.
  - A Rover on land that the missile reaches is destroyed. It has
    landed and is working, so it explodes, with its full blast
    (chapter 04). A Rover caught in the air just vanishes.

## Explosions and damage

All damage takes armor away point for point (chapter 04). A unit with
no armor left is destroyed. Whoever's turn it is gets the credit, for
example for the 7-energy bonus for destroying a Citadel (chapter 03).
At the end of a round, a Rover's owner gets the credit for what it
destroys.

There are two kinds of explosion.

### Shot explosions

Shells, Scatter Shell fragments, Seekers and the Pulse's blast use
this rule. Each explosion has a radius.
- **Who's in range:** a unit whose edge is within the radius, measured
  across the ground, and which isn't too far above or below the
  explosion.
- **How much:**
  - full damage close in, where the unit's edge is within about half
    the radius;
  - half damage further out, to the full radius.
- **Height protects.** A unit well below or above the explosion isn't
  touched, however close it is across the ground. For example, a Shell
  landing on a high Mountain doesn't touch a unit on the Ground just
  below it.
- Every side's units are hit, the player's own included.

### Blasts

Extractors, Proximity Charges and Rovers explode with a blast when they're
destroyed (chapter 04).
- **Who's in range:** any unit within the blast's radius, measured in
  3D, from the blast to any part of the unit.
- **How much:** full damage everywhere in range. There's no half-damage
  zone.
- **Barriers are destroyed.** A blast automatically destroys every
  Barrier in its range, whatever its armor. This happens before
  anything else in range is damaged. Rovers drive in under domes, so
  they're the natural way to break a Barrier.
- Every side's units are hit, the player's own included.
- **Blasts chain.** A blast that destroys another Extractor, Proximity
  Charge or Rover sets that one off in turn.

### The turn waits

The turn doesn't pass to the next player until everything has settled:
every explosion, blast, delayed effect, burning conduit and falling node.

## Weapons

Each weapon's results, by how its flight ends. The radii are targets,
measured from the unit's edge.

| Item | Direct hit | Ground hit | Water landing | Stopped by Barrier or Charge, or caught |
|---|---|---|---|---|
| Shell | Explodes, about 40 px, damage 3 | Explodes, about 30 px, damage 3 | Splash, nothing | Nothing |
| Scatter Shell (each fragment) | Explodes, about 40 px, damage 1.5 | Explodes, about 20 px, damage 1.5 | Splash, nothing | Nothing |
| Seeker | Explodes, about 40 px, damage 3 | Explodes, about 30 px, damage 3 | Splash, nothing | Nothing |
| Pulse | Disables, about 200 px; then explodes, about 30 px, damage 2 | The same | Lost | Nothing |
| Surge | Damage 3 to one unit within about 40 px | Damage 3 to one unit within about 30 px | Splash, nothing | Nothing |
| Worm | Infects, about 50 px | Infects, about 50 px | Lost | Nothing |

A direct hit reaches a little further than a ground hit.

A ground hit leaves a crater (chapter 02). Air bursts don't.

### Shell

- Explodes where it hits: about 40 px on a direct hit, about 30 px on
  the ground.
- **Damage 3 close in, 1.5 further out**, like every shot explosion.
- For example, a Shell lands on the ground beside an Outpost:
  - if the Outpost's edge is within about 15 px, it takes 3;
  - if it's further, out to about 30 px, it takes 1.5;
  - beyond that, nothing.

### Scatter Shell

- **It splits as it starts to fall.** Two fragments break away from it.
  The Scatter Shell itself carries on as the third.
- The two fragments fly about 20° to either side of the Scatter Shell's
  path, a little faster. So the three spread out as they fall, and land
  in a fan.
- Each one explodes on its own, as a small Shell: damage 1.5, about
  40 px on a direct hit, about 20 px on the ground.
- In the outer zone, a fragment does 0.7: half of 1.5, rounded down to
  one decimal place.
- Each fragment is a separate shot. An Interceptor fires once and
  then reloads, so one launcher can stop only one of the three. That's
  how a Scatter Shell gets past Interceptors.

### Seeker

- It flies like a Shell until the top of its arc.
- **Seeking.** From then on, it looks for a target:
  - the nearest unit of any other side, of any kind;
  - within about 240 px;
  - ahead of it, not behind or beside it.

  It locks on to the first target it finds, and never changes target.
- **Homing.** Once locked on, it steers toward the target's base, on top
  of its normal flight. Gravity, drag and wind still act.
  - It steers gently at first, and harder and harder as it goes.
  - It never overshoots the target.
- **Skimming.** While it's homing, it can't land on dry ground. It skims
  just above the surface until it hits something. Only water, or a
  Pontoon's tile, lets it land.
  - In practice it only reaches the surface in its final dive at the
    target. So it lands in water only when the target is at the
    water's edge, or is an underwater Rover. Then it splashes and does
    nothing.
- It explodes like a Shell, usually as a direct hit.
- If it never finds a target, it lands like a Shell.
- **A target destroyed in flight.** If the target is destroyed while the
  Seeker is homing on it, it stops homing. It carries on as a
  plain Shell, and can land on dry ground again.

### Pulse

- **It lands, then waits.** About 1.5 seconds after landing, it goes
  off. Its detonation shows at the landing point meanwhile (see What
  players see). The turn waits for it.
- **On water** it's lost, unless it struck a unit directly.
- **It disables every unit whose edge is within about 200 px**, measured
  across the ground.
  - Every side's units count, the player's own included.
  - They're disabled for one turn cycle (chapter 03).
  - A unit that already has a Worm is disabled for a turn cycle longer.
    Its Worm spreads and wears off that much later.
- **Then it explodes**: about 30 px, damage 2.
  - The disabling comes first. So an Extractor or Proximity Charge the
    Pulse destroys is already disabled, and doesn't explode.

### Surge

- **It hits one unit.** That's the unit it struck. On a ground hit, it's
  the nearest unit within reach, about 30 px from its edge, in the same
  height range as a shot explosion.
- **That unit takes 3 damage.**
- **The damage also runs along a conduit.**
  - If the unit has a conduit leading into it, the damage runs back along
    that conduit toward its launcher.
  - It travels about 7 nodes a second.
  - It weakens steadily as it goes, and fades to nothing after about 50
    nodes.
  - Whatever is left hits the unit at the end. For example, a launcher
    20 nodes back takes about 1.8.
- **If no unit is in range**, the nearest conduit node within range is hit
  instead. The damage then runs both ways along that conduit, and each end
  takes what's left.
- The conduit itself isn't harmed. If the conduit burns away before the
  damage reaches the end, the damage stops.

### Worm

- **It infects every unit near where it lands**, within about 50 px,
  measured in 3D.
  - Every side's units count, the player's own included.
- **An infected unit is disabled** for about one turn cycle.
- **Then the Worm spreads along the conduits.**
  - When a unit's infection wears off, it passes the Worm to the units
    at the other end of each of its conduits. That's both outward, to
    buildings it launched, and inward, to the launcher it came from.
  - It never goes back along the conduit it arrived by.
  - Each newly infected unit is disabled for about a turn cycle, then
    passes it on in the same way.
  - So the Worm works its way through the whole network, one conduit
    further each turn cycle, until it runs out of conduits.
- **Damage.** When a unit's infection wears off, it loses 1 armor.
  - The Worm never kills. A unit with 1 armor or less drops to 0.1.
  - The infecting player's own units are only disabled, not damaged.
    Teammates' units are damaged.
- If a unit is reached by two Worms, the newer one takes over.
- **A Pulse delays it.** A Pulse on an infected unit adds its own
  disable time on top of the infection. The unit stays disabled about
  one turn cycle longer, and passes the Worm on that much later. It
  doesn't cure it.
  - A Pulse on units the Worm hasn't reached yet doesn't protect them.
    The Worm infects them as usual when it gets there.

## Tools

### Repair Pod

- **It repairs one unit by 1 armor**, up to the unit's starting armor.
  Any side's unit can be repaired.
- **Which unit:**
  - the unit it struck, if that unit is damaged;
  - otherwise the damaged unit nearest the landing point, within about
    30 px of its edge. Height doesn't matter.
- It works on water too, for example on a Pontoon.
- If no damaged unit is in range, nothing happens.

### Salvager

- **It turns a unit's armor into energy.**
- **Which unit:** the unit it struck, or else the nearest one whose edge
  is within about 20 px of the landing point, at about the same height.
- **How much:**
  - One of the player's own units: all of its armor.
  - An enemy unit, or any unit with a Worm: up to 3.
- **Taking all of a unit's armor destroys it.** It's salvaged: it
  doesn't explode, and leaves no crater. Its conduits burn as usual
  (chapter 05).
  - So a Salvager is also a weapon. It destroys any enemy unit with 3
    armor or less.
- **It's slow.** It takes 1 armor about every second. The turn waits
  until it's done.
- **The energy comes at the end of the round**, with the income (chapter
  03). All the armor taken is paid, fractions included.
- On water, or stopped by a Barrier, it does nothing.

## Free-standing units in flight

### Pontoon

- It flies as a plain shot. Wind acts on it from the first tick.
- **It lands well** when all of these are true:
  - it wasn't stopped or caught on the way;
  - the tile it comes down in is water where it comes down;
  - the tile has no Pontoon yet;
  - no Rover is in the tile.
- It then moves to the center of the tile (chapter 02). Otherwise it's
  destroyed where it came down.

### Sky Probe

- It flies as a normal shot until it starts to fall (chapter 04).
- **The stop.** From the top of its arc, it slows to a stop over about
  1.5 seconds.
  - Its sideways movement fades away.
  - It stops falling, and drifts gently upward instead.
  - Early in the stop, it deploys: it dips briefly, and takes on its
    full footprint for collisions.
  - When it halts, that's where it floats.
- If it reaches the ground first, it's destroyed.

### Proximity Charges

- **They split in three at the top of their arc**, like a Scatter Shell.
  The spread is wider: the two outer Charges fly about 35° to either
  side.
- **Each one lands as a separate Charge.** A Charge is lost when it lands:
  - within about 15 px of a conduit node;
  - within about 90 px of an armed Charge, which goes off;
  - on water. It sinks after a short splash;
  - after hitting a unit, a Barrier or a Charge in flight.
- Proximity Charges that land well are armed once everything has settled
  (chapter 04).

### Rover

- It flies as a plain shot. It turns to face the direction it's flying.
- **Any collision in flight destroys it.** A Rover that hits a unit
  explodes on the spot. That's how a Rover does damage on a direct
  hit.
- **On landing** (chapter 04):
  - within about 12 px of any conduit node, it explodes;
  - within about 90 px of an armed Charge, the Charge goes off, and the
    Rover explodes;
  - close to an enemy unit, or to any Rover, it explodes. Close means
    within about 20 px of the other unit's edge;
  - on water, it goes underwater.
- **Its heading is the launch heading.** Wind can bend its flight, but
  it still drives along the heading it was launched at (chapter 07).

## Turn cycles used here

| Effect | Lasts |
|---|---|
| An Interceptor reloading after firing | One turn cycle |
| Pulse disable | One turn cycle |
| Pulse on a unit with a Worm | Adds one turn cycle |
| Worm on one unit | About one turn cycle, then it spreads |

Chapter 03 explains how turn cycles are counted.

## What players see

How each effect looks is up to the implementation. What it must show:

- **Explosions.** Each weapon has its own explosion, at the point where
  it ended. Shells and Surges make a large one, fragments a smaller
  one. The Pulse has its own.
- **A Pontoon coming down.** A Pontoon flies as a launch pod, like a
  building. Unlike a building, it stays a pod all the way down.
  - Just before it lands, it shows where it will come down, and is
    drawn at ground level, under other units.
  - When it lands well, it becomes the Pontoon, at the center of its
    tile.
- **The Pulse charging.** While a Pulse waits to go off, an effect at
  the landing point grows for about 1.5 seconds, to roughly the Pulse's
  reach. When it has finished, the units in range are disabled and the
  small explosion goes off. So players can see the Pulse charging, and
  roughly how far it will reach.
- **The Pulse flash.** As the Pulse lands, the view flashes briefly,
  with a sound.
- **The Surge's damage.** A Surge explodes at once where it lands, with
  no wait. Then players can see the damage traveling along the
  conduit:
  - something visibly moves from node to node, in the attacking
    player's color;
  - it weakens as the damage fades, with a sound at each node that
    weakens too;
  - when it reaches the unit at the end, that unit is hit with a sound
    that matches the strength left.

  So players can watch the damage travel, and see which unit it's
  heading for.
- **Splashes.** A weapon that lands on water splashes, in the map's
  water colors (chapter 02).
- **Craters** are left by ground hits, and by most units when they're
  destroyed (chapter 02).
- **Debris.** A destroyed unit that doesn't explode leaves debris
  briefly.
- **Dome flicker.** A Barrier's dome flickers briefly when a shot or
  missile enters or leaves it, with a sound.
- **The Interceptor missile** shows a flame and a trail as it flies. A
  hit and a miss each make their own sound.
- **The Seeker** turns to face where it's steering, with a flame
  behind it.
- **Repairs and salvages.** A Repair Pod shows where it lands, and the
  unit it repairs shows the repair. A Salvager shows where it lands,
  then a small effect each time it takes 1 armor.
- **Infected units** are marked while they're infected (chapter 04).

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- Unit numbers, and what each unit does once landed: chapter 04.
- Conduits, building landings, and the burn: chapter 05.
- How Rovers drive between rounds: chapter 07.
- What shots and missiles reveal in the fog of war: chapter 08.
- How effects are drawn: chapter 10.
- Sounds: chapter 11.
