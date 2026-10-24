# Navigation in Flock XR

## About navigation

The **move to object** block moves an object or character to another object at a set speed, using physics. Along the way it:

- turns to face where it is going
- follows the target if it moves
- slows down as it arrives
- walks round obstacles
- pushes objects that can move
- avoids walking off edges
- finds its way into open structures such as huts

You choose where to stop with the side option (to, near, left of, right of, in front of or behind) and the gap. Choose **wandering** instead of **straight** for a winding path. Choose **await** to wait until it arrives, or **start** to carry on straight away.

This page describes the techniques behind the block and how they have been adapted to Flock XR's movement and physics.

## Techniques

The block combines well-known techniques from game AI and robotics. Each one is described below by its usual name, so you can look it up.

### Steering behaviours

Steering behaviours were described by Craig Reynolds in *Steering Behaviors for Autonomous Characters* (1999). Each frame, a steering behaviour works out which way to go and how fast. Move to object uses these:

- **Seek** heads straight for the target's current position.
- **Pursuit** heads for where the target will be. Flock XR estimates the target's speed from how far it moves each frame, and smooths the estimate over a few frames. It then aims ahead by about the time it would take to get there. This lets a character head off something that is crossing in front of it, rather than trailing behind it. When the target is still, pursuit and seek are the same.
- **Arrival** slows down near the goal so the character comes to a gentle stop. If the target is moving away, it adds the target's speed so it can still catch up.
- **Wander** makes the path wind naturally. Flock XR uses smooth noise, made from two sine waves that never line up, to turn the direction of travel by up to 45°. Each move starts the waves at random points, so characters sent to the same place take different paths. The wandering fades in after setting off and fades out near the goal, so the character still starts and arrives cleanly.

### Turning

- **Turn-rate limiting** caps how fast a character can turn, at 360° a second. Large turns become a steady pivot instead of a sudden snap.
- **Turn then go** slows a character down while it is facing away from where it needs to go. If the target is behind, the character turns on the spot first, then sets off. It speeds up as it lines up, so it never walks backwards or sideways.
- **Finishing the turn** lets a character complete its turn after reaching a stationary target, so it ends facing the right way.

### Sensing the surroundings

- **Feelers**, also called whiskers, are probes sent out ahead to detect obstacles before touching them. In Flock XR a feeler is a capsule the size of the character's body, swept along the ground just above step height. Gaps the body cannot fit through, such as a window above a wall, are not mistaken for a way through.
- **Ground probes** are rays cast downwards ahead of the character to check the ground. They check whether each step ahead goes down by more than a safe drop, or up by more than a step. They allow for slopes, so a character can walk down any slope it could walk up.
- **Line of sight** checks whether the body could walk in a straight line to the goal: nothing in the way and no unsafe drops along the line.

### Getting round obstacles

- **Bug algorithms** come from robotics. Bug2 and Tangent Bug are described by Lumelsky and Stepanov. When something blocks the way, the character follows the obstacle's edge. It leaves the edge and heads for the goal when it is clearly closer than where it started following, or when the goal is in line of sight.
- **Wall following**, the "keep a hand on the wall" rule used for solving mazes, keeps the obstacle beside the character at a small, steady gap. When the wall on that side disappears, at a corner or a doorway, the character turns into the gap. This is how it finds the way into a hut: it follows the outside wall round, turns in at the doorway, sees the middle of the hut and walks to it.
- **Choosing a side.** When an obstacle is first met, the character follows it in the direction that leads more towards the goal. If the goal is lower down, it chooses the direction that leads downhill; if the goal is higher up, it chooses uphill.
- **Leaning away from edges.** When following a drop, the character steers slightly towards the safe side, so it never drifts over the edge.

### Choosing between directions

- **Potential-field bias.** Height counts as part of the distance to the goal. Walking down a ramp towards a target below therefore counts as getting closer. While following an edge, the character is also pulled downhill when the target is lower, and uphill when it is higher.
- **Hysteresis.** Small wobbles from frame to frame do not change the character's mind. For example, leaving an edge requires real progress, not millimetres of jitter.
- **Loop detection** counts how far the character has turned while going round obstacles, as robots do. If it turns a full circle without getting any closer, the goal cannot be reached, and the move ends. A detour allowance does the same job for long detours, and resets whenever the character makes real progress.

## How this fits Flock XR

### Physics movement, the same as the player

Move to object steers a physics body through the same grounded movement code as the keyboard and movement blocks. Climbing steps, walking on slopes, gravity, jumping off ledges and staying upright all work the same way. A character on a move to object path behaves physically like a player-controlled character.

The **glide** block is still the choice when you want exact, physics-free motion.

### Built live, with no baking

Many game engines plan routes using a navigation mesh, which has to be "baked" from the scene in advance. Flock XR scenes are built by code while the project runs, from shapes, models, maps and CSG. So move to object senses the scene live, using physics shape casts and raycasts. Objects that appear, move or are removed are noticed straight away.

### Stylised, forgiving rules

Flock XR's movement is forgiving, and navigation follows the same rules:

- **Steps:** a character can step up anything up to the same step height as player movement.
- **Drops:** a character will step down anything up to three times its step height. Larger drops are treated as edges to avoid.
- **Slopes:** anything up to 75° counts as walkable, both up and down.

### Pushing with physics

Objects with dynamic physics are pushed out of the way rather than walked around, so their mass decides what happens. A light crate is shoved along. Something too heavy to push stops the character, and the move ends.

### Understanding targets

"To" adapts to the kind of target:

- **Solid objects,** such as boxes, trees and buildings without a way in, are reached when the character touches them.
- **Open structures,** such as huts and tents, are detected by checking whether there is room for the character at their centre. Their walls are treated as obstacles, so the character follows them round to a doorway and walks inside.
- **Imported models** often have their physics on their individual parts rather than on the whole model. These parts are recognised as belonging to the target.

### Simple blocks, with markers for control

All of the techniques above happen automatically. Learners only choose the target, side, gap, speed, straight or wandering, and await or start. To make a character take a particular route, use **marker objects** as waypoints. For example, move to a marker in front of a hut's doorway, then move "to" the hut.

### Player controls stay responsive

The turning limits and turn-then-go behaviour only apply to move to object. Keyboard and movement blocks keep their quick, responsive turning, because players expect a character to go where they press straight away.

### Designed for modest devices

Probes are short, and most of them run only while a character is getting round something. The longer line-of-sight check runs only while following an edge.

## For contributors

The implementation is in [api/physics.js](../api/physics.js), and the shared grounded movement is in [api/movement.js](../api/movement.js). The settings for each technique are named constants grouped together, for example:

| Constant | Setting |
| --- | --- |
| `SAFE_DROP_STEPS` | the safe drop, as a number of steps |
| `MAX_WALKABLE_SLOPE` | the steepest walkable slope |
| `WANDER_MAX_ANGLE` | the largest wander turn |
| `MAX_TURN_RATE` | the fastest turn |
| `HUG_GAP` | the gap kept when following a wall |

The behaviour is covered by the move to object tests in [tests/physics.test.js](../tests/physics.test.js) and the navigation suite in [tests/navigation.test.js](../tests/navigation.test.js). Run the navigation suite with `npm run test:api navigation`.
