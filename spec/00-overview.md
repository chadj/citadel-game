# 00 — The game at a glance

Read this chapter first. It describes the whole game the way a player
sees it. It also sets the names that the other chapters use, and the
glossary at the end lists them. The later chapters give the detailed
rules and numbers.

## What it is

The game is a turn-based artillery game about claiming territory. Two to
four players take part. Each one can be a human or a computer. They can
play in teams, or every player for themselves.

Each player starts with one **Citadel**. From it, they launch new
buildings and weapons, which all fly in the same kind of ballistic arc.
Each building stays joined to the launcher it came from by a **conduit**,
so a player's buildings form a network. The map wraps around on all four
edges.

The goal is to find and destroy the other players' Citadels, while
protecting your own.

**A Citadel looks exactly like an Outpost.** Nothing on the map shows
which of an enemy's Outposts is their Citadel. Players have to work it
out, for example by following the enemy's conduits back to where they
start (chapter 05). So an attacker is never quite sure whether they're
firing at the Citadel or just an Outpost.

The game is about three things at once:
- **Aim.** Every launch is a shot at a fixed angle of 45°. The player
  chooses its heading and its power. The game never shows the exact
  power, so landing a building on a small patch of flat ground takes
  skill.
- **Territory.** An Outpost can only launch so far. To reach further,
  players launch more Outposts and Batteries, and then launch again from
  those.
- **Economy.** Everything costs energy. More income means more launches
  each round.

## Players and setup

- A game has 2 to 4 players. Up to three of them can be computer
  players, called bots.
- Each bot has a personality that changes how it plays. The game offers
  a set of personalities, listed from hardest to easiest, plus a random
  choice.
- Each player picks a **faction** and a **color**.
  - There are four factions. They differ only in their look and in the
    aide's voice. Their units are the same. More than one player can
    choose the same faction.
  - There are six colors. Each player has a different one.
- **Teams.**
  - Teammates share what they can see.
  - Their units don't fire at each other's shots.
  - They don't share energy, and they can't control each other's units.
  - A team stays in the game as long as any of its members does.
- **Host settings.** The host picks:
  - the map;
  - the shot clock: off, 15, 30 or 60 seconds (60 by default);
  - the wind: None, Light, Medium or Strong (its direction is random
    each game);
  - fog of war: on or off (on by default).
- **At the start**, the order of play is random, and so is who starts
  where. Each player gets a Citadel at a start position, and some
  starting energy.

## Turns and rounds

- Players take **turns**. In a turn, a player either makes **one
  launch** from one of their launchers, or **passes**.
- When the shot clock is on, every turn has a time limit.
- A player who has no launcher able to launch gets a short time limit,
  even with the clock off.
- If time runs out, the player loses the turn and pays a small amount of
  energy. This is not a pass, so they stay in the round.
- **Passing** (the Skip button) takes the player out of the rest of the
  **round**. Any energy they haven't spent carries over to the next
  round, so passing early can be worth it.
- The round ends when every player has passed, is out of the game, or
  can't afford anything. Then:
  - Rovers on the map move.
  - Each player's income is added to their energy.
  - The order of play shifts by one: whoever went first this round goes
    last next round.
- Some effects last for one **turn cycle**. That's roughly the time
  until the same player's turn comes around again. An Interceptor
  reloading works this way, and so do units disabled by a Pulse or a
  Worm.

## Energy

- Energy, armor and damage can have fractions, to one decimal place.
  For example, one fragment of a Scatter Shell does 1.5 damage.
- A player can hold at most **35** energy. Income above that is lost.
- Launching an item costs its **level**: 1, 3 or 7.
- At the end of each round, a player earns:
  - 7 from their Citadel;
  - 3 from each Extractor on an Energy Vent;
  - 1 from each Extractor on ordinary ground;
  - whatever their Salvagers recovered during the round.
- An Extractor that is disabled when the round ends earns nothing
  for that round.
- Destroying an enemy's Citadel pays 7 straight away.

## Conduits: why the network matters

- When a building is launched, it trails a **conduit** behind it as it
  flies.
- **A conduit is a chain of separate pieces** called **conduit
  nodes**, dropped one at a time as the building flies.
  - **On screen,** each node is a small round stud on the ground. The
    studs sit about 15 px apart, so they almost touch, and read as a
    dotted line. Nothing is drawn between them.
  - **In the rules,** a conduit is only its nodes. Every rule about a
    conduit is about its nodes: how close another conduit may come, what
    breaks it, where a Rover stops, how it burns away, and how far a
    Surge travels. The gaps between nodes don't count as part of it
    (chapter 05).
