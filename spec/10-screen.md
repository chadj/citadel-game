# 10 — Screen and controls

This chapter covers what's on the screen during a game, how players
control it, and how the camera moves. Sounds are in chapter 11. The
lobby and setup screens are in chapter 12.

## Layout

The game screen must have these parts:

- **The main view**, which shows the map, scrolled to wherever the
  player is looking. It takes up most of the screen.
- **The game menu button.**
- **The shot clock** (chapter 03).
- **The next round's energy.**
- **The order of play** (chapter 03).
- **Whose turn it is** (chapter 03).
- **Skip**, to pass.
- **The build menu**, which turns into the launching view when an item
  is picked.
- **The energy the player has left.**
- **Launcher selection:** next, previous, and center on the selected
  one.
- **The Chase Cam and Watch Cam buttons.**
- **The wind indicator.**
- **The minimap.**
- **Chat.**
- **Players who are out or have left.**

How these are arranged, and how they look, is up to the
implementation. It should suit the screen, including phones. Every part
must be there and work as described.

A faction may give the interface its own style, in the player's color.
Only the look differs.

## The camera

### Where it starts

- Each player starts with their Citadel selected, and the view centered
  on it.

### Scrolling

- **Dragging with the right mouse button** scrolls the main view.
- **The arrow keys** scroll it too.
- **Dragging with the left mouse button, or a finger,** anywhere on the
  map scrolls it too. That lets players scroll on touch screens.
  - A drag only starts once the pointer has moved a little. So a simple
    tap or click still selects a launcher.
- **The minimap** moves the view (see The minimap, below).
- The map wraps around, so scrolling never hits an edge.

### Centering

- Centering the view on something, from the launcher buttons, a key or a
  minimap click, doesn't jump. The view glides there over about 0.7
  seconds, speeding up and then slowing down. It goes the short way
  around the map.
- Anything else that moves the camera stops the glide.

### A new turn doesn't move the camera

- When the turn passes, the view stays where the player left it. So does
  the selected launcher.
- Only the player, the tracking buttons and the preferences move the
  camera.

### Tracking shots

The Chase Cam and Watch Cam buttons each turn on a tracking camera. Both
are off at first. The game remembers the player's choice.

- **Chase Cam** follows shots launched by the player's own side, from
  the moment they're launched.
- **Watch Cam** follows other players' shots.
  - It starts as soon as the shot is somewhere the player can see. While
    the shot is hidden in the fog, the camera waits.
- **How it follows:** it keeps the shot's position over the map near the
  center of the view. It follows smoothly and catches up quickly, the
  short way around the map, without jumping.
- **When the shot ends**, the camera finishes moving to the shot's last
  position, and stops there.
  - It follows only the first shot to end. So it doesn't follow a
    Scatter Shell's fragments separately.
- **It doesn't come back** on its own. The view stays where the shot
  ended, unless the Snap Back preference is on.
- **The player can take over.** Scrolling or centering on a unit stops
  the tracking camera.
- Launching, or timing out, stops Watch Cam.
- **Rovers.** At the end of a round, the tracking cameras also follow
  Rovers as they drive (chapter 07), one Rover at a time:
  - **Chase Cam** follows each of the player's side's Rovers from its
    first step.
  - **Watch Cam** follows an enemy Rover from the first step it takes
    where the player can see it.
  - The camera moves the same way as for a shot. When the Rover stops
    or explodes, the camera finishes its move and stops.

### Preferences

Players can turn on four camera preferences. All four are off by
default. Players set them on the Options screen, outside a game (see
Options, below). The game remembers them from one game to the next.
- **Edge Scrolling:** the view scrolls when the pointer reaches the edge
  of the screen.
- **Select New Launchers:** an Outpost or Battery the player has just
  built becomes the selected launcher.
- **Steady Camera:** a tracking camera keeps still until the shot is
  nearly at the edge of the view, across or up and down. From then on,
  it follows the shot as usual, to the end. So a short shot that stays
  on screen doesn't move the view at all. It applies to shots, not Rovers.
- **Snap Back:** after a tracking camera has moved the view, the
  view goes back to where the player had it when the turn passes. If the
  player scrolls by hand in between, the view stays where they put it.

## Selecting a launcher

