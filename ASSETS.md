# Assets

Every image, sound, font and piece of music in the game. One entry
each: the file, who made it or where it came from, and its license.

## Images
- `assets/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`:
  the home-screen icons (D60), drawn by this project's
  `tools/make-icons.js`. AGPL-3.0-or-later, as the code.

Everything else on screen is drawn by the game's own code: the
terrain picture (`src/client/render/terrain-art.js`), units, shots and
effects (`src/client/render/world.js`, `src/client/render/effects.js`)
and the interface (`src/client/ui/`).

## Maps
- `src/maps/handmade.js`: Quiet Basin and Shallow Crossing, drawn for
  this project. AGPL-3.0-or-later, as the code.
- `src/maps/generated.js`: ten maps made by this project's own map
  generator (`src/mapgen/generate.js`) through `tools/make-maps.js`,
  which lists each one's settings and seed. AGPL-3.0-or-later.

## Sound and music
- No sound files yet. Every effect and interface sound is made by the
  game's own code with the Web Audio API (`src/client/audio/synth.js`),
  and the music too (`src/client/audio/music.js`). AGPL-3.0-or-later,
  as the code.
- The aide speaks through the browser's own speech (the Web Speech
  API), with whatever voices the player's system has. No voice is
  shipped.
- To swap in recordings: sound effects go in `SOUNDS`
  (`src/client/audio/sounds.js`) as `files`, aide lines in
  `AIDE_FILES` by line id, and music in `MUSIC_FILES`
  (`src/client/audio/music.js`) by slot, with tempo and bars (decisions
  D49 to D51). Log each file here with its source and license.

## Fonts
None shipped. The interface uses the system's own sans-serif font.

## Libraries
- Phaser 4.2.1 (`node_modules/phaser`), MIT license, by Phaser Studio
  Inc. Not an asset, but served with the game.
- ws 8.18.0 (`node_modules/ws`), MIT license, by Einar Otto Stangvik
  and contributors. Runs online play's WebSocket on the server; not
  sent to players.
