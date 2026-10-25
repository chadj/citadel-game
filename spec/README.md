# Lunar Citadel — behavioral specification

This folder describes how the game should behave, in enough detail to
implement it.

## Ground rules for every chapter

- **Describe behavior, not code.** Say what a player sees and what
  happens in the game. Give the numbers needed to reproduce it. Leave
  the program's structure to the implementation.
- **Numbers are welcome.** Speeds, ranges, damage, timings and costs are
  how the game feels, so they belong here. They come in two kinds:
  - **Exact values** are the ones players see: costs, energy, the energy
    cap, income, armor, damage, the shot clock settings and player
    counts. Use them as given.
  - **Targets** are everything else: distances and heights in pixels,
    and times in seconds. They're rounded on purpose. The implementation
    picks its own exact values near them, and tunes them by playing.
  - Where targets depend on each other, the chapter says so: for
    example, a Battery reaches about 1.8 times as far as an Outpost.
    Keep those relationships when choosing exact values.
  - Once chosen, the exact values are part of the rules. Every client
    must use the same ones.
- **Exact arithmetic is not a goal.** The game must be deterministic,
  so that every client computes the same result. It doesn't have to match
  any other implementation to the pixel. Appendix A gives plain example
  scenarios, as a help rather than a requirement.
- **Time is in seconds.** The game runs in fixed steps, called ticks.
  30 ticks a second is a good choice, but the rate is up to the
  implementation.
- **List quirks as choices.** Some behaviors look accidental. The
  chapter then says what players experience, and leaves it to the
  implementation to keep them or not.
- **Write plainly.** Use short sentences, one idea each. Put steps and
  conditions in lists rather than in one long sentence.

## Chapters

| # | Chapter | Status |
|---|---|---|
| 00 | [The game at a glance](00-overview.md) | Draft for review |
| 01 | [Launching and flight](01-launch.md) | Draft for review |
| 02 | [The map and terrain](02-map.md) | Draft for review |
| 03 | [Turns, rounds and energy](03-turns.md) | Draft for review |
| 04 | [Units](04-units.md) | Draft for review |
| 05 | [Buildings and conduits](05-buildings.md) | Draft for review |
| 06 | [Weapons and tools](06-weapons.md) | Draft for review |
| 07 | [Rovers](07-rovers.md) | Draft for review |
| 08 | [Fog of war](08-fog.md) | Draft for review |
| 09 | [Computer players](09-computers.md) | Draft for review |
| 10 | [Screen and controls](10-screen.md) | Draft for review |
| 11 | [Sound and music](11-sound.md) | Draft for review |
| 12 | [Online play and replays](12-online.md) | Draft for review |
| A | [Example scenarios](appendix-a-example-scenarios.md) | Draft for review |

Chapter 00 lists all the planned chapters.
