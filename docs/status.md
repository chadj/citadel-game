# Status

Where the work stands, and what's next. Read this after `CLAUDE.md`
when picking the work up. Updated 2026-10-26.

## Done
Milestones M0 to M10: the rules, maps and the map generator, the
browser game (hot seat, replays, options and key rebinding, the
narrow-screen layout), computer players, sound and the aide, fog of
war, and online play (lobby, setup, lockstep games, taking back a seat
after a dropped connection). `docs/provenance.md` says what each part
implements; `docs/decisions.md` (D1 to D58) records every choice.

Most recent work:
- Landforms (D55): corner-level maps with cliffs, channels, ponds and
  craters; the maps were rebuilt for it.
- Computers and water (D55, D58): Pontoons aimed where they'll land,
  and only where water is in the way.
- Online fixes (D56): numbered repeat names, duplicated tabs, tabs in
  the background; Skip coming back after the other player passes.
- The order of play doesn't show who has passed (D57).

## Next: M11, Polish
- **AI speed on large maps.** Thinking peaks around 4 to 7 s on
  64-tile maps (the spec allows 20 to 30 s, but quicker is better).
- **Screen tests:** more automated checks of the Phaser screens.
- **The computers' known gaps:** see "Computer players" in
  `docs/provenance.md`.
- **A sound listening pass,** by ear: recipes, levels and the music's
  layers.
- **The aide's voices** need more work, especially on Android (the
  user's request; see "Sound and music" in `docs/provenance.md`).
- **Online known gaps:** see "Online play" in `docs/provenance.md`.
  Two of them are the spec's options, not yet offered:
  - rejoining after being disconnected (spec 12, Rejoining);
  - letting the remaining side claim victory when every opponent has
    left (spec 12, a Choice).

## Open questions for the user
- Should damage from a chain of explosions (one blast setting off
  another) count as a "hit" for the aide's lines? Today burns along a
  conduit don't count; blast chains do.

## Offered, not yet asked for
- Choosing the map size in the online lobby.
- Higher-resolution terrain.

## Waiting on the user
- `docs/spec-changes.md` has proposed spec wording for D38, D42, D53,
  D55 and D56. The user applies it to `spec/`.

## Checking work by hand
- `npm start`, then open http://localhost:8080. For an online game,
  open two windows or two browsers; each is a player.
- The server runs the rules and computers: restart it after changing
  `src/rules`, `src/ai` or `src/server`.
- `node tools/ai-match.js "<map>"` plays two computers against each
  other with no browser, and prints their launches, failed landings,
  where their Pontoons went and the slowest think (`--map` draws the
  map). See the file's header for options.
- `node tools/online-check.js` (with `npm start` running) plays an
  online game between two tabs of a headless Chrome, and checks after
  every move that both agree and only the right player can act.