- **Click** any of your own Outposts or Batteries to select it. It
  works at any time, on anyone's turn, even on a disabled launcher.
  - The selected launcher is clearly marked.
  - Holding the button and moving scrolls the view instead, as if
    grabbing the map (see Scrolling).
- **Next and previous** step through your launchers, in the order they
  were built. Another control centers the view on the selected one.
- **When the selected launcher is destroyed**, the next one in build
  order is selected, wrapping round. The view doesn't move.
- **A disabled launcher stays selected.** It just can't launch.
- **Each launcher remembers its own heading** (chapter 01). Selecting it
  brings the heading back.

## The build menu

- **Items are grouped by level:** 1, 3 and 7, which is also what they
  cost (chapter 04).
- **A Battery offers only the items it can launch:** the attacking
  weapons (chapter 04).
- **Levels the player can't afford are disabled.** A level works only
  while the player has at least that much energy. If the open level
  becomes disabled, the menu drops to the next lower one. With no
  energy, the menu closes.
- **A disabled launcher** offers no items.
- **Each item shows its name** when the player points at it.
- **Picking an item** opens the launching view (below).
- **Planning ahead.** A player can browse the menu, pick an item, and
  turn the aim during other players' turns. Only Launch waits for their
  own turn.
- **When the menu resets.** The menu goes back to the open level's
  items:
  - when the player's own move is over: their shot has landed, they
    timed out, or they passed;
  - at the end of each round;
  - when they select a different launcher;
  - when the selected launcher is disabled.

  An ordinary change of turn doesn't reset it. So a page opened during
  someone else's turn stays open.
- **Changing launcher keeps the launching view** if the new launcher is
  the same kind as the old one, and both are working.
- **A unit limit.** An implementation may cap the number of units on
  the map. Near the cap, only items that leave nothing behind can be
  launched: Shell, Scatter Shell, Repair Pod, Seeker, Pulse, Surge,
  Salvager and Worm. Trying anything else shows a message saying why.

## The launching view

- **Its controls:**
  - turning the aim (chapter 01);
  - **Launch**, with the power meter, shown coarsely (chapter 01);
  - **Cancel**, to go back to the build menu. It works only until Launch
    is pressed.
- **The targeting marks** show on the map while the launching view is
  open (chapter 01). They're drawn over everything, including the fog.
- **The conduit marker.** When the new conduit would start too close to
  one of the launcher's own conduits, a marker shows on that conduit
  (chapter 05).
  - It shows for any item. Only buildings are held back by it: Launch is
    refused for a building while it shows.
  - Holding the override key while pressing Launch overrides it.
- **After a launch:**
  - nothing in the launching view works while the shot is in flight;
  - **the meter keeps showing the shot's power** until the player next
    picks an item. So the player can see roughly how hard they launched
    while the shot flies.
- **Launch is held, then released.** The player holds it to fill the
  meter, and lets go to fire. A mouse button, a key or a touch control
  can all work, as long as the meter works the same way.

## Turn and round information

- **The shot clock** shows how much of the turn's time has gone
  (chapter 03).
- **The next round's energy** shows, as a number from 0 to 35, the
  energy the player will get at the end of the round (chapter 03). It
  moves smoothly toward a new value rather than jumping.
- **The order of play** (chapter 03).
- **Whose turn it is**, and the end of each round (chapter 03).
- **Skip**, to pass. It's visibly unavailable when it can't be used
  (chapter 03).
- **Messages**, such as a refused launch or a player leaving, appear
  briefly.

## Other parts

- **The energy left** shows the energy the player has this round, up to
  35, as a number and a bar. It moves smoothly toward a new value.
- **Launcher selection** shows which kind of launcher is selected.
- **The wind indicator** shows the wind's direction and strength
  (chapter 01).

## The minimap

- **It shows the whole map**: the terrain, and every unit the player can
  see, in its owner's color.
  - Enemy units are hidden by the fog, like the units themselves.
- **It shows the main view's area.** Because the map wraps, the outline
  is repeated across the edges.
- **It shows the selected launcher.**
- **It shows hits.** When one of the player's own units loses or gains
  armor, the minimap flashes at that unit for a few seconds.
- **It shows shots in flight**, from any player, unless they're hidden
  in the fog. Each fragment and each of the three Proximity Charges
  shows on its own.