- If the building lands safely, the conduit joins it to its launcher. So
  every building belongs to a tree, and the root of each player's tree
  is their Citadel.
- A building can't land on a slope or on water. Its conduit can't cross
  another conduit or come too close to one. If either rule is broken, the
  building is destroyed.
- Placing buildings well is most of the skill in expanding. It also
  means planning ahead, so that your own conduits don't block your path.
- **Destroying a building cuts its conduits.**
  1. Each conduit leading out of it burns away, one node at a time.
  2. When a conduit has burned away completely, the building at its far
     end is destroyed too.
  3. That building's own conduits then burn, and so on down the tree.

  Knocking out a well-placed Outpost can wipe out everything built from
  it.
- Conduit nodes don't take damage. The Surge is the only weapon that
  attacks along conduits.

## What can be launched

There are eighteen items, in three levels. An item's level is also its
energy cost. Every item flies as chapter 01 describes.
- An Outpost can launch any item.
- A Battery can launch only the attacking weapons: Shell, Scatter Shell,
  Seeker, Pulse, Surge, Rover and Worm. It launches them nearly twice as
  far as an Outpost.

| Level | Buildings (with a conduit) | Free-standing units | Weapons and tools |
|---|---|---|---|
| 1 | Interceptor, Spire | Pontoon | Shell, Scatter Shell, Repair Pod |
| 3 | | Sky Probe, Proximity Charges | Seeker, Pulse, Surge, Salvager |
| 7 | Extractor, Barrier, Battery, Outpost | Rover | Worm |

What each item does:
- **Outpost:** Launches any item. Only the Citadel earns income.
- **Battery:** Launches only the attacking weapons, nearly twice
  as far as an Outpost.
- **Extractor:** Earns income. When it's destroyed, it explodes
  violently, unless it was disabled at the time.
- **Barrier:** Raises a dome that stops enemy shots from
  entering it. Friendly shots pass through it.
- **Interceptor:** Shoots down an enemy shot that comes
  within range. It then needs one turn cycle to reload.
- **Spire:** Sees further through the fog of war.
- **Pontoon:** Can only land on water. It turns that water into ground
  that can be built on. Pontoons are the only way to get conduits across
  water.
- **Sky Probe:** Rises, then stays where it is in the air as a
  lookout. It has no conduit and is easy to destroy.
- **Proximity Charges:** Split into three at the top of their arc. Once
  everything has settled, each Charge is armed. An armed Charge goes off
  when a shot flies close to it, or when something lands or drives close
  to it.
- **Rover:** Can land anywhere, even underwater. At the end of each
  round, it drives a short way in a straight line, along the heading it
  was launched at. It explodes when it reaches an enemy unit or conduit.
  When it reaches one of its own side's units or conduits, it just
  stops, without exploding, and stays there.
- **Shell:** Explodes when it hits a unit or the ground.
- **Scatter Shell:** Splits into three smaller fragments at the top of its
  arc.
- **Seeker:** From the top of its arc, it homes in on the
  nearest enemy unit within range ahead of it.
- **Pulse:** Disables every unit in a wide area for about one turn cycle,
  including the player's own. It also damages units close to the blast.
- **Surge:** Damages the unit it hits. The damage also travels up
  that unit's conduit toward its launcher, growing weaker as it goes. The
  Surge is the only weapon that can hit a conduit directly. When it does,
  the damage travels both ways along the conduit.
- **Worm:** Disables the units it hits. Each turn cycle, it spreads one
  conduit further, both outward and back toward the Citadel. Each enemy
  unit it leaves behind loses 1 armor. The Worm never destroys a unit.
- **Repair Pod:** Restores 1 armor to the unit it hits. If it hits
  the ground instead, it repairs a damaged unit next to where it lands.
- **Salvager:** Takes armor from the unit it hits. At the end of the
  round, the launching player gets that armor back as energy.
  - On one of the player's own units, it takes all the armor and
    removes the unit.
  - On an enemy unit, it takes at most 3.

Units have **armor**. Weapons do **damage**, and each point of damage
removes a point of armor. A unit with no armor left is destroyed.

## Winning and losing

- A player whose **Citadel is destroyed is out** of the game for good.
  Every building hangs off the Citadel, so the player's whole network
  burns away after it. Only their free-standing units are left.
- The game ends when only one team or player is left. That team or
  player wins.
- If no human players are left in the game, it ends with no winner.
- A player who disconnects stops taking turns. Their Citadel stays on
  the map, and it still counts until someone destroys it.

