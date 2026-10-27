# Proposed spec changes

Wording the user may apply to `spec/`. One entry each: the spec
section, the problem, and the proposed text. Remove an entry once it's
applied.

## 10 — Chat, Typing (D42)
Replace "The chat key or Enter sends the line. Esc drops it." with:

> - The chat key opens a line to type in. Enter sends it; Esc drops it.
>   While a line is open, the chat key just types its letter.

## 05 — Conduits, So the game warns them; 10 — The conduit marker (D38)
The user moved the conduit marker off the conduit, onto the heading's
mark. In spec 05, replace "If so, a marker appears on that conduit."
with:

> If so, a marker appears on the aim.

In spec 10, replace "a marker shows on that conduit (chapter 05)." with:

> a marker shows on the aim (chapter 05).

## 04 — When a unit is destroyed (D53)
"Don't explode" was meant as "do no blast damage"; the units are still
seen to blow up. Replace "The other seven units don't explode. They're
destroyed with a debris effect." with:

> The other seven units don't explode: their destruction does no damage
> around them. They're still shown being destroyed, with an explosion
> and debris, like any other loss.

## 02 — Landforms: water the corners don't describe (D55)
Channels and ponds lie in tiles whose corners are all Ground, and three
points of land have the same corners as an outside corner. After
"A tile's shape follows from its four corners." add:

> Water also follows the edges: a map records which tile edges a
> channel crosses, at the edge's middle, and which tiles hold a pond.
> Where water crosses the edges between a tile's land corners, the land
> splits into separate points.

## 12 — The lobby: the same name twice (D56)
The spec doesn't say what happens when two players in one game choose
the same name. After "Players choose a name before they enter." add:

> Two players in one game never share a name: if someone joins with a
> name already there, it's shown with a number, as "Player 2", in that
> game.

## 09 — Threats: being under attack (D59)
The spec lists threats as enemy launchers in reach, but doesn't say
what being under attack is, or how a computer learns where an attack
in the fog came from. After the "Threats" list, add:

> - **Being under attack.** A building is under attack when an enemy
>   damages it, a shot comes down near it, its Interceptors catch a
>   shot meant for it, or an enemy Pulse, Worm, Surge or Rover reaches
>   it. Conduits burning don't count. It stays under attack for about
>   three turn cycles, since an attacker may wait for Interceptors to
>   reload.
> - **Attacks from the fog.** A computer watches every turn, not just
>   its own, and sees what a player would. An enemy shot it sees in
>   flight shows roughly where it came from. Explosions in the fog, and
>   the sign of damage on hidden units, show where something is.

In "Protecting the Citadel", after "Don't make it stand out." add:

> Once the Citadel is under attack, the enemy knows where it is, and
> this no longer holds back its defenses.