- **Clicking:**
  - near one of the player's own launchers selects it, and centers the
    view on it;
  - anywhere else glides the view there, even in hidden areas;
  - while a tracking camera is following a shot, a click only selects.
- **Dragging** on it moves the view toward the pointer.

## Damage bars and range circles

Two displays can be switched on and off with keys. The game remembers
them.
- **Damage bars:** a small bar on each of the player's side's units,
  showing its armor.
- **Range circles:** a circle around each of the side's Interceptors,
  showing their reach, and around each Proximity Charge, showing its
  reach.

## Keys

Every action below has a key. The default letters are up to the
implementation. Players can change every letter key in the options.

| Action |
|---|
| Damage bars on or off |
| Range circles on or off |
| Center the view on the selected launcher |
| Select the next launcher and center on it |
| Select the previous launcher and center on it |
| Select the Outpost closest to the center of the view, and center on it |
| Center the view on the player's unit that was attacked last |
| Start or send a chat line |
| Scroll (the arrow keys) |
| Open or close the game menu (Esc) |

- An implementation can add more keys, for example to pick items, turn
  the aim or launch. They must not change what a move can be. For
  example, keys still turn the aim in the same steps as the on-screen
  controls.

## Players who are out

- The screen shows each player who has been knocked out of the game, or
  has left it.

## Chat

- **Messages** appear in the sender's color, starting with the
  sender's name. How they're shown is up to the implementation.
  - A short sound plays when a message arrives, and when the player sends
    one.
- **Typing.** The chat key opens a line to type in.
  - The chat key or Enter sends the line. Esc drops it.
  - Lines have a length limit.
- **Who it goes to:**
  - **Everyone**, by default.
  - **The player's team**, or **one player**. The player picks them
    by starting the line with a short prefix, for example a word for
    the team, or the start of a player's name. The exact syntax is up
    to the implementation.
  - A prefix that matches nobody is just part of the message, and the
    line goes to everyone.
- **What each side sees:**
  - The sender sees who the message went to, the team or the player's
    name, before the message.
  - A player who gets a private message sees that it's just for them.
  - The wording of these tags is up to the implementation.
- Computer players don't receive messages.

## The game menu

- **Opening it:** the menu button, or Esc.
- **While it's open**, the rest of the screen is dimmed, and the game
  takes no clicks. In an online game the shot clock stays visible, so
  the player can keep an eye on it.
- **Pausing.** In a game where every other player is a computer, the
  game pauses while the menu is open: the shot clock stops, and nothing
  new starts. Shots already in the air carry on. An online game with
  other humans doesn't pause.
- **Volume:** four sliders, for sound effects, music, the aide's
  voice, and interface sounds. Dragging a slider changes the volume at
  once.
- **Help:** pages of game hints.
- **Done** closes the menu.
- **Quit** asks the player to confirm first. Quitting an online game
  leaves it. The other players see the player as disconnected (chapter
  03).
- **Keys** work in the menu too: Esc closes it.

## The end of the game

- **Victory or defeat.** Each player sees a victory screen if their
  side won, or a defeat screen otherwise (chapter 03).
- **The game summary** follows. For each player, it shows how they
  played, such as:
  - how many units they built;
  - how much energy they earned;
  - how many attacking shots they fired;
  - how many times they hit an opponent with a weapon. Drawing
    Interceptor fire doesn't count;
  - how many opponents' units they destroyed;
  - their accuracy: the share of shots that hit;
  - how many opponents they knocked out.
- From the summary, the player can save a replay of the game (chapter
  12).

## Hot seat

When several humans share one screen:
- **The screen shows the view of the human whose turn it is**: their
  fog, their selected launcher, and their camera.
- **During a computer's turn**, it keeps the view of the last human to
  play, so the computer's base isn't given away.
- When the turn passes from one human to another, the view jumps to
  where that player last had it.

## Options

Players can set, outside a game:
- their player name;
- the letter keys;
- the four camera preferences;
- the volumes, and Aide Chatter (chapter 11).

## Left to other chapters

- Aiming and the power meter: chapter 01.
- The shot clock, the order of play, and whose turn it is: chapter 03.
- What the fog hides: chapter 08.
- Sounds, music and the aide: chapter 11.
- The lobby, game setup, and replays: chapter 12.
