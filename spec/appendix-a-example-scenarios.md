# Appendix A — Example scenarios

These are short scenarios with the outcome the rules lead to, one
section per chapter. They help an implementation check that it has read
the chapters the way they were meant. They don't add rules of their
own: where a scenario and a chapter seem to disagree, the chapter is
what counts.

How to read them:
- **Distances and times are targets**, like everywhere else in this
  spec. An implementation's own values will differ a little.
- **Each scenario is set well clear of any rule's edge.** It's far
  enough inside or outside a limit that a small difference in an
  implementation's values can't change the outcome.
- **The outcomes are what matter:** who is hit, what is destroyed, who
  is out, what is visible, and roughly where things end up.
- Unless a scenario says otherwise, the map is flat Ground with no
  wind, and players launch from an Outpost.

What isn't checked here:
- **Whole games.** A game played from its list of moves magnifies tiny
  differences: a shot one pixel off can change everything that follows.
  So no implementation can be expected to reproduce another's game move
  for move.
- **What is required instead** is that each implementation agrees with
  itself: the same setup and moves always give the same game, on every
  machine. Chapter 12 describes those checks.

## 01 — Launching and flight

- **A full-power shot** lands about 500 px away, after about 2.5
  seconds. From a Battery, it lands about 900 px away.
- **The shortest shot,** fired by holding Launch while the meter goes
  all the way up and back down, lands about 100 px away. The quickest
  tap lands a little further than that.
- **Wind.** With a Strong wind, a full-power shot:
  - with the wind behind it, lands about 600 px away;
  - into the wind, lands about 350 px away;
  - with the wind across it, lands about 500 px along its heading and
    about 150 px to the side.
- **Two shots with the same displayed aim and meter** can land in
  slightly different places. The player can't see exactly which aim and
  power they fired.

## 02 — The map and terrain

- **High ground.** A full-power shot from ground about 75 px above the
  target lands about 540 px away.
- **Slopes.** A building whose landing point is on a slope fails. One
  whose landing point is on flat ground, with only its edge over the
  slope, lands.
- **Water.** A building that comes down on water sinks. A Pontoon that
  comes down on water moves to the center of its tile. A building then
  launched onto that tile lands.
- **Vents.** An Extractor whose footprint just overlaps a vent's edge
  earns 3 a round. One well clear of any vent earns 1.
- **A Pontoon destroyed under a conduit.** The conduit burns away in
  both directions from the water. The building at its far end is
  destroyed, with everything built from it. The launcher at the near end
  survives.

## 03 — Turns, rounds and energy

- **A first round, two players, clock at 60.** Both start with 11. P1
  goes first.
  1. P1 launches an Outpost: 11 − 7 = 4.
  2. P2 passes. P2's 11 is put aside, and shows as 0. P2 is out for the
     round.
  3. P1 launches a Shell: 4 − 1 = 3. P1 now has the round to
     themself.
  4. P1's next turn gets about three quarters of the last one's time.
     P1 lets the clock run out: 3 − 1 = 2. P1 is still in the round.
  5. P1 passes. The round ends.
  6. Income: P1 gets 2 + 7 = 9. P2 gets 11 + 7 = 18.
  7. Round 2 starts with P2.
- **The cap.** A player with 33 who passes gets 33 + 7 = 40, capped at
  35. The other 5 are lost.
- **A turn cycle.** In a four-player game, P2's Pulse disables P3's
  launcher during P2's turn.
  - On P3's next turn, the launcher is still disabled.
  - It works again once play has moved past P2's next turn.
  - If P4 is knocked out in between, it still comes back at the same
    point.

## 04 — Units

- **An Extractor's blast.** An enemy Extractor is destroyed while it's
  working. About 0.8 seconds later, it explodes:
  - an Outpost about 100 px away is destroyed (5 damage);
  - a Barrier about 100 px away is destroyed, whatever its armor;
  - another Extractor about 100 px away is destroyed, and explodes in
    turn;
  - an Outpost about 250 px away isn't touched.
- **A disabled Extractor** destroyed in the same way doesn't explode.
- **A Charge going off.** An enemy Shell flies about 50 px above an
  armed Charge. The Shell is destroyed with no effect. About 0.5 seconds
  later, the Charge explodes, and every unit within about 90 px takes
  3.
- **A new Barrier.** It shows no dome until the turn passes to the next
  player. From then on, the dome stops enemy shots.

## 05 — Buildings and conduits

