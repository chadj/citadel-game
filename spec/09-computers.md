# 09 — Computer players

Any seat can be played by the computer. This chapter is a playbook for
computer opponents. It says what they must and mustn't do, how they
should weigh their goals, and the tactics they should know.

It doesn't prescribe a method. The implementation designs its own
computer players. Everything here follows from the rules in chapters 01
to 08, and the tactics are the same ones a good human player uses.

## Taking part

- **Up to three computers** can join a game, with at least one human.
  The host chooses which seats are computers when setting up.
- **A computer's move is an ordinary move.** It launches or passes like
  a human. The same rules, costs and limits apply.
- **Only one machine thinks for each computer.** Its move is then sent
  to everyone else like any other player's move (chapter 12). So the
  computers' thinking doesn't need to give the same result on every
  machine.
- **Its faction and color** are picked at random when it's added, from
  those no other player has yet.

## Playing fair

A computer opponent should be beatable by skill, and never win by
cheating.
- **It sees only what its side can see.** With fog of war on, it knows
  nothing about enemy units hidden in the fog. It may remember what it
  saw before the fog came back, as a human would.
- **It obeys the power ranges** (chapter 01), and pays for everything
  it launches.
- **It passes rather than waste a turn.** It never lets the time run out
  on purpose, since that costs energy for nothing.
- **It takes a moment.** When its turn starts, it waits about 1.5
  seconds, so players can see whose turn it is.
- **It thinks within a limit.** The shot clock doesn't apply to it
  (chapter 03), but it has its own limit, about 20 to 30 seconds. Most
  moves should take much less. If it reaches the limit, it makes the
  best move it has found so far, or passes.
