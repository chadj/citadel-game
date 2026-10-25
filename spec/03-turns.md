# 03 — Turns, rounds and energy

This chapter covers how play moves from player to player: the order of
play, what a turn can be, the shot clock, the end of a round, income,
and how the game ends.

## The order of play

- At the start of a game, the players are put in a random order. That
  order sets who plays first in the first round.
- In a game of two teams of two, the order is arranged so that the teams
  alternate: a player from one team, then one from the other, and so on.
- Within a round, turns go around the players in that order. Players who
  are out of the round are skipped.
- **Between rounds, the order shifts by one.** The next round starts
  with the next player after the one who started this round. So whoever
  went first this round goes last in the next one, and the second player
  goes first.
  - Players who are out of the game are skipped when choosing who starts.
- **The order of play is shown on screen**: one marker
  per player, in their color, starting with the player who goes first
  this round.
  - When a round starts, the row visibly updates to show the new order.
  - Its look is up to the implementation.
- **Players who are out keep their place in the row**, with a mark:
  - one mark for a player knocked out of the game, shown the moment
    their Citadel is destroyed;
  - another for a player who disconnects.
  - The newest mark replaces the older one. So a knocked-out player who
    then leaves the game shows as disconnected.

## A turn

In a turn, a player does exactly one of these:
- **Launch** one item from one of their launchers. The item's level is
  charged to their energy: 1, 3 or 7. A player can only choose an item
  they can afford.
- **Pass**, with the Skip button. The player is then out for the rest of
  the round (see Passing, below).
- **Run out of time.** The turn is lost and costs 1 energy. This isn't a
  pass: the player stays in the round and gets their next turn as usual.

After the launch has played out, or straight after a pass or a timeout,
the turn moves to the next player.

## The shot clock

- The host sets the shot clock: off, 15, 30 or 60 seconds.
- **The limit.** A turn's time limit is chosen when the turn starts:
  - With the clock on, a turn gets a little more than the setting,
    about 10% more, as grace.
  - **Back-to-back turns shrink.** Once everyone else is out of the
    round, one player may take several turns in a row. Each of those
    turns gets about three quarters of the previous one's limit, down to
    a minimum of about 10 seconds. The limit goes back to normal when
    the turn moves to someone else, or the round ends.
  - With the clock off, there's no limit.
  - **No working launcher.** A player who has no Outpost or Battery
    able to launch always gets about 10 seconds, even with the clock
    off. All they can do is pass, so the game doesn't wait long.
- **When it starts.** The clock starts after a short pause, about 1.5
  seconds after the turn begins.
- **When it stops.** Pressing Launch stops the clock. The rest of the
  turn, while the shot flies and lands, isn't timed.
- **The display.** The on-screen clock shows how much of the time has
  gone. A warning sound plays once, when about three
  quarters of the time is gone. It doesn't play for a player with no
  working launcher.
- **Time up.** A buzzer sounds when the time runs out.
- **With the clock off**, a reminder sound plays about every 30 seconds
  while a player takes their turn.
- Computer players aren't timed by the clock. They have their own limit
  on how long they think (chapter 09).

## Passing

- Passing takes the player out of the rest of the round. They take no
  more turns until the next round starts.
- **Their energy carries over.** The energy they have left is put aside
  and added back at the end of the round, along with their income.
  - While it's put aside, their energy shows as 0.
  - The 35 cap still applies when it's added back. So passing never
    lets a player store more than 35.
- Why pass? A player who doesn't pass has to keep taking turns until
  they run out of energy or the round ends. Passing lets them save
  energy for a bigger launch next round, such as a level 7 item.

## Out for the round

At every change of turn, a player is put out for the rest of the round
if any of these are true:
- they have passed;
- they have less than 1 energy, so they can't afford anything;
- they have no Citadel;
- they have disconnected.

## The end of a round

The round ends when every player is out for the round. Then, in this
order:
1. The game announces that the round is over.
2. **Rovers move**, one at a time, in the order they landed
   (chapter 07). This takes a moment to watch, because each Rover
   drives step by step.
3. **Income is paid** to every player who still has a Citadel and is
   still connected:
   - 3 for each working Extractor on an Energy Vent, and 1 for
     each one off a vent. An Extractor that is disabled at this moment
     earns nothing.
   - 7 from the Citadel.
   - Energy put aside by passing, and energy recovered by Salvagers
     during the round.
4. A short pause, about a second, while the aide speaks.
5. The next round starts with the next player in the shifted order.

Effects that wear off (see Turn cycles, below) and the check for the end
of the game are settled before the next round starts.

