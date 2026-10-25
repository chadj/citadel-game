# 02 — The map and terrain

Every game is played on a map. This chapter covers the map's shape and
size, the terrain on it, Energy Vents, start positions, and generated
maps. How maps are stored is up to the implementation.

## Shape and size

- A map is a square grid of **tiles**, each about 60 px on a side.
- Maps come in five sizes, in even steps from about 1,900 px to about
  3,800 px on a side. Bigger maps make for longer games, and the action
  starts later.
- x grows to the east and y grows to the south.
- **The map wraps around on all four edges.** It has no edges at all.
  - Going off one side brings you back on the opposite side. That's true
    for the camera, for shots in flight, for Rovers and for conduits.
  - Distances are always measured the short way around.
  - So players can always attack from behind, and so can their
    opponents.
- Each map has a name and a suggested number of players. Both are shown
  when the host picks a map.

## Planets

- Every map uses one of six **planets**: Tundra, Canyon, Toxic, Glacier,
  Plains and Desert. A planet sets how the terrain looks.
- It also sets how high the raised levels are (see below). Otherwise the
  planet makes no difference to play.

## Terrain

- Every point of the map has two properties:
  - an **altitude**, in pixels;
  - a **type**: flat ground, slope, or water.
- The terrain never changes during a game, with one exception: Pontoons
  (see below). Explosions leave craters on the ground, but they're only
  marks.

### Levels

The terrain is built from four levels, from lowest to highest:
1. **Water**, at altitude 0.
2. **Ground**, also at altitude 0.
3. **Plateau**, raised.
4. **Mountain**, raised further.

Ground, Plateau and Mountain are flat on top. How high the two raised
levels are depends on the planet:
- Plateaus stand about 25 to 40 px above Ground.
- Mountains stand about 35 to 80 px above Ground.
- Each planet has its own heights. So some planets have steep slopes,
  and others gentle ones.

### Slopes

Where two levels meet, the terrain between them is a **slope**.

- **Which levels meet.** Levels only meet their neighbors: Ground meets
  Plateau, and Plateau meets Mountain. A Mountain always sits on top of
  a Plateau, so Ground never meets Mountain directly.
- **Height.** Across a slope, the altitude climbs from the lower level
  to the upper one.
  - The climb is rough, not smooth. The surface is rocky, with small
    bumps along the way.
- **Width.** Measured straight across, a slope between two levels is
  about 40 px wide. Crossed at an angle, or at a corner, it's wider.
- **Direction.** Slopes are the same width whichever way they face:
  north, south, east or west. On screen they look different, because
  the view is oblique. A slope facing south is stretched into a tall
  cliff face. One facing north is squeezed thin.
- **Shores.** Between water and Ground there's a narrow slope too, at
  altitude 0, about 10 to 20 px wide. So a building can't land right at
  the water's edge.
- **Steepness.** Steepness varies by planet, because the levels' heights
  differ but the slopes' widths don't. Where the raised levels are high,
  a slope climbs about as far as it is wide. Where they're low, slopes
  are gentler.

What slopes mean for play:
- A building can't land on a slope. Only the exact point where the shot
  comes down is checked, not the building's whole footprint.
- Slopes are part of the ground. A shot that flies into a slope ends
  there, like a shot hitting any other ground.

### Water

- Water is at altitude 0. It's a different type from ground, even though
  both are at the same altitude.
- Only Pontoons and Rovers can land on water.
  - Any other building that lands on water sinks and is destroyed.
  - A Rover that lands on water carries on underwater (chapter 07).
  - Weapons that land on water mostly splash without effect. For
    example, a Shell that lands on water does no damage. Chapter 06 covers
    each weapon.
- Conduits can't cross water on their own. A node that settles on water
  breaks the conduit (chapter 05).

### Pontoons

- A Pontoon that lands on water snaps to the center of the tile it landed
  in. It stands about 10 px above the water.