- **Which Outpost is a Citadel.** A human can't tell a Citadel from an
  Outpost by looking (chapter 00).
  - **Choice:** a computer may know which visible enemy Outpost is the
    Citadel. Or it may have to work it out, as a human does (see
    Finding the enemy's Citadel, below). Working it out is fairer.

## Personalities

The host picks a personality for each computer, or leaves it to chance.
A personality combines two things.

- **Skill:** how well it plays.
  - **Aim:** how far its heading and power stray from what it intended.
    Give the power error as a share of the launcher's range.
  - **Judgment:** how well it reads the game and plans ahead.
  - **Whims:** how often it ignores its best plan and does something
    else instead.
- **Style:** what it leans toward when choices are close.
  - **Builder:** economy and expansion first.
  - **Aggressor:** attacks early and often.
  - **Defender:** protects its network before it reaches out.

The game offers a set of personalities, listed from hardest to easiest,
plus a random choice.
- **The hardest** never strays, judges well, and rarely acts on a whim.
- **The easiest** strays by up to about 35° and about a quarter of its
  range, judges poorly, and acts on a whim about half the time.
- The rest sit in between, with a mix of styles.
- How many there are is up to the implementation. Five to ten gives a
  good spread. Each gets its own name.

**Getting its eye in.** If a computer is about to make exactly the same
shot as its last one, from the same launcher, its error shrinks. Each
repeat shrinks it further, down to none. So a computer that keeps
missing the same target slowly zeroes in, the way a human corrects
their aim.

## Reading the game

Each turn, a computer should know where it stands.

### Its own position

- **Energy:** what it has, what it can afford now, and what it will
  have next round.
- **Income:** 7 from the Citadel, plus its Extractors: 3 each on a vent,
  1 each off one.
- **The cap.** Energy above 35 is lost. A computer near the cap should
  spend, not save.
- **Its network.** For each building, how much is built from it: what
  would burn if it were destroyed. An Outpost near the root of a large
  tree is precious.
- **Cover.** Which of its buildings sit under a working Barrier, and
  which are within reach of a working Interceptor.
- **Reach.** What each launcher can hit: about 500 px from an Outpost,
  about 900 px from a Battery, more from high ground.
- **Disabled units.** What is disabled, and for how long.

### Threats

- **Enemy launchers in reach** of its buildings, especially its Citadel
  and its most precious Outposts.
- **Enemy Rovers**, and the line each one will drive along at the end of
  the round. A Rover drives about 300 px a round, in a straight line.
- **Enemy Interceptors near its launchers.** They catch its shots early.
- **Enemy Barriers over its launchers.** Shots from under an enemy dome
  can't leave it.
- **Worms** spreading through its network.
- **Leftovers of knocked-out players.** Their Rovers keep driving and
  their Charges stay armed (chapter 03). They're still a danger.
- **Its own Extractors** near its precious buildings. An Extractor's
  blast reaches about 150 px and does 5 damage, which destroys any unit.

### Opportunities

- **Enemy units in reach** that no working Barrier or Interceptor
  protects.
- **Defenses that are down.** An enemy Interceptor that has just fired
  is disabled for a turn cycle. A Barrier hit by a Pulse or a Worm is
  down for a while. These windows are the best time to attack.
- **Badly damaged enemy units** that a cheap weapon can finish.
- **Free Energy Vents** within reach.
- **Enemy units on or connecting over Pontoons.** Destroy the Pontoon,
  and everything standing on it sinks. Every conduit crossing it falls
  into the water and burns, so the building at its far end is destroyed
  too, along with everything built from it (chapter 05).

### Finding the enemy's Citadel

Unless it's allowed to know (see Playing fair), a computer works out the
Citadel the way a human does:
- **Follow the conduits.** Lights flow along every conduit toward the
  Citadel (chapter 05). The root of an enemy's tree is the Citadel.
- **The oldest building.** The Citadel was there from the start. An
  Outpost seen early, before the enemy had time to expand, is likely it.
- **Start positions.** The Citadel stands on one of the map's start
  positions (chapter 02).
- **Hits.** Destroying an Outpost that turns out to be the Citadel ends
  that player's game. Destroying one that isn't tells it where the
  Citadel isn't.

## Choosing what to do

A computer weighs these goals each turn:
- **Expand:** get Outposts toward vents, high ground and the enemy.
- **Economy:** build Extractors, on vents where it can.
- **Scout:** find the enemy, with fog of war on.
- **Defend:** protect what's threatened.
- **Attack:** destroy what's valuable and exposed.
- **Save:** pass, to carry energy into the next round for a level 7
  launch.

Its style tips close choices. Its judgment decides how well it weighs
them.

### How the priorities shift

- **The opening.** Nobody is in reach yet.
  - Expand toward vents and the enemy, and build Extractors on vents.
  - Don't spend on defenses that nothing threatens yet.
  - With fog on, start scouting as the networks near each other.
- **Contact.** Enemy launchers can reach its units, or its launchers can
  reach theirs.
  - Defend the precious buildings before they're hit, not after.
  - Trade well: spend energy where it costs the enemy more.
- **Emergencies come first.** Whatever the plan, these jump the queue:
  - an enemy Rover whose line runs into its Citadel or a precious
    Outpost;
  - its Citadel in enemy reach with no defense;
  - an enemy Barrier over one of its key launchers;
  - a Worm spreading through its network.
- **The kill.** An enemy Citadel in reach and exposed is worth almost
  any risk. It ends that player's game, and pays 7 energy at once.

### What things are worth

- **An Extractor** costs 7. On a vent it earns 3 a round, so it pays for
  itself in about three rounds. Off a vent it earns 1, so it takes seven.
  Off-vent Extractors are only worth it early, or in a long game.
- **An Outpost** is worth what it opens up: vents, high ground, and
  reach toward the enemy.
- **A defense** is worth the value of what it protects, and the threat
  against it.
- **An attack** is worth what it destroys, including everything that
  burns after it. A precious Outpost is worth far more than its own 5
  armor suggests.

### Not getting stuck

- If a plan keeps failing, such as shots that keep being stopped by the
  same defense, change approach.
- Don't make the same move over and over. A computer should notice when
  it's repeating itself, and try something else.

## Planning ahead

- **Expansion routes.** Plan a chain of Outposts toward a goal, each one
  landing on flat ground, with room around it for its own conduits.
  - Prefer high ground. Shots from it carry further (chapter 01), and
    units on it see further (chapter 08).
  - Water needs a Pontoon first, where the conduit will cross.
- **Keep room for conduits.** Conduits from the same Outpost need about
  20° between them (chapter 05). Don't fill the headings toward the
  frontier with short-lived buildings.
- **Don't fence in its own Rovers.** Its own units and conduits stop
  its own Rovers (chapter 07). Keep a lane open toward the enemy.
- **Spread out.** Don't put precious buildings within about 150 px of
  its own Extractors. One Extractor's blast can destroy them all, and
  set off the rest.
- **Save for big moves.** Rovers, Worms, Barriers, Batteries, Outposts
  and Extractors all cost 7. Passing early carries energy over. Plan a
  round ahead for these.
- **Use the windows.** An effect lasts until play has gone around and
  passed the seat where it started (chapter 03). So:
  - a Pulse fired on its own turn keeps the enemy's units disabled
    through its next turn too. Follow a Pulse with an attack;
  - an enemy Interceptor that fires at one of its shots is still
    reloading on its next turn. A cheap shot that draws its fire opens
    the way.

## Defense playbook

### Against shots

- **Interceptors** are cheap (1) and catch most shots that come within
  about 180 px.
  - **They fire once, then reload for a turn cycle.** One Interceptor
    stops one shot. Put two or more near anything precious.
  - **A Scatter Shell beats a single Interceptor.** It splits into
    three, and one missile can catch only one.
  - **Enemy Barriers spoil them.** An enemy dome near an Interceptor
    shields shots flying through it. An enemy dome over an Interceptor
    traps its missiles. Place Interceptors where enemy domes can't
    easily reach them.
- **Barriers** cost 7. Their dome stops every enemy shot from entering,
  and every enemy building from landing inside.
  - They don't stop Rovers, and blasts destroy them outright.
  - A Pulse or a Worm takes them down for a while.
  - A new Barrier only works once the turn has passed on (chapter 04).
    Raise it before the threat arrives.
- **Proximity Charges** set off any shot that flies within about 90 px,
  and the shot is destroyed. A few Charges around a precious building
  absorb incoming shots, one each. Keep them about 90 px clear of its
  own buildings, since their blast hurts everyone.
- **Repair.** A damaged building that's defended can be patched with a
  Repair Pod, 1 armor for 1 energy.

### Against Rovers

A Rover drives about 300 px a round, in a straight line, at the end of
the round. Its blast reaches about 180 px and destroys any Barrier.
- **Read its line.** Project its heading forward. Act only if the line
  runs into something precious within the next round or two.
  - Its facing shows its heading only roughly, to within about 20°.
    Allow that much either way before deciding what it threatens.
- **Fence it.** A Rover explodes when it reaches an enemy conduit. One
  of its own conduits across the Rover's line makes it explode there.
  A Spire is the cheapest way to lay one, at 1 energy. Lay the fence
  far enough out that the blast, about 180 px, misses its buildings.
- **Disable it.** A Pulse stops it driving for a turn cycle. A disabled
  Rover can then be destroyed without exploding.
- **Salvage it.** A Salvager takes 3 armor from an enemy unit. A Rover
  has 3, so a Salvager destroys it on land without an explosion, and
  pays the energy back.
- **Shoot it.** A Shell in the full-damage zone destroys it. But a
  working Rover explodes when destroyed. Only shoot it where its blast
  won't hurt its own side.
- **Don't leave its own Rovers parked.** A Rover that stopped against
  its own side's buildings stays there. If an enemy destroys it while
  it's working, its blast, damage 4 over about 180 px, hits those
  buildings.
  - The other way round, an enemy Rover stopped beside the enemy's own
    buildings is a free blast. Shoot it.
- **Charge its path.** An armed Charge within about 90 px of its line
  goes off as it passes and destroys it. Its own blast follows.
- **A Rover underwater** can't be shot: shots that land on water
  splash. Charges and blasts still reach it.

### Against Pulses and Worms

- **Spread defenses out.** A Pulse disables everything within about
  200 px. Don't let one Pulse take down all the defenses around a
  precious building.
- **Intercept them.** Both are shots, and a working Interceptor catches
  them.
- **After a hit, expect an attack.** The enemy will try to use the
  window. Shore up what else can still defend.
- **Worms damage as they go.** Each infected enemy unit loses 1 armor
  when its infection wears off. Repair the precious ones as the Worm
  passes.
- **Buy time with a Pulse.** A Pulse on the infected units holds the
  Worm back about a turn cycle (chapter 06). It also disables
  everything else of yours nearby, so use it when the delay protects
  something that matters, such as an attack about to be launched.
- **Cut it off, if it's worth it.** A Worm only spreads along
  conduits. Destroying an infected unit before its infection wears off
  stops the Worm there. But it also destroys everything built from that
  unit (chapter 05). A Salvager does it to a unit with 3 armor or
  less, and pays back the armor as energy. Only worth it to save
  something more valuable further along.

### Against Surges

- A Surge's damage runs back along the conduit to the launcher, and
  fades over about 50 nodes. Long conduits protect the launchers behind
  them.
- Repair a launcher that a Surge has weakened.

### Protecting the Citadel

- Defend it once enemies come in reach, before it's hit.
- Don't make it stand out. A Citadel ringed with far more defenses than
  any other Outpost tells the enemy where it is.

## Attack playbook

### Choosing a target

- **The most valuable**, where value counts everything that would burn
  after it. A precious Outpost near the root of a big tree beats an
  isolated Extractor.
- **The least defended** among targets of similar value.
- **Defenses in the way.** Sometimes the Interceptor or Barrier must go
  first.
- **Finish what's damaged.** A unit with little armor left is cheap to
  destroy.
- **Sky Probes** are only worth shooting when they're giving the enemy
  sight it needs. They have 1 armor, so any enemy shot that touches one
  destroys it.

### Getting past Interceptors

- **Scatter Shells.** Three shots, and one Interceptor catches one.
- **Bait.** Fire something cheap to draw the Interceptor's missile. It
  reloads for a turn cycle. Send the real attack next turn.
- **Overload.** Two Interceptors each catch one shot a turn cycle. Keep
  up more shots than they can catch.
- **Shield the path.** Its own Barrier near the enemy's Interceptor
  stops the missiles at the dome's edge, and its shots fly past
  untouched.
- **Fly around them.** Interceptors only fire at shots that come within
  about 180 px across the ground. A different launcher may give a path
  that stays out of range.

### Getting past Barriers

Shots can't enter an enemy dome. Ways in:
- **A Rover.** It drives under the dome. Its blast destroys every
  Barrier within about 180 px, and damages everything else in range.
- **A Pulse just outside.** A Pulse that lands outside the dome, within
  about 200 px of the Barrier, disables it. The dome is down until the
  Barrier recovers. Attack before it does.
- **A Surge on the conduits.** Hit a conduit node outside the dome. The
  damage runs along the conduit, both ways, to the units at each end,
  even inside the dome.
- **A Worm on the network.** Infect an exposed unit of the same network.
  The Worm spreads along the conduits into the dome, and disables the
  Barrier when it gets there.
- **Blasts from inside.** Anything that explodes within reach of the
  Barrier destroys it. For example, an enemy Extractor under the dome,
  destroyed by Surge damage running along its conduit, takes the
  Barrier with it.

### Using Rovers

- **Throw it close.** A Rover that lands close to an enemy unit
  explodes at once. Thrown right beside a target, it's a heavy shell.
  It can't be thrown into an enemy dome, though: the dome destroys it
  without an explosion. Drive it in instead.
- **Drive it in.** Otherwise, aim along a line through the target. The
  heading matters more than the power. Avoid lines that cross enemy
  conduits, or it explodes there.
- **Mind its landing.** A Rover that lands within about 12 px of any
  conduit explodes on the spot, even its own side's.
- **Water is cover.** A Rover that lands in water drives underwater,
  where shots can't reach it.
- **Turn an Interceptor against itself.** Throw the Rover low and
  short, so it lands near the Interceptor before the missile can
  catch it. The missile still reaches it on the ground, and the Rover
  explodes there with its full blast, about 180 px. That can destroy
  the Interceptor and everything around it. Caught in the air, the
  Rover would have just vanished.
- **Rovers outlast their owner.** A Rover, or a field of Charges, keeps
  working after its owner is knocked out. In a team game, ones laid
  near the enemy keep helping the team.

### Hitting the network

- **The burn does the work.** Destroying an Outpost destroys everything
  built from it. Aim at the root of a branch, not its leaves.
- **Surges** damage the unit they hit and the launcher behind it. On a
  bare conduit, they damage both ends.
- **Worms** disable a whole network a conduit at a time, and show the
  attacker the network as it spreads (chapter 08).
- **Pontoons.** Destroying a Pontoon sinks everything on it, and burns
  every conduit across it.
- **Extractors.** An enemy Extractor among enemy buildings is a bomb. Its
  blast destroys everything within about 150 px.

### Using the terrain

- **High ground** gives longer reach.
- **Height protects.** An explosion well above or below a unit doesn't
  touch it (chapter 06). A target on a high Mountain can be hard to
  hit from below, and a direct hit may be the only way.

### Finishing blows

- **A Salvager** takes up to 3 armor from an enemy unit, and turns it
  into energy. It destroys any enemy unit with 3 armor or less, such
  as a Battery, Barrier, Interceptor, Spire or Rover, without an
  explosion.
- **A Scatter Shell** spreads 1.5 damage over three spots. It's cheap
  for finishing several damaged units, or one badly damaged one.
- **A Seeker** homes in on the nearest enemy ahead of it after the top
  of its arc. It's useful against small or hard-to-hit targets, as long
  as the target is the nearest enemy in its path.
  - **It reaches further than a plain shot.** It keeps looking for a
    target all the way down. Once locked on, it skims along the ground
    instead of landing. So it can hit a target up to about 240 px
    beyond where a plain shot would come down. Aim it to fall short of
    the target, in line with it.
  - It's wasted on an underwater Rover, and unreliable against a target
    at the water's edge: it splashes if its final dive comes down on
    water (chapter 06).

## Scouting

With fog of war on, a computer can't attack what it hasn't found.
- **Spires** are cheap (1) and see about 500 px, wherever they stand.
  But they need a conduit, and the conduit has to land safely.
- **Sky Probes** cost 3, need no conduit, and see about as far as a
  Spire at full power. Any enemy shot that touches one destroys it.
- **Shots scout too.** A shot reveals the area around it as it flies
  (chapter 08). An attack on a likely spot shows what's there.
  - **A Scatter Shell sees the most.** Its three fragments each reveal
    on their own as they spread apart, so one shot sweeps three paths,
    for 1 energy.
  - Proximity Charges spread wider still, for 3 energy. They also keep
    watching where they land, because each Charge is a unit.
- **Worms scout** an enemy network as they spread.
- **Remember.** What it saw stays useful after the fog closes again.

## Making a shot

- **Predict the flight** with the game's own flight rules (chapter 01),
  including the wind and the launcher's height. Try candidate headings
  and powers, and keep the best.
- **Allow for its own error.** A shot that only works when perfect will
  often fail.
  - For a building, choose a spot with plenty of flat ground around it,
    well clear of slopes, water, other units and conduits.
  - For a weapon, aim for the middle of the full-damage zone.
- **Check the conduit too.** Every node must settle on dry ground, clear
  of other conduits, and not along one of the launcher's own conduits
  (chapter 05).
- **Watch for enemy Interceptors** near the launcher. They'll catch the
  shot early. Use another launcher, or a Scatter Shell.
- **A Battery launches only weapons** (chapter 04). Plan buildings from
  Outposts.
- **If there's no good shot, pass.** Passing saves the energy for the
  next round.

## Left to other chapters

- Setting up seats and choosing personalities: chapter 12.
- The flight model computers use to aim: chapter 01.
- The rules every tactic here relies on: chapters 03 to 08.
- How the fog of war works: chapter 08.
- Which machine runs the computers in an online game: chapter 12.
