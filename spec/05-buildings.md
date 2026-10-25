# 05 — Buildings and conduits

Six units are **buildings**: the Outpost, Battery, Extractor,
Barrier, Interceptor and Spire. Each one stays
joined by a **conduit** to the launcher it came from. This chapter covers
how a building lays its conduit, what makes a landing fail, how close
things can be placed, what breaks a conduit, and what happens when a
building is destroyed.

The free-standing units (Pontoon, Sky Probe, Proximity Charges, Rover)
have no conduit. Their landings are in chapters 04 and 06.

## Laying the conduit

- **The conduit starts once the building is clear of its launcher**, a
  little beyond the launcher's footprint, measured across the ground.
- **The first node** lies on the launch heading. It doesn't go toward
  the shot, even if wind has moved it.
- **Wind starts acting on the building at the same moment** (chapter
  01).
- **More nodes follow the building's path** across the ground, about
  15 px apart.
  - They trail a little behind the building, more so as it comes down.
  - So the conduit traces the flight, including any bend from the wind.
- **Nodes fall to the ground.** Each node starts at the building's
  altitude when it was laid. It then falls until it comes to rest on the
  ground.
- A conduit in flight can't collide with itself. It's only checked against
  other conduits.

## As the building comes down

- On the way up and over the top of its arc, the building collides like
  any small shot.
- Shortly after the top of its arc, about 0.2 seconds, it takes on its
  **full footprint**. From then on it collides with units and Barriers
  at its full size.

## Landing

A building's landing **fails**, and the building is destroyed, if any of
these happen:

- **In the air:**
  - it hits a unit;
  - it touches an enemy Barrier's dome;
  - an Interceptor missile catches it;
  - it flies close to an armed Charge and sets it off.
- **Where it comes down:**
  - a node of another conduit is within a few pixels of its footprint;
  - an armed Charge is within about 90 px. The Charge goes off;
  - the ground there is a slope. Only the exact landing point is
    checked;
  - the ground there is water. The building sinks, after a short splash.
- **After it lands:** its own conduit breaks (see below).

A building that fails is never really there. A failed Extractor
doesn't explode.

If nothing goes wrong, the building is working as soon as it lands.
Barriers are the exception: they come up when the turn passes
to the next player (chapter 04).

## How close things can be

Three rules decide how closely buildings and conduits can be packed:

1. **Units can't overlap.** A falling building that touches another
   unit's footprint with its own hits that unit, and fails. So two
   Extractors need their centers about 40 px apart.
2. **A building needs room from conduits.** It can't land with any
   conduit node within a few pixels of its footprint.
3. **Conduits need room from each other.** Each node of a new conduit
   must settle about 12 px or more from every node of every other
   conduit, including the player's own.
   - **As an angle:** two conduits leaving the same Outpost need
     headings about 20° apart or more, or the new one breaks.
   - The aiming warning (below) comes on a little earlier, at about
     30°. So the game warns before the conduit would actually break.
   - Further out, straight conduits spread apart, so the start is what
     matters. Wind can bend a conduit's path after its first node,
     though, so a conduit can still run into another one further out.

The conduits take up room too. Players have to plan where conduits will
run, or they can easily block their own way forward.

## Conduits that break

**A conduit breaks** when one of its nodes comes to rest:
- on water;
- on top of a unit;
- within about 12 px of a node of another conduit;
- near an armed Charge. The Charge goes off.

When a conduit breaks:
1. It burns away in both directions, starting from the node that broke
   it.
2. When the burn reaches the building at the end, the building is
   destroyed. Its landing has failed.
3. The launcher at the other end isn't harmed.

So a conduit can't cross water, except over a Pontoon (chapter 02). A
conduit also can't cross another conduit.

## Aiming along your own conduit

- A launcher's conduits leave it in many directions. If a player aims a
  building along one of them, the new conduit's first node would land on
  top of the old conduit, and the new conduit would break.
- **So the game warns them.** While aiming, the game checks whether the
  new conduit would start too close to any of the launcher's conduits,
  including the one leading into it. If so, a marker appears on that
  conduit.
- **While the marker shows, Launch is refused for buildings.** Weapons
  can still be launched.
- A player can override the warning by holding an override key while
  launching.

## Conduit lights

- Lights pulse along every conduit, always flowing toward the Citadel.
  So a player can follow any conduit back to the Citadel, and see which
  Outposts built which. That helps when looking for an enemy's Citadel.
- **All conduits pulse in step**, as if on one shared timer.
- **On the conduit into a disabled unit, the lights flow much more
  slowly.** The slow conduits also pulse in step with each other. That's
  another way to spot a disabled building.
- About one conduit node in five also reveals the fog around it, for the
  player who laid it (chapter 08).

## When a building is destroyed

- **Its conduits burn away, one node at a time,** about 0.2 seconds per
  node.
  - The conduit leading into it burns from the building back toward its
    launcher. The launcher isn't harmed.
  - Each conduit leading out of it burns from the building's end toward
    the building at the far end.
- **When a burning conduit is gone, the building at its far end is
  destroyed too.** Its own conduits then burn, and so on down the tree.
  - So destroying a building destroys everything built from it. The
    further away a building is along the conduits, the later it goes.
  - For example, a building at the end of a 20-node conduit goes about 4
    seconds after its launcher.
- **Destroying a Citadel** destroys its owner's whole network this way,
  because every building hangs off it. The player is out of the game
  (chapter 03). Free-standing units aren't on the network, so they stay
  (chapter 03).
- If a node is already burning from somewhere else, it burns at
  whichever time comes first.

### Conduits across a Pontoon

When a Pontoon is destroyed, its tile is water again (chapter 02). A
moment later:
- **Each conduit crossing it falls into the water** at the Pontoon, and
  burns away in both directions from there. The building at the far end
  of each one is then destroyed, along with everything built from it.
  The launcher at the other end is not harmed.
- **Buildings standing on the Pontoon** fall in and are destroyed. They
  don't explode.
- **A Rover on the Pontoon** just drops into the water and carries on
  underwater.

## What players see

- **A building in flight looks like a launch pod**, not like the
  building. Shortly after the top of its arc, it turns into the actual
  building. That's the same moment it takes on its full footprint, so
  the change tells players it now collides at full size.
- **Falling nodes have shadows.** While a conduit node falls, its shadow
  sits on the ground directly beneath it. Players can see where the
  conduit will come to rest before it settles. So they can spot a break
  coming, such as a node about to land on water or next to another
  conduit.
- **Burning nodes show fire.** Each node shows a small burst of flame,
  with a sound, as the burn reaches it. Players can watch a cascade
  spread along the conduits, and see which buildings are about to go. A
  conduit that breaks while it's being laid burns the same way, starting
  from the break.
- **Water splashes.** A node that settles in water splashes, with a
  splash sound, and the conduit breaks there. A building that lands in
  water splashes before it sinks.

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- Each unit's numbers, and what it does once it lands: chapter 04.
- Collisions in flight, Barriers, Interceptors and Charges: chapter 06.
- How far conduits and buildings reveal the fog: chapter 08.
- How the warning marker and the conduits are drawn: chapter 10.