- **Conduits from one Outpost.** An Outpost already has one conduit
  leaving it heading east.
  - A building launched about 45° from it lands, with no warning.
  - At about 25°, the warning marker shows, and Launch is refused. With
    the override held, it launches, and the new conduit stands.
  - At about 10°, with the override held, the new conduit breaks. It
    burns back from the break, and the building is destroyed. The
    Outpost isn't harmed.
- **A conduit across another.** A building's path crosses an enemy
  conduit. One of its nodes settles within about 12 px of a node of the
  other conduit. Its conduit breaks, and the building is destroyed.
- **A node on water.** A building lands beyond a lake. A node settles
  in the water, and the conduit breaks there.
- **The burn.** An Outpost has two buildings chained after it. When the
  Outpost is destroyed, the nearer building goes first, then the one
  further along.

## 06 — Weapons and tools

- **Shell zones.** A Shell lands on the ground beside an enemy
  Outpost:
  - with the Outpost's edge about 5 px away, it takes 3;
  - about 22 px away, it takes 1.5;
  - about 50 px away, nothing.
- **Height.** A Shell lands on a Mountain about 75 px high. A unit on
  the Ground just below isn't touched.
- **Barriers.** An enemy shot is stopped at the edge of a working
  Barrier's dome. A friendly shot passes through. A shot launched from
  under an enemy dome is stopped where it tries to leave.
- **One Interceptor.** An enemy Shell flies within about 100 px of it.
  - The missile catches the Shell in the air, and the Interceptor is
    disabled for a turn cycle.
  - A second Shell along the same path, on the attacker's next turn,
    isn't fired at.
- **A Scatter Shell against one Interceptor.** The Interceptor stands
  near where the fragments come down, well away from the Scatter
  Shell's path before it splits. One fragment is caught. The other two
  land.
- **A shielded path.** The attacker has a Barrier between the enemy
  Interceptor and the shot. The missile is stopped at the dome's edge,
  and the shot lands as if nothing had happened.
- **A Pulse.** It lands among enemy buildings, with no working enemy
  Interceptor in reach.
  - About 1.5 seconds later, every unit within about 200 px is
    disabled, the attacker's own included.
  - An enemy Extractor with 2 armor left, beside the landing point, is
    destroyed by the Pulse's small explosion. It doesn't blast, because
    it was already disabled.
- **A Surge.** It strikes an enemy unit whose conduit runs about 20
  nodes back to its launcher. The unit takes 3, and the launcher about
  1.8.
- **A Worm.** It infects an enemy network.
  - Each turn cycle, it spreads one conduit further.
  - Each enemy unit loses 1 armor when its infection wears off, but
    never drops below 0.1.
  - The attacker's own units in the network are disabled, but not
    damaged.
- **A Salvager.**
  - On the player's own Extractor: the Extractor is removed with no
    blast, and the player gets 5 at the end of the round.
  - On an enemy Battery: the Battery is destroyed with no blast, and
    the player gets 3 at the end of the round.
- **A Repair Pod** that lands next to a damaged unit restores 1 armor.

## 07 — Rovers

- **The drive.** A Rover launched east drives about 300 px east at the
  end of each round, until something stops it.
- **An enemy Outpost in its path.** It stops beside the Outpost, waits
  about a second, then explodes. The Outpost (5 armor) is left with 1.
  Every Barrier within about 180 px is destroyed.
- **An enemy conduit in its path.** It explodes where it reaches the
  conduit.
- **Its own conduit in its path.** It stops there, and stays stopped in
  later rounds.
- **An armed Charge near its path.** The Charge goes off. The Rover is
  destroyed, and explodes too.
- **A lake in its path.** It drives into the water, carries on along the
  bottom, and drives out the other side.
- **Credit.** At the end of a round, a Rover destroys an enemy Citadel.
  The Rover's owner gets the 7.

## 08 — Fog of war

- **How far things see.** With fog on, an Outpost on Ground reveals
  about 200 px around it. A Spire reveals about 500 px.
- **The fog comes back.** When the Spire is destroyed, the area only it
  revealed is hidden again.
- **Teams.** A teammate's Spire reveals the area for the whole team.
- **Conduits.** A long conduit reveals small patches along its length,
  about one node in five.
- **Shots.** A shot reveals the area around it as it flies. After a
  weapon lands, the area stays revealed for about a second.
- **Out of the game.** In a game without teams, when a player's Citadel
  is destroyed, the fog lifts on their screen for the rest of the game.
