# 12 — Online play and replays

This chapter covers how players get into a game together: the lobby,
setting up a game, and starting it. It also covers players who drop out,
and what a replay records.

It describes what players need, not how the networking works. How
machines talk to each other is a design decision.

## Ways to play

- **Online.** Players on different machines play together. One player
  hosts the game, and the others join it.
- **Against the computer.** One human plays against one to three
  computer players (chapter 09).
- **Hot seat.** Several humans share one screen, taking turns at it
  (chapter 10). Computers can join them too.

All three use the same game setup. Online play adds the lobby.

## The lobby

- **Players choose a name** before they enter. Their name is remembered
  between visits. It can also be changed on the Options screen (chapter
  10).
- **Browsing.** The lobby lists the games that are waiting for players.
  For each game it shows:
  - the game's name;
  - the map;
  - how many players have joined, and how many it takes;
  - the host's settings: the shot clock, the wind and fog of war.
- The list keeps itself up to date. Games appear when they're hosted,
  and disappear when they start or are closed.
- **Hosting.** A player hosts a game by giving it a name and choosing
  the settings. They then wait in the game's setup screen for others
  to join.
- **Joining.** A player picks a game from the list and joins it. They
  go to its setup screen.
  - A game that's full can't be joined.
  - **Once a game starts, no one new can join it.**

## Setting up a game

The setup screen shows the seats, the map and the settings. Online,
everyone in the game sees it, and it updates as anyone changes
something.

### What each player chooses

- **Faction.** One of the four factions. Factions only change how a
  player's units and interface look, and the aide's voice (chapter
  11). Their units are the same. More than one player can choose the
  same faction.
- **Color.** One of six colors. No two players in a game can have the
  same color.
  - A player who asks for a color someone else has gets a random free
    color instead.
  - If two players ask for the same color at once, only one gets it.
    The other gets a random free color.
- **The player's faction and color are remembered** for the next game.
- A player who joined can change only their own faction and color.
  Everything else is the host's.

### What the host chooses

- **The map.** Any map that comes with the game, or a generated map
  (chapter 02).
  - The map list shows each map's name, its size, and how many players
    it suits.
  - Every player must have the map. A map a player doesn't have is sent
    to them automatically (chapter 02).
- **The shot clock:** off, 15, 30 or 60 seconds. 60 is the default
  (chapter 03).
- **The wind:** None, Light, Medium or Strong. The default is None. The
  wind itself is chosen at random from the level when the game starts
  (chapter 01).
- **Fog of war:** on or off. On is the default (chapter 08).
- **The host's choices are remembered** for the next game they host.

### Computer players

- **The host can add computers** to empty seats, up to three, as long as
  at least one human plays.
- For each, the host picks a personality, from hardest to easiest, or a
  random one (chapter 09).
- **A computer gets a random faction and color** when it's added: a
  faction no other player has, if one is free, and a color no other
  player has.
- The host can take a computer out again before the game starts.

### Teams

- **By default, there are no teams.** Every player plays for themselves.
- **The host sets teams** by putting each player on a team, or on none.
  How that looks is up to the implementation.
- **The team layouts** that the game supports:
  - 4 players: two teams of two, or one player against a team of three;
  - 3 players: one player against a team of two.
- A player alone on a team is simply on no team.
- What teammates share, and what they don't, is in chapter 00. How a
  team wins is in chapter 03.

### Starting

- **Each player says when they're ready.** A Ready button shows the
  others that they've finished choosing.
- **The host starts the game** once everyone is ready.
- **A game needs at least two players** to start, counting computers.
- **Chat.** Players in the setup screen can send each other messages.

## When the game starts

Some things are chosen at random at the start. They're chosen once, and
every player gets the same result:
- **the order of play** (chapter 03);
- **each player's start position** (chapter 02);
- **the wind** (chapter 01);
- **a generated map**, if the host chose one (chapter 02).

Then every player's game begins at the same point: the first player's
first turn of round 1.

## Every machine plays the same game

- **Every machine runs the whole game.** It receives every player's
  moves, and works out what happens itself.
- **The same moves must give the same game** on every machine. The
  rules must be deterministic (chapter 00).
- **A move is one of:**
  - a launch: which launcher, which item, the heading and the power;
  - a pass;
  - time running out on the shot clock.
- **Nothing in the rules is random.** The only random things in a game
  are:
  - the choices made at the start (above);
  - the computers' thinking (chapter 09);
  - things that only change how the game looks or sounds.
- **Computers.** Only one machine thinks for each computer. It then
  sends the computer's move to everyone, like any other move (chapter
  09). The computers carry on when a human drops out.
- **Moves arrive in order.** Every machine applies the same moves in the
  same order. A move only counts if it's from the player whose turn it
  is.
- **The shot clock must be fair.** A player's turn shouldn't be cut short
  because of a slow connection. Whichever machine keeps the time, every
  player must see the same time running out (chapter 03).
- **A check is welcome.** Machines can compare their game states from
  time to time, so that a difference is found quickly.

## Dropping out

### Losing touch

- **A player who goes silent** is first marked as not responding, then
  disconnected:
  - after about a minute of silence, the other players are warned that
    the player isn't responding;
  - after about two minutes, the player is disconnected.
- **A player who quits** from the game menu is disconnected at once
  (chapter 10).
- **The other players are told** each time:
  - a message appears in the chat;
  - the aide says so (chapter 11);
  - the screen shows them as disconnected, and so does their marker in
    the order of play (chapter 03).

