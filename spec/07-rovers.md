# 07 — Rovers

A Rover is a level 7 weapon that drives. It lands like any other shot,
then moves on its own at the end of every round until it reaches
something. This chapter covers how Rovers drive, and what they do when
they reach something.

Its numbers are in chapter 04. Its flight and landing are in chapter 06.

## When Rovers drive

- **At the end of every round**, before income is paid (chapter 03).
  - The game announces the end of the round first. Rovers start once
    the announcement is showing.
  - Income comes after every Rover has finished. So an Extractor or
    Citadel that a Rover destroys earns nothing that round.
- **One at a time, in the order they landed.** The oldest Rover goes
  first, whoever owns it.
  - Each Rover finishes its whole drive before the next one starts.
  - So does everything it sets off: its explosion, any blasts it
    chains, and any conduits that burn. The next Rover waits until all of
    that has settled.
- **Only working Rovers drive.** A Rover disabled by a Pulse or a Worm
  doesn't drive at any round end while it's disabled. It drives again
  at the first round end after it recovers.
- A Rover destroyed during another Rover's drive is skipped.

## How a Rover drives

- **It drives in a straight line**, along the heading it was launched at.
  Wind may have bent its flight, but it doesn't change the heading.
  - It never turns.
  - The map wraps, so a Rover can drive off one edge and come back in
    on the opposite edge.
- **It drives up to about 300 px a round**, over about 1.3 seconds, in
  short steps.
  - It keeps exactly to its heading, even when the heading is slanted.
- **It follows the ground.** Each step puts it on the ground at its new
  position. It ignores slopes and cliffs, and drives straight up and down
  them.
- **It drives through water.** Underwater, it sits about 10 px below the
  surface. It drives along the bottom just as it does on land.
- **It drives in under Barriers.** Domes don't stop it.
- **It carries on in later rounds.** A Rover that hasn't reached
  anything drives again at the end of the next round, from where it
  stopped.
  - A Rover held up by its own side's unit or conduit drives on at the
    first round end after that unit or conduit is gone.

## What stops it

As it drives, the Rover watches for these. If more than one applies at
the same spot, the first in this list wins.

1. **An enemy unit.**
   - Any enemy unit within about 20 px of its edge counts. That
     includes enemy Rovers.
   - Sky Probes and Pontoons don't count.
   - An enemy Barrier counts only when the Rover reaches the Barrier
     itself. Being under its dome isn't enough.
   - The Rover stops, waits about 1 second, then is destroyed and
     **explodes**.
2. **One of its own side's units, ahead.**
   - A unit of the Rover's side, other than a Sky Probe or Pontoon,
     within the same reach, in front of the Rover. Units behind it, or
     beside it, don't count.
   - The Rover **stops** just short of it. It stays there in later
     rounds, for as long as the unit is there.
   - Teammates count as its own side.
3. **A conduit.** A conduit node within about 12 px of the Rover.
   - **An enemy conduit:** the Rover stops, waits about 0.7 seconds,
     then is destroyed and **explodes**.
   - **Its own side's conduit:** the Rover **stops** at it. It stays
     there in later rounds, for as long as the conduit is there.
   - Whose conduit it is depends on the owner of the launcher at its
     start.
4. **An armed Charge** within about 90 px, measured in 3D.
   - The Charge goes off, whoever owns it (chapter 04).
   - The Rover waits for the blast. The blast does 3 damage at full
     strength, and the Rover has 3 armor. So a Rover that sets off
     a Charge is always destroyed, and then explodes too.
5. **Water.** When the Rover drives into water, or out of it, it
   splashes. It then drives on underwater, or back on the ground.

**Where it explodes.** A Rover explodes at the spot where it first
comes within reach of an enemy unit or conduit. It doesn't step any
closer first.

## When it explodes

- A Rover that's destroyed while it's working explodes about 1 second
  later: damage 4, over a radius of about 180 px (chapter 04). That's a
  blast, so it destroys any Barrier in range, and does full damage
  everywhere in range (chapter 06).
- **Who gets the credit** for what the explosion destroys, such as the
  7-energy bonus for an enemy Citadel (chapter 03):
  - **At the end of a round,** while Rovers drive, it's nobody's turn.
    The Rover's owner gets the credit.
  - **During a turn,** the player whose turn it is gets the credit, as
    for any other damage (chapter 06). That's whoever set the Rover
    off, not necessarily its owner.
    - For example, a player fires a Shell at an enemy's Rover that sits
      next to a third player's Citadel. The Rover's explosion destroys
      that Citadel. The player who fired the Shell gets the bonus.
  - Nobody gets a bonus for destroying their own side's Citadel. If
    the explosion destroys a Citadel on the credited player's own side,
    no one is paid.
- A disabled Rover can be destroyed without exploding. A Salvager
  that takes all its armor also leaves it without an explosion
  (chapter 06).
- A Rover leaves a crater when it explodes, but not when it's
  destroyed while disabled.

## Pontoons and water

- A Pontoon can't land on a tile where a Rover stands (chapter 06).
- **A Rover on a Pontoon that's destroyed** drops into the water, to about
  10 px below the surface. It carries on underwater (chapter 02).
- An underwater Rover that's being chased by an Interceptor missile when
  it lands is safe. The missile gives up (chapter 06).

## How to use Rovers

- **A Rover is the main way to break a Barrier.** It drives in under
  the dome, and its blast destroys every Barrier in range.
- **Aim it along a line, not at a point.** It drives straight, so the
  heading matters more than the power. A Rover that lands short just
  drives the rest of the way, one round later.
- **It's slow.** It moves only at the end of rounds. The enemy can see
  it coming, and can block it with a Shell, a Pulse, a Charge, or a
  conduit across its path. An enemy conduit makes it explode early, so
  it's an easy way to stop it short of a Citadel.
- **Your own conduits block it.** A Rover launched across your own
  network stops at the first of your conduits it meets.

## What players see

- **Driving.** A Rover faces roughly its heading (chapter 04). It shows
  that it's moving while it drives, and stands still when it stops.
- **Underwater**, it looks submerged.
- **Splashes** as it drives into or out of water, with a sound.
- **The pause.** When it reaches an enemy unit or conduit, it stops for a
  moment before it explodes. Players can see what it's about to hit.
- **Barriers.** A sound plays as a Rover passes the edge of an enemy
  dome, so the Barrier's owner hears it coming.
- **Fog.** A Rover reveals the fog around it for its owner as it
  drives (chapter 08).
- **One at a time.** Players watch each Rover drive in turn. The
  camera can follow them (chapter 10).

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- The Rover's numbers: chapter 04.
- Its flight, its landing, and what makes it explode on landing:
  chapter 06.
- Blasts, and how they destroy Barriers: chapter 06.
- What it reveals in the fog: chapter 08.
- How it's drawn, and the camera: chapter 10.
- Sounds: chapter 11.