### Energy

- Energy can have fractions, to one decimal place.
- A player can hold at most **35**. Any energy that would take them above
  35 is lost.
- Every player starts the game with 11 (chapter 02).
- The screen shows how much energy the player will
  get at the end of the round: Extractors, the Citadel, and energy put
  aside. It doesn't count the energy they have now.
- Destroying an enemy's Citadel pays 7 straight away. It goes to the
  player's current energy, not to energy put aside, and the cap of 35
  applies.
- A player with no Citadel gets no income. Neither does one who has
  disconnected.

## Turn cycles

Several effects last for one **turn cycle**: a disabled unit, an
Interceptor reloading, a Worm moving on.

- **One turn cycle lasts until play has gone all the way around the
  table**, and has moved past the seat of the player whose turn it
  started in.
  - For example, in a 4-player game, an enemy's Pulse disables your
    launcher during their turn. Your launcher stays disabled through
    your own next turn. It works again once play has moved on from that
    enemy's next turn.
- **Empty seats still count.** Seats of players who are out of the
  round or the game are part of the way around, even though play skips
  straight past them.
  - So knocked-out players don't shorten an effect. Suppose a third
    player is knocked out after the Pulse lands. Your launcher still
    comes back at the same point in the order as before.
  - If the enemy who fired the Pulse is knocked out, the effect still
    ends as play passes their empty seat.
- **Back-to-back turns wear effects off quickly.** Once everyone else
  has passed, one player may take several turns in a row. Between those
  turns, play still goes all the way around the table. So an effect that
  starts during one of those turns lasts through the player's next turn,
  and is gone by the turn after that.
- Which effects use turn cycles, and how many: chapter 06.

## The end of the game

The game checks whether it's over at every change of turn, and again at
the end of each round.

- **A player is out of the game** when their Citadel is destroyed. Their
  whole network burns away after it (chapter 05).
  - **Their free-standing units stay.** Rovers, Proximity Charges, Sky
    Probes and Pontoons have no conduit, so they don't burn. They stay
    on the map and keep working: Rovers still drive and explode, Charges
    stay armed, Pontoons still hold up what's on them, and Sky Probes
    still reveal for the player's team.
- **A team is still in the game** while any of its members still has a
  Citadel. Without teams, every player is a team of one.
- **The game ends when fewer than two teams are left.** The team that's
  left wins, even if only computers are left in it.
- **Otherwise, the game also ends if no human is left.** If none of
  the players still in the game is a connected human, it ends with no
  winner.
  - Every human then sees the defeat screen.
- When the game ends, each player sees a victory screen if their team
  won, and a defeat screen otherwise. A game summary follows (chapter
  10).

## Players who disconnect

While a player is disconnected:
- **Their turns are skipped.** If it was their turn when they left, they
  pass.
- **Their Citadel stays on the map**, and it still counts. Their team
  stays in the game until someone destroys it.
- They get no income.

Letting a disconnected player rejoin and take back their seat is a
welcome feature, but not required (chapter 12).
- How a disconnect is detected, and the warnings players see: chapter
  12.

## What players see

- **Whose turn it is.** At the start of every turn, the screen shows
  clearly who is playing:
  - on their own turn, that it's their turn;
  - on anyone else's, that they're waiting for that player, by name.
  - The wording and look are up to the implementation.
  - A sound plays with the waiting message. On the player's own turn,
    the aide says it's their turn.
  - This is the main sign that the turn has changed hands.
- **Skip is visibly unavailable** when it can't be used: when it isn't
  the player's turn, once they've launched, or when their time has run
  out. So players can tell at a glance whether they can still act.
- **The end of the round** is announced on screen. Rovers only start
  moving once the announcement is showing.
- **Timing out.** A buzzer sounds when the shot clock runs out and the
  turn is lost.
- **No working launcher.** When a player's turn starts and they have no
  Outpost or Battery able to launch, the aide tells them. That
  explains why their turn is so short.
- **A new turn doesn't move the camera**, or change the selected
  launcher. Players can turn on preferences that move the camera for
  them (chapter 10).

## Left to other chapters

- Example scenarios for this chapter: Appendix A.
- Start positions and starting energy: chapter 02.
- What each item costs: chapter 04.
- What each launch does: chapters 05 and 06.
- How Rovers move at the end of a round: chapter 07.
- How computer players take their turn: chapter 09.
- What the screen shows, the summary screen and the aide: chapters 10
  and 11.
- Disconnects and the online lobby: chapter 12.
- The camera and its preferences: chapter 10.
- Sounds: chapter 11.
