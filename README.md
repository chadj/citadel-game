# Lunar Citadel

A turn-based artillery and base-building game for 2 to 4 players, in
the browser. Each player starts with a Citadel and launches buildings
and weapons from it in ballistic arcs. Every building stays joined to
its launcher by a conduit, so each player's base grows as a network
across a map that wraps on all four edges. The aim is to find and
destroy the other players' Citadels, which look exactly like ordinary
Outposts.

**Play it:** https://chadj.github.io/citadel-game/ (on a phone or
tablet, "Add to Home Screen" plays it full screen).

- Play on one screen (hot seat), against computer players, or online.
- Seven computer personalities, from hardest to easiest.
- Teams, fog of war, wind and a shot clock, chosen by the host.
- Twelve maps, two drawn by hand and ten made by the game's own map
  generator, or a new map generated with your choice of settings.
- Saved replays.

Built with [Phaser 4](https://phaser.io) and plain JavaScript modules.

## Running it

Needs Node.js 22 or later.

```sh
npm install
npm start
```

Then open http://localhost:8080. The same server hosts online games:
other players on your network open the same address with your machine's
name or IP in place of `localhost`. Set `PORT` to use another port.
The server keeps the replay of every online game that finishes, as a
replay file in `replays/` (set `REPLAY_DIR` for another folder); open
one from the game's Replays screen. Games under way are written down in
`games/` (set `GAMES_DIR` for another folder), so they carry on if the
server restarts: players' tabs reconnect by themselves and take back
their seats. After a change to the rules, a game started under the old
rules ends instead, and its replay is kept.

On a phone or tablet, use the browser's "Add to Home Screen" to install
the game; opened from there it fills the screen. Android's Chrome does
this only from https or `localhost`; from a plain http address it adds
a shortcut that opens in the browser.

### Hosting the page apart from the server

The page can be a static site (GitHub Pages, say), with `npm start`
running elsewhere only as its game server:

```sh
node tools/build-site.js --server wss://example.com/net
```

This builds the site in `site/`, with the minified Phaser, and points
online play at that server (without `--server`, the page connects to its
own host). On the server, set `ALLOWED_ORIGINS` to the page's site, such
as `https://example.github.io`, so only its pages may connect. The
workflow in `.github/workflows/pages.yml` builds and publishes the site
to GitHub Pages on each push to `main`, with the server's address taken
from the repository variable `GAME_SERVER`.

## Tests

```sh
npm test
```

Tests use Node's built-in runner. They cover the rules, the worked
examples in the spec's Appendix A, the computer players, the map
generator, the online server and the parts of the client that don't
need a browser.

## How it's built

- **The rules** (`src/rules`) are deterministic plain JavaScript, with
  no Phaser or browser code, so every machine and the server compute
  the same game.
- **Online play** is lockstep: players send only their moves, every
  machine plays them, and the server checks that their states agree.
- **A replay** is the game's settings plus its list of moves. Replay
  files and map data are described in
  [`docs/formats.md`](docs/formats.md).
- **Phaser** (`src/client`) handles drawing, input, the camera, the
  interface and sound.

| Folder | What's in it |
|---|---|
| `src/rules` | The game rules |
| `src/ai` | Computer players |
| `src/mapgen`, `src/maps` | The map generator and the maps |
| `src/client` | The browser game |
| `src/server`, `src/net` | The online lobby and games |
| `tools` | The development server, map building and checks |
| `test` | Automated tests |

## The spec

`spec/` is the complete description of how the game behaves, and the
only source of truth for building it. Choices the spec leaves open are
recorded in `docs/decisions.md`, and `docs/provenance.md` says which
spec sections and decisions each part of the code implements.
`docs/formats.md` describes the replay files and map data. Every
image, sound and map is listed with its source and license in
`ASSETS.md`.

## License

AGPL-3.0-or-later. See `LICENSE`.
