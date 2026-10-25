# 08 — Fog of war

Fog of war hides the parts of the map a player's side can't see. This
chapter covers how the game keeps track of what each side can see, what
reveals the map, and how the fog is shown.

## The setting

- Fog of war is a game setting, chosen by the host. It's **on** by
  default.
- With fog off, every player sees the whole map, and none of this
  chapter applies.

## Each side shares one view

- **Teammates share their view.** Anything one of them can see, all of
  them can see. Without teams, every player is a side of one.
- **The map is divided into square cells, about 30 px on a side.** Each
  cell is either visible to a side or hidden from it.
- **A cell is visible while anything reveals it.** Several things can
  reveal the same cell at once.
- **So the fog comes back.** When the last thing revealing a cell goes,
  for example when a unit is destroyed, the cell is hidden again.
- The cells wrap around the map's edges, like everything else.

## How far things see

- **What a unit reveals is roughly round**, a little blocky because
  it's made of cells. The exact shape is up to the implementation.
- **Higher things see further.** Sight grows with the altitude of the
  revealer's top, up to a maximum.
  - The altitude is measured from the map's zero level, not from the
    ground beneath. So a unit on a Mountain sees further than the same
    unit on Ground.
  - Targets, as the distance seen in every direction:

    | Revealer | Sees about |
    |---|---|
    | A Rover, a Pontoon, or a conduit node | 130 px |
    | A building or a Proximity Charge on Ground | 200 px |
    | The same on a Plateau | 250 px |
    | The same on a Mountain | 300 px |
    | A Sky Probe | More the higher it floats, up to 500 px at full power |
    | A Spire | 500 px, anywhere |
    | A shot in flight, or an Interceptor missile | 130 px near the ground, growing with altitude, up to 500 px at the top of a high Battery shot |
    | An infected unit, for the Worm's owner | As far as the unit itself sees |

  - The implementation chooses how sight grows between these.
  - **A Spire always sees the furthest**, wherever it stands.
- **What's revealed is centered where the revealer appears on screen**,
  not on its position on the map. So high things reveal an area shifted
  up the screen, as players would expect from what they see.

## What reveals the map

Each of these reveals for one side, and stops when it goes. How far
each one sees is under How far things see, above.

- **Every unit**, for its owner's side, for as long as it exists. That
  includes the starting Citadel, buildings, Pontoons, Sky Probes,
  Proximity Charges and Rovers.
  - A building reveals as soon as it lands, even if its landing then
    fails. It stops when it's destroyed.
  - A Sky Probe floats high, so it sees far (chapter 04).
- **A Rover as it drives.** What it reveals moves along with it
  (chapter 07).
- **About one conduit node in five**, along each conduit.
  - A node reveals the smallest area, centered on its position on the
    map.
  - It reveals for the player who laid it, until the node burns.
  - So conduits give some vision along their length, a little patchily.
- **A shot in flight**, for the side whose turn it is.
  - The revealed area moves with the shot.
  - Its size follows the shot's altitude, so a high shot sees a wide
    area.
  - It stops when the flight ends. For weapons and tools, it lingers
    for about 1 second after the shot lands, so players can see the
    result. The turn waits for it.
  - A building, Pontoon, Sky Probe, Proximity Charge or Rover doesn't
    need to linger, because the unit that lands reveals the area itself.
  - Each fragment of a Scatter Shell, and each Proximity Charge of the
    three, reveals on its own.
- **An Interceptor missile**, for the Interceptor's side.
  - It reveals from the moment the launcher fires, at the launcher's
    top, and then moves with the missile.
  - It stops when the chase ends.
  - So a side whose Interceptor fires briefly sees where the enemy's shot
    is.
- **An infected unit**, for the player whose Worm infected it.
  - It reveals for as long as it's infected.
  - As the Worm spreads along an enemy's conduits, it shows the attacker
    more and more of the enemy's network.
  - If another player's Worm takes over the unit, the vision passes to
    them.
  - A Pulse doesn't reveal anything.

## When the fog lifts

- **When a player's side is out of the game**, the fog lifts for good on
  their screen. They see the whole map for the rest of the game.
  - That happens when no human player on their side still has a Citadel.
- **The winners don't get this.** When the game ends, the winning side
  still sees through its own fog.
- The fog lifting is only about what a player sees. It doesn't change
  what any other player sees.

## What players see

- **Hidden cells are black.** Hidden areas show nothing at all: no
  terrain, no units, no conduits, no shots.
- **The edges are soft.** Where visible cells meet hidden ones, the
  fog's edge looks smooth, not like a grid of squares.
- **Some things show through the fog.**
  - Explosions and other effects show, even in hidden cells.
  - So does the sign of damage on damaged units (chapter 04).
  - So players can see a blast in the fog, and can spot damaged enemy
    units, without seeing the units themselves.
  - The targeting marks also stay on top of the fog (chapter 10).
- **The minimap** shows the same fog. Enemy units in hidden areas don't
  appear on it. A player can still click a hidden area of the minimap to
  move the view there (chapter 10).
- **Following shots.** The camera can follow an opponent's shot, but
  only once it comes into view. It doesn't move while the shot is
  hidden (chapter 10).
- **Hot seat.** When several humans share one screen, the screen shows
  the view of the human whose turn it is. During a computer's turn, it
  keeps the view of the last human to play (chapter 10).

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- Unit heights: chapter 04.
- How conduits are laid: chapter 05.
- What computer players can see: chapter 09.
- How the fog, the minimap and the camera are drawn: chapter 10.