### What happens to a disconnected player

From then on (chapter 03):
- their turns are skipped, and if it was their turn, they pass;
- their Citadel stays on the map, and their side stays in the game
  until someone destroys it;
- they get no income;
- their units keep working: Barriers, Interceptors and Rovers still act.

So the others have to finish off a player who has left. The game goes on
until only one side is left.

- **If two or more sides are left but no connected human has a Citadel**,
  the game ends with no winner.
- **Choice:** an implementation may let the remaining side claim victory
  when every opponent has left, so they don't have to knock out an
  undefended Citadel.

### Rejoining

Letting a disconnected player come back is a welcome feature, but not
required. If an implementation offers it:
- **The player takes back their own seat**, and only that seat.
- **They catch up at once.** Their game is brought up to the current
  move, without playing out every shot on the way.
- **The game doesn't wait for them.** The shot clock keeps running, and
  the other players carry on while they reconnect.
- **The others are told** that the player is back. The screen and their
  marker in the order of play show them as connected again.
- **A player who reconnects before they're disconnected** simply carries
  on, as if they had never left.
- **A disconnected player who rejoins** gets their turns and income
  back from then on.

## Replays

### What a replay records

A replay is a record of the game's setup and its moves. Playing it back
means running the game again with the same moves.

- **The setup:**
  - each player's name, faction, color and team;
  - which players were computers;
  - the order of play, and each player's start position;
  - the map, the shot clock, the wind as it was rolled, and fog of war.
- **The map itself**, if it isn't one that comes with the game. A
  generated or custom map must be saved with the replay, or the replay
  can't be played back.
- **Every move, in order:** who moved, and whether it was a launch, a
  pass, or time running out. For a launch: the launcher, the item, the
  heading and the power.
- **Players dropping out and rejoining**, at the point where it
  happened. Without this, a replay of a game with a disconnect would
  play back differently.
- **The rules' version.** A replay made under different rules can't be
  played back correctly. The game should refuse it, or say that it may
  not play back the same.

A replay doesn't record:
- the computers' thinking: their moves are recorded like anyone else's;
- chat;
- anything that only changes how the game looks or sounds.

### Saving a replay

- **From the game summary** at the end of the game, a player can save a
  replay (chapter 10).
- They give the replay a name. It's added to their saved replays.
- **There's no fixed number of replays** a player can keep. They can
  delete the ones they no longer want.
- **A replay can be saved as a file**, so players can keep it outside the
  game, or share it with others.
- **Choice:** an implementation may also save every online game's
  replay by itself, or let players save a replay during a game.

### Watching a replay

Players watch replays from the main menu.

- **Loading.** The game lists the saved replays. The player picks one
  to load it.
- **A replay file** can be opened too, such as one another player
  shared.
- **Playing.** The game plays out as it happened, move by move, with the
  same animations and sounds.
- **Controls:**
  - Play and Pause;
  - Watch Cam and Chase Cam, which work as in a game (chapter 10);
  - Follow Player, which chooses which player to follow.
- **The whole map can be seen**, but the fog of the player being
  followed is still shown, faintly. So the viewer
  can see what each player could see, and how they used their Spires and
  Sky Probes.
- **The interface is simpler than in a game.** The viewer can't launch
  or build, so there's no build menu or launching view.

## Determinism checks

A whole game can't be checked against another implementation's
results. Tiny differences in the flight arithmetic grow as the game
goes on (see Appendix A). What online play needs instead is that an
implementation always agrees with itself. These checks test that.

### The game state

Each check compares the **game state** after every move. It covers
everything the rules depend on:
- the round, whose turn it is, and who started the round;
- each player's energy, energy put aside, and whether they're in or out
  of the round or the game;
- every unit: its kind, owner, position, base, armor, and whether it's
  working, disabled or infected, and for how long;
- every conduit and its nodes;
- the fog of war counts for every side;
- the counts the rules keep;
- whether the game is over, and who won.

It leaves out anything that only changes how the game looks or sounds,
such as the camera, animations and effects.

### The checks

1. **The same game twice.** Play a game from its setup and moves. Then
   play it again from scratch on the same machine. The game state must
   be the same after every move.
2. **On different machines.** Play the same setup and moves on
   different devices, browsers and operating systems. The game state
   must be the same on all of them after every move. Results mustn't
   depend on the machine the game runs on.
3. **Saved and played back.** Save a game as a replay, then play the
   replay back. The game state must be the same as in the game itself
   after every move, including where players dropped out or rejoined.
4. **Rejoining,** if the implementation offers it. A player who
   rejoins must end up with the same game state as everyone else once
   they've caught up.
5. **Computers.** A game with computers must replay the same, from the
   recorded moves alone. Their thinking is never repeated (chapter 09).

## What players see

- **The setup screen** shows each seat with the player's name, faction,
  color and team. A computer's seat shows its personality.
- **Ready.** Each player's seat shows whether they're ready.
- **Chat** in the setup screen works as in a game (chapter 10).
- **During a game**, a player who isn't responding or has disconnected
  is shown on screen, and the aide announces it.

## Left to other chapters

- Generated maps and start positions: chapter 02.
- The order of play, the shot clock, and how the game ends: chapter 03.
- Computer personalities: chapter 09.
- The game summary, chat, and the game menu's Quit: chapter 10.
- The aide's announcements: chapter 11.
