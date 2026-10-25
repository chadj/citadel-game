# Assets

Every image, sound, font and piece of music in the game. One entry
each: the file, who made it or where it came from, and its license.

## Images
None yet. Everything on screen is drawn by the game's own code: the
terrain picture (`src/client/render/terrain-art.js`), units, shots and
effects (`src/client/render/world.js`, `src/client/render/effects.js`)
and the interface (`src/client/ui/`).

## Maps
- `src/maps/handmade.js`: Quiet Basin and Shallow Crossing, drawn for
  this project. AGPL-3.0-or-later, as the code.
- `src/maps/generated.js`: ten maps made by this project's own map
  generator (`src/mapgen/generate.js`) through `tools/make-maps.js`,
  which lists each one's settings and seed. AGPL-3.0-or-later.

## Fonts
None shipped. The interface uses the system's own sans-serif font.

## Libraries
- Phaser 4.2.1 (`node_modules/phaser`), MIT license, by Phaser Studio
  Inc. Not an asset, but served with the game.
