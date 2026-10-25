# 11 — Sound and music

This chapter covers the game's sound: the effects and where they're
heard, the aide's voice, the music that follows the game, and the
volume settings.

## Volumes

There are four volume settings, plus a switch for the aide:

| Setting | Covers |
|---|---|
| Sound effects | Everything that happens on the map |
| Music | The game's and the menus' music |
| Voice | The aide |
| Interface | Clicks, chat, and the turn and clock sounds |
| Aide Chatter | Whether the aide comments on the game. On by default. |

- By default, effects are loud and the music sits well under them, so
  the aide and the interface sounds stay clear.
- Players set them on the Options screen, and the volumes also in the
  game menu (chapter 10).
- On the Options screen, letting go of a slider plays a short sample of
  that kind of sound, at the new volume.

## Where effects are heard

Most effects come from a place on the map. How loud each one is, and
which side it comes from, depends on where it is compared with the view.

- **Effects are positional.** They're louder near the view, and panned
  left or right by where they are. They fade out about 1,300 px away.
  Distances go the short way around the map.
- **Sounds in the fog** play at half volume, from the middle, with no
  lean. So players hear that something happened in the fog, but can't
  tell where.
- **Sounds that follow their source.** A few sounds keep moving with
  what made them, and change volume and pan as it goes:
  - the launch sound, with the shot;
  - the Seeker's sound, once it has locked on;
  - an Interceptor missile's sound, with the missile.
- **Keep the mix clear.** Limit how many effects play at once. Vary
  sounds that repeat, so a burst of the same event doesn't sound like an
  echo.

## The effects

Every event players should notice has a sound. The sounds themselves
are up to the implementation. They fall into these groups:

- **Launches.** Pressing Launch makes an interface sound. A shot leaving
  a launcher makes a launch sound, and a Battery sounds different from
  an Outpost.
- **Explosions** sound bigger for bigger blasts. Units that blast when
  they're destroyed (Extractors, Proximity Charges and Rovers) can be
  told apart by sound.
- **Destruction** without a blast makes a plainer sound. That includes
  a disabled unit, which never blasts. A salvaged unit makes no sound
  as it goes.
- **Landings and water.** Units thud as they land, and conduit nodes
  tap as they settle. Anything coming down in water splashes, more
  heavily for heavier things.
- **Tools and special weapons** each have their own sound as they land,
  and while they work: repairing, salvaging, infecting, the Pulse
  charging up, and a Surge crackling along a conduit, weaker as its
  damage fades.
- **Defenses.** Interceptor fire, a missile that misses, anything
  crossing a Barrier's dome, and a Rover nearing an enemy dome can all
  be heard.
- **The Seeker and the Sky Probe** make a sound as the Seeker locks on,
  and as the Sky Probe stops.
- **Interface sounds:** another player's turn starting, the clock
  warning, the buzzer when time runs out, and chat.

- **The turn and clock sounds** are heard only by the player they're
  for: the turn-start sound by everyone except the player whose turn it
  is, and the buzzer by the player who timed out.

## The aide

Each faction has its own aide, with its own voice. A player hears
their own faction's aide, commenting on the game from their point of
view.

### What it comments on

The events come in three tiers, from most to least important.

- **Essentials:**
  - It's your turn. Without a shot clock, it reminds you now and then.
  - It's your turn, but you have no working launcher.
  - The round is over.
  - Your Citadel was destroyed.
  - Victory, or defeat.
- **News:**
  - You knocked out an enemy, or someone else did.
  - A teammate was knocked out.
  - A player isn't responding, or was disconnected.
  - The shot clock is three quarters gone.
- **Chatter:**
  - You built an Extractor on a vent.
  - Your shot hit an enemy.
  - You hit your own side, or a building of yours failed to land.
  - One of your units was damaged or destroyed off screen, during
    another player's turn.
  - One of your Barriers was disabled, or your side disabled an enemy
    Barrier.

- Each event has a few different lines. The aide picks one at random,
  but doesn't repeat the same line twice in a row for the same event.
- Most events only count on the player's own turn, or for their own
  units. "Off screen" means the unit isn't in the player's view.

### When it speaks

- **It waits a moment** before speaking, so the action can play out
  first.
- **It never talks over itself.** It finishes a line, pauses briefly,
  then moves on.
- **More important news wins.** News waiting to be said is replaced by
  anything more important. Less important news is dropped.
- **Stale reminders are dropped.** A turn reminder that's still waiting
  when the turn has passed, or when something is moving, is dropped.
- **With Aide Chatter off**, the aide says only the essentials.
- **Once a player's Citadel is destroyed**, their aide says only
  the end of each round, and defeat or victory, from then on.

## The music

The music adapts to the game.
- It grows more intense as more happens around the player.
- It turns upbeat when things go well for the player, and darker when
  they go badly.
- Changes fall on musical boundaries, so the music always flows.

How it's built is up to the implementation.

### What it listens for

- **Excitement** builds when the action comes near the player: blasts,
  Interceptor fire, and their own buildings landing.
- **Things going well:** hurting the enemy, strengthening their own
  position, and enemy defenses going down.
- **Things going badly:** losing units or armor, their own defenses
  going down, and enemy defenses coming up.
- With nothing happening, the music calms down, and drifts back toward
  neutral.

### Other music

- **The menus** have their own song.
- **After a game**, the summary screen plays a victory song or a defeat
  song. Then the menu song returns.
- **Leaving a game** fades its music out over about a second, then the
  menu song starts.

## Menu sounds

- Buttons on the menu screens make a sound when the pointer moves onto
  them, and another when they're clicked.

## Left to other chapters

- The volume sliders and the Options screen: chapter 10.
- Factions: chapter 12.
- Which events make which effects on screen: chapters 05 to 07.
