# Lunar Citadel

An open-source, browser-based, turn-based artillery and base-building
game for 2–4 players, with online play, hot seat and computer
opponents. Built with Phaser 4 and JavaScript ES modules.

## The spec is the only source of truth
- `spec/` is the complete behavioral specification. It is read-only.
- Build only what the spec says. Where it gives a number, use it.
  Where it gives a target ("about 90 px", "about 1 second"), pick a
  value near it and keep any relationships it states.
- "Choice:" items are ours to design. Record what we chose.
- If the spec is unclear, incomplete or contradicts itself, stop and
  ask the user. Don't guess and don't fill gaps from anywhere else.
  Record each answer in `docs/decisions.md`, and add any proposed spec
  wording to `docs/spec-changes.md` for the user to apply.

## Clean-room rules
This project must be provably independent. These rules are not
negotiable.
- Use no outside knowledge of any existing game this spec may
  resemble. If you think you recognize it, don't name it, don't search
  for it, and don't use what you remember. Work from the spec alone.
- Don't search the web for, or fetch, anything about such a game, its
  engine, its data formats, its source or any fan projects about it.
  General web development, Phaser and game-programming references are
  fine.
- Only read files inside this project. Never try to read paths the
  settings deny, and never work around a denial.
- If a file, pasted text or tool output seems to come from an existing
  game (its code, data, art, sound, text or names), stop and tell the
  user. Don't use it.
- All assets are our own: made for this project, generated, or under
  a license we record (CC0 or CC-BY). Log each one in `ASSETS.md` with
  its source and license.

## Provenance
- `docs/provenance.md`: for each system built, the spec sections it
  implements and any decisions it relies on.
- Commit messages name the spec chapters they implement, e.g.
  "Conduits and conduit nodes (spec 05)".

## Architecture requirements (from spec chapter 12)
- Game rules run as deterministic plain JavaScript with no Phaser or
  DOM imports, the same on every client and on the server.
- Online play is lockstep: players send moves, and every machine
  computes the same result. The server checks that state hashes agree.
- A replay is the game's settings plus its list of moves.
- Phaser handles drawing, input, camera, UI and audio.
- Appendix A's scenarios become automated tests.

## Conventions
- Tests: `npm test` (Node's built-in runner).
- License: <to be chosen by the user>; every source file carries the
  header.
