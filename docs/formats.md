# File and data formats

The formats the game reads and writes: replay files, and the map data
inside them. All are our own design (spec 12 says what a replay must
record, not how; spec 02 leaves map storage to us). Everything is JSON
or plain JavaScript data.

- [Replay files](#replay-files)
- [Setup](#setup)
- [Moves](#moves)
- [Map data](#map-data)
- [Maps in the source](#maps-in-the-source)
- [When old files stop working](#when-old-files-stop-working)
- [Other saved data](#other-saved-data)

Units used throughout: positions in **whole pixels** with x growing east
and y growing south; angles in **whole degrees**, 0 east and 90 south
(clockwise on screen). The rules work in fixed point inside (1 px =
1024), but files hold plain pixels.

## Replay files

A replay is the game's setup and its moves (spec 12, What a replay
records; CLAUDE.md, Architecture). Playing it back runs the whole game
again from them; nothing else is stored.

A saved replay file is named after the replay, with the local date and
time it was saved to the second, so files don't collide in a downloads
folder: `<name> YYYY-MM-DD HH-MM-SS.lcreplay.json`, as
`Duel 2026-10-28 14-32-05.lcreplay.json` (characters other than letters,
digits, spaces, `_` and `-` are left out of the name). It holds one
JSON object:

```json
{
  "format": "lunar-citadel-replay",
  "rulesVersion": 3,
  "setup": { "...": "see Setup" },
  "moves": [ { "...": "see Moves" } ]
}
```

| Field | What it is |
|---|---|
| `format` | Always `"lunar-citadel-replay"`. Only in files: it marks the file as a replay. |
| `rulesVersion` | The rules' version the game was played under (`RULES_VERSION`, `src/rules/version.js`). |
| `setup` | Everything chosen or rolled before play, including the whole map. |
| `moves` | Every move that counted, in the order played. Refused moves aren't recorded. |

A replay doesn't hold state hashes, chat, or anything shown on screen:
playing it back reproduces them. Code: `src/rules/replay.js` (recording
and playback), `src/client/core/replay-store.js` (files and the
browser's saved replays).

## Setup

```json
{
  "map": { "...": "map data, with positions; see Map data" },
  "players": [
    { "name": "Ada", "faction": 0, "color": 2, "team": null, "computer": false },
    { "name": "Computer 2", "faction": 3, "color": 4, "team": null, "computer": true, "personality": "warden" }
  ],
  "order": [1, 0],
  "starts": [{ "x": 450, "y": 450 }, { "x": 1470, "y": 1470 }],
  "clock": 60,
  "wind": { "level": 2, "dir": 135, "variation": -4100 },
  "fog": true
}
```

| Field | What it is |
|---|---|
| `map` | The map played on, as map data plus `positions` (below). Built-in and generated maps alike are stored whole, so a replay never depends on the maps the game ships with. |
| `players` | 2 to 4 players, at most 3 of them computers and at least one human. Each player is referred to elsewhere by their index in this list. |
| `players[].name` | A non-empty string. |
| `players[].faction` | 0 to 3: the faction's index (`FACTIONS`, `src/rules/constants.js`). |
| `players[].color` | 0 to 5: the color's index; no two players share one. |
| `players[].team` | A team name, or `null` for no team. The team layouts allowed are none, `2` with 3 players, and `2+2` or `3` with 4 (spec 12, Teams). |
| `players[].computer` | `true` or `false`. |
| `players[].personality` | Computers only: `warden`, `forge`, `lancer`, `mason`, `sentry`, `raider` or `drifter` (`src/ai/personalities.js`). |
| `order` | The order of play: player indexes, each once. Two teams of two must alternate. |
| `starts` | Each player's start, by player index: where their Citadel stands. |
| `clock` | The shot clock in seconds: 0 (off), 15, 30 or 60. |
| `wind.level` | 0 none, 1 Light, 2 Medium, 3 Strong. |
| `wind.dir` | The way the wind blows toward, in whole degrees. |
| `wind.variation` | A Medium wind's roll, as a fraction of 65,536, from -9,830 to 9,830 (±15%). 0 for the other levels. |
| `fog` | Fog of war on or off. |

`checkSetup` in `src/rules/setup.js` checks all of this; a game won't
start from a setup that fails it.

## Moves

A move is one of four kinds. `player` is a player index.

```json
{ "type": "launch", "player": 0, "launcher": 1, "item": "outpost", "heading": 45, "power": 620 }
{ "type": "pass", "player": 1 }
{ "type": "timeout", "player": 0 }
{ "type": "disconnect", "player": 1 }
```

| Kind | Fields |
|---|---|
| `launch` | `launcher`: the id of the player's launcher (an Outpost, a Battery or their Citadel). `item`: one of `outpost`, `battery`, `extractor`, `barrier`, `interceptor`, `spire`, `pontoon`, `shell`, `scatter`, `repair`, `charges`, `seeker`, `pulse`, `surge`, `salvager`, `rover`, `worm` (`src/rules/items.js`). `heading`: 0 to 359. `power`: 0 to 1000. `override` (optional, `true` or `false`): launch a building even though its conduit would start too close to one of the launcher's own (spec 05). |
| `pass` | Ends the player's turn, setting their energy aside. |
| `timeout` | The shot clock ran out on the player's turn. |
| `disconnect` | The player left an online game. It can come at any time, not only on their turn. |

**Unit ids.** Every unit, shot, conduit and effect takes the next id in
one count that starts at 1 when the game is created. The Citadels are
made first, in player order, so player *k*'s Citadel is id *k* + 1.
Every other id depends on what happened earlier in the game, which is
why a replay must play from its first move.

`applyMove` in `src/rules/game.js` checks each move; playback stops at a
move that doesn't play back.

## Map data

A map is plain data (`src/rules/terrain/map.js` reads and checks it):

```json
{
  "name": "Quiet Basin",
  "players": 4,
  "planet": "tundra",
  "corners": ["^^^+^^^++....", "..."],
  "water": ["..1.4.", "..."],
  "craters": [{ "x": 690, "y": 690, "r": 55 }],
  "vents": [{ "x": 960, "y": 600, "size": "large" }],
  "positions": [{ "x": 450, "y": 450 }]
}
```

| Field | What it is |
|---|---|
| `name` | The map's name. |
| `players` | The number of players it suits: 2, 3 or 4. |
| `planet` | `tundra`, `canyon`, `toxic`, `glacier`, `plains` or `desert`. It sets the heights of the raised levels and the look (spec 02, Planets; `src/rules/terrain/planets.js`). |
| `corners` | The terrain's levels, one string per row of corners, north first. |
| `water` | Optional: water marks, one string per row of tiles. |
| `craters` | Optional: painted craters, center and radius in pixels. Marks only; they don't change the terrain. |
| `vents` | Energy Vents: center in pixels, and `size` `large`, `medium` or `small`. |
| `positions` | In a setup only: every start position the map offers, in pixels. `setup.starts` says which went to whom. |

**Size.** The map is square: 32, 40, 48, 56 or 64 tiles a side, and a
tile is 60 px. It wraps at every edge, so it has as many corners as
tiles each way.

**Corners.** Corner (x, y) is the north-west corner of tile (x, y).
Each character is a level:

| Character | Level |
|---|---|
| `~` | Water |
| `.` | Ground |
| `+` | Plateau |
| `^` | Mountain |

A tile's four corners give its shape (spec 02, Landforms). The checks:
a tile mixes at most two neighboring levels (Ground and Plateau,
Plateau and Mountain, or Ground and Water; never Ground with Mountain),
and water never shares a tile with a raised corner.

**Water marks.** One character per tile: `.` for none, or a digit that
adds up these:

| Value | Meaning |
|---|---|
| 1 | A channel crosses the tile's north edge. |
| 2 | A channel crosses the tile's west edge. |
| 4 | The tile holds a pond. |

Each edge is recorded by one tile only (the one south or east of it), so
the tiles on both sides agree. Marks may only sit in tiles with no
raised corner.

## Maps in the source

The maps that come with the game (`src/maps/`) are map data with two
differences from what a setup holds:

- **`starts`** in place of `positions`: start positions grouped for
  every number of players and team layout (decision D16):

  ```js
  starts: {
    2: { '': [[a], [d]] },
    3: { '': [[a], [b], [d]], 2: [[d], [a, b]] },
    4: { '': [[a], [b], [c], [d]], '2+2': [[a, b], [c, d]], 3: [[d], [a, b, c]] },
  }
  ```

  The key under each number of players is the team layout: the sizes
  of the teams of two or more, smallest first, joined with `+` (`''` for
  no teams). Each group is one team's positions; a player on no team
  gets a group of one.
- **Generated maps** (`src/maps/generated.js`, written by
  `node tools/make-maps.js`) also keep the generator's `settings` and
  `seed`.

`mapData` (`src/maps/index.js`) turns either into what a setup holds:
it drops `starts`, `settings` and `seed`, and adds `positions`. A map
generated for one game (spec 02, Generated maps) goes into the setup
the same way.

## When old files stop working

- **A replay plays back only under the rules version it was made
  with.** A file whose `rulesVersion` differs from `RULES_VERSION` is
  refused with a message saying both versions (spec 12, What a replay
  records); the browser's saved replays from other versions are listed
  but can't be played.
- **Raise `RULES_VERSION`** whenever a change could make a recorded game
  play back differently: anything in `src/rules` that changes how a
  move plays out, or how a setup becomes a game. Changes to the screen,
  sound, computers' thinking, or the maps that come with the game don't
  need it, since a replay holds its setup, its map and every move.
- **Changing these formats.** A field added with a default that keeps
  old files playing the same doesn't need a new version. Anything else
  does, and this document should change with it.

## Other saved data

Kept in the browser's storage, not in files, and not meant to be moved
between machines:

- `lunar-citadel.replays`: the saved replays, a list of
  `{ id, name, saved, replay }`, where `saved` is an ISO date and
  `replay` is a replay as above, without `format`.
- `lunar-citadel.prefs`: the player's options (`src/client/core/prefs.js`).
