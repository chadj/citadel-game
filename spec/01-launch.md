# 01 — Launching and flight

Everything a player launches leaves its launcher in the same way. That's
true for buildings, weapons and tools alike. Everything then flies along
the same ballistic path.

Some items change their own flight partway. A Scatter Shell splits, a
Seeker homes in, and a Sky Probe stops in the air. Chapter 06
covers those changes.

This chapter covers what all launches share: aiming, power, the flight
itself, wind, and where the flight ends.

## Units and time

- **Distances** are in pixels.
  - The map wraps around on all four edges. A shot that leaves one edge
    comes back in on the opposite edge.
  - Distances are always measured the short way around.
- **Altitude** is in pixels above the map's zero level. Every point of
  the ground has its own altitude (chapter 02).
- **Time** is in seconds. The game runs in fixed steps called ticks
  (see the README). The flight and the controls move on by a step each
  tick.
- **The view** is oblique. The higher something is, the further up the
  screen it's drawn. How far is an art choice.
  - Draw a shot from its real altitude, not from its height above the
    ground beneath it. Otherwise the shot would jump as it passed over a
    cliff.

## Shots are hard to repeat exactly

This is one of the game's most important mechanics. A player can never
quite reproduce a shot, so every launch takes judgment.
- **The power is hidden.** The power meter shows only roughly how full it
  is (see Power).
- **The aim is imprecise.** The player can turn the aim finely, but the
  shot follows it only to a coarser step, such as whole degrees. The step
  isn't shown, so two aims that look the same can fly differently.
- **The targeting marks are approximate** (see What players see). They
  show the heading, but not precisely enough to line up the same shot
  twice.

How the game hides the exact values is up to the implementation. The
effect must stay: good shots come from feel and practice, not from
copying numbers.

## Aiming

- The aim is a compass heading.
  - 0° points east (+x).
  - Angles increase clockwise on screen, because y points down. So 90°
    points south.
- The elevation is always **45°**. The player chooses only the heading
  and the power.
- **Turning:**
  - The left arrow turns the aim counterclockwise. The right arrow turns
    it clockwise.
  - A press turns the aim about a degree.
  - While the arrow is held, it turns faster and faster, up to about
    150° a second.
  - Turning stops when the player lets go of the arrow, or moves the
    pointer off it.
  - The heading wraps around at 360°.
- **Each launcher remembers its own heading.**
  - Selecting a launcher brings back the heading it last had.
  - A building that has just landed starts with the heading it was
    launched at.

## Power

- **Range.** On flat ground with no wind:
  - from an Outpost, a shot lands about 100 to 500 px away;
  - from a Battery, about 100 to 900 px away, about 1.8 times as far.
- **The power meter.** The player holds down the Launch button to fill
  it. The further the meter has gone when the button is released, the
  more powerful the shot.
  - It fills from the lowest power to the highest in about 1.25 seconds.
  - Then it turns around and runs back down at the same speed.
  - The shot fires when the player lets go of the button. It also fires
    by itself if the meter gets back down to the bottom.
  - A Battery's meter covers its longer range in the same time. So each
    moment of holding is worth more distance, and its shots are harder
    to place.
- **The shortest shots.**
  - The quickest tap fires a little above the lowest power, since the
    meter has already started to fill.
  - The only way to fire at exactly the lowest power is to hold the
    button while the meter goes all the way up and back down. That takes
    about 2.5 seconds.
  - Experienced players use this trick for the shortest possible shot.
- **The exact power is never shown.**
  - The meter is shown coarsely, in roughly 20 steps.
  - Its look is up to the implementation.
  - Players have to time the release by feel, so that an Outpost's
    building doesn't land too short or too far. That's much of what
    makes the game hard.
- Pressing Launch stops the turn's shot clock (chapter 03).
- These ranges limit every launch.
- **Cost:**
  - Launching costs energy equal to the item's level: 1, 3 or 7
    (chapter 04).
  - If the turn's time runs out, the player pays 1 and loses the turn.
    That isn't a pass, so they stay in the round.

## The flight

