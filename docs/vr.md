# VR in Flock XR

You can view a Flock XR project in a virtual reality headset and stand inside the world you
built. This page explains how to get a project into VR, and what each of the VR blocks does.

> This page is about **VR headsets**. Viewing a project in augmented reality, or looking
> around it by tilting a phone, is covered in
> [AR and phone viewing in Flock XR](ar.md).
>
> It describes the development version of Flock XR. The
> [Flock XR Hub](https://hub.flockxr.com) covers the released version.

## Safety

Headset manufacturers publish their own age limits and safety guidance — a minimum age for
wearing the headset, advice on how long to spend in one, and how much clear space you need
around you. Follow the guidance for whichever headset you are using. It applies to Flock XR
projects exactly as it does to anything else you view in a headset.

Most headsets draw a boundary around your play space and warn you as you approach it. Leave
that switched on.

## Using Flock XR with a VR headset

Open your project in the headset's own browser. Meta Quest, Pico, Wolvic, Vision Pro and
similar headsets should all work. Testing has been carried out on Meta Quest 1, 2 and 3.

**Your project needs a `set XR mode to VR headset` block.** With one, an **enter VR** button
appears in the corner of the scene once the project starts running; without one there is no
button, and the project runs on the headset's screen like any other web page. Every bundled
example bar the AR one has the block, so they all work in a headset.

The block is a promise that someone thought about VR here. Being inside a scene asks more of
it than looking at one on a monitor — how you move through it, where the controls sit, what is
within reach — so a project says when it is ready for that, rather than every project on the
web being offered as VR whether or not it was built for one.

It costs a project that also runs on a screen nothing, because on a desktop or a phone the
block does nothing at all: no button appears and everything behaves exactly as it did. So one
project can be a VR project and a screen project at once, which is what the examples are.

You can also put an Android phone into a VR headset holder. That needs the other value —
`set XR mode to VR headset or phone` — because a plain **VR headset** project leaves a phone
alone. It relies on the phone's gyroscope to follow your head, so it works on phones but not
on every tablet — cheaper tablets often leave that sensor out.

> Some headsets cannot be told apart from a phone: Chrome reports every Android device as the
> same anonymous model, so a headset running plain Chrome rather than its own browser is read
> as a phone and a **VR headset** project will not offer it the button. Choose **VR headset or
> phone** on those.

Click the button and you are inside your world: look around by turning your head, interact
with objects and, depending on the project, move around.

To come back out, press the **Meta button** — the oval one on the right controller — and you
are returned to the headset's own menu. Other headsets have their own system button that does
the same thing. Your project carries on running on the screen behind, so you can click **enter
VR** again to go back in.

## The VR blocks

### `set XR mode to [VR headset]`

Sets up VR and shows the enter button. Run it once.

**Without this block there is no VR.** It is what turns the enter button on, and what says the
project was designed for a headset rather than merely surviving one. Every bundled example bar
the AR one has one, tucked inside a collapsed `start` block at the bottom of the workspace.

- **VR headset** — your scene replaces everything you can see. It starts only where there is
  a headset to start it on. On a desktop or a phone the block does nothing at all and your
  project runs on the screen exactly as before, so one project can be a VR project and a
  screen project at the same time. This is the one to use.
- **VR headset or phone** — the same, and it additionally offers the enter button on an
  Android phone, for a phone slotted into a cardboard-style holder. Try the project that way
  yourself before choosing it: a holder gives you no controllers and less tracking than a
  headset, so a project that reads well in one may not in the other.

**AR (Augmented Reality)** is just as much a headset mode. If your headset can show you the
room through its cameras, AR draws your scene over your real room instead of replacing it,
at life size, and you walk around it for real. Your controllers still work the same way, so
buttons and thumbsticks reach your blocks as they do in VR. What does not apply is anything
that moves you artificially: `set VR view` and the teleport blocks are for VR only, because in
AR you move by moving.

**Magic Window** is the one option meant for phones and tablets. On a headset it simply turns
into VR, since a headset already tracks your head.

Both are covered, along with using a project on a phone, in
[AR and phone viewing in Flock XR](ar.md).

### `set VR view to [watch / embody] with camera motion [...]`

This block decides **where you stand** in your world and **how you move**.

**Watch** keeps you outside the action, standing back and watching your character much as you
would on screen. **Embody** puts you inside the character: you look through its eyes, and its
body — along with anything it is carrying — is hidden, so your own character does not block
your view. It all comes back when you leave VR. If your character says something, the text
drops to just below your eyeline, since text above your own head would be out of sight.

The camera motion menu changes depending on which view you pick:

| View | Camera motion | What happens |
| --- | --- | --- |
| watch | none | You stay where you are. Your character can walk away and out of sight. |
| watch | comfort | You stay still while your character moves, then catch up about a quarter of a second after it stops. Your view holds still for most of the time you are watching, rather than being carried along with it. |
| watch | smooth | You travel with your character, always seeing it from the same angle. |
| embody | none | You stay put. Only your own head movement changes the view. |
| embody | teleport | Point at the floor with a controller, and a circle shows where you would land. Let go to jump there. Your character comes with you, so it still bumps into things. |
| embody | smooth | Your own movement blocks move the character, and you go with it, including up steps and slopes. Small changes in height are ignored until they add up, so a bumpy floor does not shake the view. |

**Defaults.** If you never use this block, Flock chooses for you when VR starts:

- If a camera is following an object (a `camera follow` block), you get **watch** with
  **comfort**.
- If nothing is being followed, you get **embody** with **teleport**.

Some pairings do not exist, so changing the view can change the motion with it: `watch` +
`teleport` becomes `comfort`, and `embody` + `comfort` becomes `teleport`.

### `add teleport target [...]` / `remove teleport target [...]`

When you can teleport, pointing a controller at the floor draws a circle where you would land,
with an arrow showing which way you would face. These blocks decide what you are allowed to
land on:

- **all** — every object in the scene.
- **ground** — the ground or terrain. **On to start with**, so teleporting works straight
  away.
- **an object name** — the objects in your project are listed by name, so you can allow one
  particular platform.

Objects with physics that you cannot land on get in the way instead, so you cannot teleport
inside a wall — the circle will not appear on them. Your own character, and anything it is
carrying, is ignored either way.

You only get the circle in **embody** view with **teleport** motion.

### `set VR comfort tunnel vision [...] strength [...] colour [...] alpha [...]` / `overlay [...] shown [...]`

When a scene carries you along while your body stays still, your eyes report motion and your
inner ear reports none. This block settles that disagreement: it narrows what you can see at
the edges while the scene is moving under you, and opens it back up once you stop. The corners
of your eye are where motion registers most strongly, so quietening them is what does the
work.

It measures how fast the view is moving and turning, subtracts your own head movement, and
closes the edges in proportion to whatever is left over. Walking around your room, or turning
to look at something, closes nothing — only motion your body did not make counts. Nor does it
matter what caused that motion: the joystick, gravity, an animation or a moving camera all
count the same.

- **auto** — let the device decide. In a VR headset you get tunnel vision; on a flat screen or
  in AR you get nothing, so the same project works everywhere without changing the block.
- **off** — never, on any device.

**You only get this if you add the block.** A project with no `set VR comfort` block has
tunnel vision switched off, including in a headset.

The other three settings decide what the edges look like:

- **strength** — how far in they close when you are moving quickly. **low** leaves most of
  your view, **high** leaves a narrow tunnel. **medium** to start with.
- **colour** — what the edges are filled with. Black to start with, which is what most VR
  apps use; a colour close to your sky is less noticeable.
- **alpha** — how solid the edges are, from 0 to 1, the same as alpha anywhere else in Flock.
  1 blocks them out completely; something less lets you keep a sense of what is around you, at
  the cost of some of the benefit.

#### The overlay

The second row is a separate comfort aid. The **overlay** is a faint set of markers that stay
put in your real room while the virtual scene moves. Tunnel vision works by taking motion away
from the edges of your view; the overlay works the other way round, by adding something that is
not moving, so part of what your eyes report agrees with your inner ear again. You can use
either, both, or neither.

- **none** — no markers. This is what you get without the block.
- **dots** — a sparse field of small points floating around you.
- **grid** — a wireframe on the floor of your room.
- **horizon** — a faint level ring at eye height. It travels with you rather than staying at
  one spot, and it stays level however you tilt your head, so it is the only one that also
  tells you which way up you are.

**shown** decides when they appear: **when moving** fades them in only while the scene is
moving under you and out again when it stops, and **always** leaves them up the whole time.
The published studies used markers that were always there; fading them in is gentler on the
look of your scene. Try both.

The markers are drawn over the top of your scene, so nothing in the world can hide them, and
they hold their place in the room even if the project flies you across the world. In a phone
holder they still stay level and hold still as you turn, but they cannot hold a spot in the
room, because the phone can only tell which way it is pointing, not where it is.

The three shapes are there to be compared. Once we know from testing which one helps most,
this will most likely become a single on-or-off choice.

Nothing happens on a flat screen or in AR, whatever you set it to.

> The technique comes from Fernandes and Feiner (2016),
> [Combating VR Sickness through Subtle Dynamic Field-of-View Modification](https://www.cs.columbia.edu/2016/combating-vr-sickness/images/combating-vr-sickness.pdf),
> IEEE 3DUI — restrict the field of view while the viewer is moving, and restore it when they
> are still. Allison and Palmisano (2025),
> [Visual Factors in Cybersickness: A Literature Survey and Meta-Analysis](https://doi.org/10.1163/22134808-bja10181),
> Multisensory Research, pooled 97 studies and found peripheral field-of-view restriction to be
> one of the few visual factors that reliably helps.
>
> The overlay — a *rest frame*, or independent visual background — comes from Prothero,
> Draper, Furness, Parker and Wells (1999),
> [The use of an independent visual background to reduce simulator side-effects](https://pubmed.ncbi.nlm.nih.gov/10102737/),
> Aviation, Space and Environmental Medicine — a stationary background seen along with the
> moving scene reduced the effects. It is the second visual factor the Allison and Palmisano
> meta-analysis found to work reliably, and it is complementary to the restrictor: one takes
> moving periphery away, the other adds a stationary reference.

### `show VR UI on [heads-up display / wrist]`

Buttons, sliders and text panels normally sit on the screen. In VR there is no screen, so they
need somewhere else to go:

- **heads-up display** — a panel floating about 1.5 m in front of you that turns with your
  head, so it is always in view.
- **wrist** — the panel sits on your left controller like a watch face. Turn your wrist to
  read it, drop your arm to put it away. With no left controller, you get the heads-up display
  instead.

The panel only gets in the way of your pointer when there is something on it to press, so
plain text will not stop you pointing at the world behind it. If your project asks you to type
something, a keyboard appears that you can type on with the controllers.

## Controls in VR

The controllers do the same jobs as the keyboard, so a project built for the keyboard works in
VR with no changes.

| Control | Action | Keyboard equivalent |
| --- | --- | --- |
| Left thumbstick | Move forward / back / left / right | W, S, A, D |
| Right thumbstick left / right | Snap turn 30° | — |
| Left **Y** | Button 1 | R or 1 |
| Right **B** | Button 2 | E or 2 |
| Left **X** | Button 3 | F or 3 |
| Right **A** | Button 4 | Space or 4 |

Turning happens in **snaps** of 30°, one per push of the stick, rather than as a smooth spin.
A snap is over before your eyes can read it as travel, where a continuous spin is motion your
body never made. In watch view you swing around your character so it stays in front of you; in
embody view you turn on the spot. With teleport motion, turning is part of teleporting: hold
the stick over and the arrow on the circle turns, so you choose which way you face as you
land.

In most modes the thumbstick goes to your own blocks, so a project that moves a character with
`when key pressed` works just as it does on the keyboard. Flock only takes the stick when
Flock is doing the moving: teleporting, or flying.

**Flying.** With `smooth` motion and no object being followed, the left thumbstick flies you
around the scene, and the left **Y** and **X** buttons take you up and down. While you are
flying, those two buttons do nothing else.

## Using your hands instead of controllers

On a headset with hand tracking — a Quest with the controllers put down, for example — your
hands appear in the scene and you can use them instead. Point at something and pinch your
finger and thumb to click it, or reach out and touch a panel with a fingertip. That covers
pressing buttons, dragging sliders and clicking objects. If you chose wrist UI, the panel
follows your left hand.

Hands cannot do anything that needs a stick or a button, so **moving, turning, teleporting**
and the four **button actions** above all need a controller. If your project is built around
walking, teleporting or `when key pressed`, ask players to pick their controllers up.

Projects you watch rather than drive — a scene that plays out on its own, or one you use
entirely through buttons and clickable objects — work well with hands alone.

## Sound in VR

Sound in Flock XR is **spatial**, which means it comes from a place in your world rather than
simply out of both speakers at once. Play a sound *from* an object and it sounds as though it
is coming from where that object is. Walk towards a waterfall and it gets louder; turn your
back on it and it moves to the ear behind you. This is a big part of what makes a scene feel
like a real place.

Worth knowing when you place sounds:

- **Distance matters.** A sound is at full volume within about a metre of its object, fades as
  you walk away, and cannot be heard at all beyond about 20 metres. To draw players across a
  big scene, put the sound on something nearer, or play it everywhere.
- **Everywhere is still useful.** A sound played from **everywhere** rather than from an
  object stays at full volume wherever you are. That is what you want for music, narration and
  button clicks.
- **Speech is placed too.** A `say` block read aloud comes from the object speaking and gets
  quieter as you walk away, though more roughly than a sound file: the volume drops, but it
  does not move between your ears, and it fades out by about 15 metres.
- **Headphones help.** You do hear direction through the headset's own speakers, but it is
  much easier to tell where a sound is coming from with headphones on.

None of this needs a VR block. It is the same `play sound` block you use on a flat screen —
there is just more it can do once you can turn your head.

## Tips

- `set XR mode` prints a short "XR Mode!" message when it takes effect. On a device with no
  headset, **VR headset** prints nothing, because nothing was started.
- While developing against a local server, a headset gets the enter button even for a project
  with no XR block, so you can try a project in VR before deciding to add one. That shortcut
  is local only: everywhere else the block is required.
- For anything fast-moving, prefer **watch + comfort**; for exploring, **embody + teleport**.
  Both are the comfortable pairings — your view only moves when you do — and both are chosen
  for you if you say nothing. If a project has to move people about quickly, add
  `set VR comfort` on top.
- Design your UI for VR: a wall of small text that works on a monitor is hard to read on a
  floating panel. Fewer, bigger controls work better.