- From then on, the whole tile counts as flat ground at the Pontoon's
  top. Buildings can land on it, and conduits can cross it.
- Pontoons are the only way to get conduits across water.
- If a Pontoon is destroyed, its tile is water again at once.
  - Buildings standing on it fall into the water and are destroyed.
  - A conduit crossing it falls in too, and burns away completely, from
    the water outward in both directions.
  - The building at the far end of that conduit is then destroyed, along
    with everything built from it. The launcher the conduit came from
    survives. Chapter 05 has the details.
  - A Rover on it just drops into the water.

### How height affects play

- A unit stands on the ground where it lands. Its base is the ground's
  altitude there.
- A launcher's shots start from its top, so shots from high ground start
  higher (chapter 01).
- A shot that starts higher has further to fall, so it carries further.
  Shooting uphill shortens the shot for the same reason.
- High ground is therefore a good place to attack from.
- For example, a full-power Outpost shot from ground 75 px above its
  target carries about 540 px, instead of about 500 px on level ground.

## Energy Vents

- **Energy Vents** are glowing patches on flat ground. An Extractor on a
  vent earns 3 energy a round instead of 1.
- Vents come in three sizes: about 110, 80 and 45 px across.
- **An Extractor counts as on a vent** if its footprint overlaps the
  vent at all. Either it's on the vent and earns the full 3, or it
  isn't. Each Extractor on a vent earns 3, however many share it.
- The larger the vent, the more Extractors fit on it. Chapter 05 covers
  how closely buildings can be placed.
- An Extractor on a vent animates visibly faster than one off a vent,
  so players can tell at a glance (chapter 04).
- The glow animates continuously.

## Start positions

- A map provides start positions for each number of players, and for
  each team layout (chapter 12).
- At the start of a game:
  - each player is given one of the positions, at random;
  - each player's Citadel is placed there;
  - each player starts with **11 energy**.
- A start position should be on flat ground.

## Maps that come with the game

- The game comes with a set of ready-made maps, in all five sizes and on
  all six planets.
- Each player in an online game must have the map being played. A map
  that one player has and another doesn't is sent to them automatically
  when they join.

## Generated maps

The host can also play on a randomly generated map. The generator's
controls are:

- **Style.** There are two:
  - One builds a quarter of the map and mirrors it into the other three
    quarters. Every start position then has the same surroundings, which
    keeps the game fair.
  - The other grows landmasses and hills across the whole map, then adds
    water and energy.
- **Size.** Any of the five sizes.
- **Planet.** Any of the six.
- **Energy.** How many Energy Vents there are, and how large, from few
  to many.
- **Terrain.** How rough the terrain is, from smooth to rough.
- **Water.** How much water there is, from none to a lot. At the high
  end, the map breaks up into islands.

Each of these three has a handful of steps; how many is up to the
implementation. Each control can also be left to chance. A random
Energy, Terrain or Water setting avoids both extremes, so random maps
are never extreme.

Every player in the game must get exactly the same map. The host
generates it and sends it to the others, or sends what's needed to
generate it again.

## What players see

- **Splashes match the water.** A splash takes its colors from the
  map's own water. So splashes look right on every planet.
- **Craters build up, then fade out.**
  - Explosions leave craters only on dry ground, never on water.
  - Craters lie under everything else: units, conduits and shots.
  - Once there are many craters, the oldest fade as new ones form. So a
    long game leaves the map scarred, but not without limit.
- **A Pontoon has a deck at water level.** The deck is drawn under the
  units standing on it. A disabled Pontoon looks darker, like any
  disabled unit (chapter 04). Disabling a Pontoon changes only how it
  looks: the tile stays flat ground and its conduits keep working.

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- How a building lands, and what breaks a conduit: chapter 05.
- What each weapon does when it lands, on ground or on water: chapter 06.
- How Rovers move over the terrain and through water: chapter 07.
- How the terrain is drawn, and the minimap: chapter 10.
- Sounds: chapter 11.