- **Start.** The shot starts just above the launcher's top. The top is
  the ground's altitude under the launcher, plus the launcher's height
  (chapter 04). So shots from a taller launcher, or from higher ground,
  start higher.
- **The arc.** The shot leaves at 45°. Gravity pulls it down at a steady
  rate. Drag slows its sideways movement a little throughout the
  flight, so the far side of the arc is a bit steeper than the near
  side.
- **How it should feel.** On flat ground with no wind, from an Outpost:

  | Shot | Lands about | Flight time | Highest point, above where it started |
  |---|---|---|---|
  | The shortest | 100 px away | 1.2 seconds | 20 px |
  | Full power | 500 px away | 2.5 seconds | 150 px |
  | Full power from a Battery | 900 px away | 3.5 seconds | 300 px |

  Without drag, a full-power Outpost shot would carry about a tenth
  further.
- **Landing.** The flight ends when the shot comes down to the ground
  beneath it. A collision with a unit, a Barrier or Interceptor fire can
  end the flight earlier, in the air (chapter 06).
- **Every tick,** the shot moves, gravity and drag or wind act on it,
  and the game checks whether it has landed or hit something. The exact
  order within a tick is up to the implementation. Every client must use
  the same one.

Launching from high ground carries further, because the shot has further
to fall. Shots fired uphill fall short for the same reason. Players use
this as a tactic.

## Wind

- **Setting up the wind.** The host picks None, Light, Medium or Strong.
  At the start of the game, the wind gets a strength to match and a
  random direction. Medium varies a little from game to game. The wind
  then stays the same for the whole game.
- **How it pushes.** Wind gently speeds a shot up in the wind's
  direction, up to a drift speed set by its strength.
  - It never pushes a shot faster than that drift speed.
  - A shot that has almost stopped moving sideways isn't pushed.
  - A Strong crosswind carries a full-power Outpost shot about 150 px
    sideways.
- **When it starts.**
  - Weapons and tools feel the wind from the moment they leave the
    launcher.
  - A building doesn't feel it until its conduit starts to pay out.
    Chapter 05 has the details.
- **Wind also turns off drag** in its direction. Players notice this more
  than the push itself.
  - A strong tailwind barely pushes the shot, because the shot is
    already moving faster than the drift speed. The shot still goes
    further, because nothing slows it down. A full-power Outpost shot
    lands about 600 px away instead of 500.
  - A headwind pushes against the shot the whole way, so the shot falls
    well short: about 350 px instead of 500.
  - Wind helps a player whose opponent is downwind. But the map wraps
    around, so that player is downwind too.

## What players see

- **Targeting marks.** A ring shows around the selected launcher. While
  the player aims, marks near the launcher show the heading before the
  shot fires. They're approximate on purpose (see Shots are hard to
  repeat exactly).
- **The launch.** While the player holds Launch, the launcher shows that
  it's charging. When the shot fires, it shows a short burst.
- **Choice: who sees the launch.** The charging and the burst can show
  on the launching player's screen only, or on everyone's. Showing them
  to everyone tells opponents that a shot is coming.
- **The shot's shadow.** Draw it on the ground directly below the shot.
  It shows where the shot is over the map, whatever its height.
- **Launch sounds.**
  - A sound plays when the player presses Launch and the meter starts.
  - Another plays when the shot fires. An Outpost's shot sounds different
    from a Battery's.
  - The launch sound moves with the shot while it plays. So players can
    hear where it's going.
- **Items look different in flight.** Buildings fly as launch pods
  (chapter 05). The Scatter Shell's split, the Seeker's flame and
  facing, and the Sky Probe's pod are in chapter 06.

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- Unit heights, footprints and energy costs: chapter 04.
- Ground altitude and terrain types: chapter 02.
- What happens where a shot lands (placing buildings, conduits, damage):
  chapters 05 and 06.
- Collisions in flight, Barriers, Interceptors, and items that change
  their own flight: chapter 06.
- How computer players choose a shot: chapter 09. They can predict
  flights with this same model.
- The fog of war a shot reveals as it flies: chapter 08.
- How the targeting marks, the meter and the launch are drawn: chapter
  10.
- Sounds: chapter 11.