## Seeing the game

- **Fog of war** (when it's on): Ground that nobody on your team can see
  is black. Your units, conduits and shots reveal the area around them.
  Explosions and signs of damage show through the fog.
- **Camera:** The view scrolls over the wrapping map. The Watch Cam and
  Chase Cam buttons follow shots, both other players' and your own. The
  map has no edges, so scrolling off one side comes back on the other.
- **Minimap:** It shows the whole map, with every unit as a dot. It also
  marks your view, flashes when one of your units is hit, and shows
  shots in flight. Clicking it moves the camera there.
- **Sound:** Sound effects and an aide's voice call out events. The
  music grows more intense as you do better, and changes again if things
  go badly.
- **Chat:** Players can send messages to everyone, to their team, or to
  a single player.

## Online play (a requirement, not a design)

- Players can host a game, browse the games on offer, and join one. Once
  a game starts, no new players can join.
- **Every client must compute exactly the same game.** The rules must be
  deterministic. The same launches, in the same order, must give the
  same result on every machine. This spec doesn't say how to achieve
  that, or how the networking should work. Those are design decisions.
- **Replays:** A game can be recorded and played back. A replay is the
  list of launches and passes.

## Glossary

| Term | Meaning |
|---|---|
| Item | Anything on the build menu. There are 18. |
| Unit | Anything that stays on the map after it lands: the buildings and the free-standing units. |
| Building | A unit joined to the network by a conduit: Outpost, Battery, Extractor, Barrier, Interceptor, Spire. |
| Free-standing unit | A unit with no conduit: Pontoon, Sky Probe, Proximity Charges, Rover. |
| Citadel | The Outpost a player starts with. Losing it puts the player out. It looks the same as any other Outpost. |
| Outpost | A launcher that can launch any item. |
| Battery | A launcher that launches only the attacking weapons, nearly twice as far as an Outpost. |
| Launcher | An Outpost or a Battery. |
| Conduit | The chain of nodes on the ground that joins a building to the launcher it came from. |
| Conduit node | One of the separate studs a conduit is made of, about 15 px apart. The rules only ever look at the nodes. |
| Energy Vent | A glowing patch of ground. An Extractor earns more there. |
| Level | An item's group on the build menu: 1, 3 or 7. It's also the item's energy cost. |
| Turn | One player's chance to launch once or to pass. |
| Round | A series of turns. It lasts until every player has passed, is out, or can't afford anything. Income is paid at the end. |
| Turn cycle | Roughly, the time from one of a player's turns to their next. |
| Pass / Skip | Giving up your turns for the rest of the round. Your energy carries over to the next round. |
| Shot clock | The time limit on a turn. |
| Armor | A unit's health. |
| Damage | What a weapon takes off a unit's armor. |
| Disabled | Doing nothing for a while, after a Pulse or a Worm, or while an Interceptor reloads. A disabled launcher can't launch. An Extractor disabled when the round ends earns nothing. |
| Fog of war | The black covering over ground your team can't see. |
| Faction | One of four sides. It changes only the look and the aide's voice. |

## Chapters

These are the planned chapters. The README shows how far each one has
got.

| # | Chapter | Covers |
|---|---|---|
| 00 | The game at a glance | This page |
| 01 | Launching and flight | Aim, the power meter, flight, wind, landing |
| 02 | The map and terrain | Map sizes, wrapping, planets, terrain levels, slopes, water, Pontoons, Energy Vents, start positions, generated maps |
| 03 | Turns, rounds and energy | Order of play, the shot clock, passing, the end of a round, income, victory |
| 04 | Units | Each item's numbers (armor, size, height, cost) and what it does once landed |
| 05 | Buildings and conduits | Landing a building, laying a conduit, what breaks a conduit, and destroying a building and everything below it |
| 06 | Weapons and tools | Collisions in flight, explosions and damage, Barriers, Interceptors, and each weapon and tool |
| 07 | Rovers | How they move between rounds, and what they hit |
| 08 | Fog of war | What reveals what, and for how long |
| 09 | Computer players | Fair play, personalities, and a playbook of strategy and tactics |
| 10 | Screen and controls | Layout, camera, minimap, build menu, keys, game menu |
| 11 | Sound and music | Effects, aide lines, dynamic music |
| 12 | Online play and replays | Lobby, hosting, joining, dropping out, what a replay records |
| A | Example scenarios (appendix) | Short scenarios and their outcomes, for chapters 01 to 08 |
