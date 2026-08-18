# AR and phone viewing in Flock XR

As well as running on screen, a Flock XR project can be placed in the room around you with
augmented reality, or looked around by tilting a phone like a window into the scene. This page
explains how to get into those modes and what each of the blocks does.

> This page is about **AR and phone viewing**. Viewing a project in a VR headset is covered in
> [VR in Flock XR](vr.md).
>
> It describes the development version of Flock XR. The
> [Flock XR Hub](https://hub.flockxr.com) covers the released version.

## Safety

AR can involve moving around a real room while looking at a screen, so you
cannot see everything around you. Keep an eye on where you are walking, and give yourself
clear space. 

## AR in Flock XR

**On Android, open the project in Chrome and it should just work.** There is nothing to
install and nothing to switch on — most Android phones and tablets, including older ones, can
already do AR in the browser.

Run a `set XR mode` block and an **enter AR** button appears in the corner of the scene. You
have to tap it yourself: the browser will not start AR without it.

AR needs Google's ARCore support. Most Android devices have it but some cheaper devices without a gyroscope sensor may not. Without it you get no **enter
AR** button, and your scene appears in front of the camera picture instead.

To come back out on Android, swipe down from the top of the screen to bring the buttons back,
then use the back button. In a headset, press the system button — on a Quest that is the
**Meta button**, the oval one on the right controller. Your project carries on running behind,
so you can tap **enter AR** again to go back in.

**On iPhone and iPad**, Safari cannot do AR in a web browser at all. Rather than showing a button that does
nothing, Flock puts your scene in front of the rear camera picture instead. You get some of
the same effect — your project appears in front of whatever the camera is pointed at — but the
scene does not stay put in the room as you move the phone about. The same thing happens on any
Android device that turns out not to do AR.

That fallback needs the default camera. If your project uses a `camera follow` block you get
no camera picture and no look-around, and the project runs just as it does on screen.

**Headsets** that can show you the room through their cameras run AR too. There your scene
appears at life size around you, in your real room, rather than as a model on the floor.

## The AR blocks

### `set XR mode to [AR / Magic Window]`

Sets up AR and shows the enter button. Run it once, near the start of your project.

- **AR (Augmented Reality)** — your scene is drawn over a live view of the room. If the device
  turns out not to do AR, Flock switches to Magic Window instead.
- **Magic Window (look-around)** — hold the phone up and turn on the spot to look around your
  scene, as if the screen were a window into it. There is no button to press: it starts as soon
  as the block runs.

The third option, **VR**, is for headsets and is covered in [VR in Flock XR](vr.md).

Magic Window needs the phone's tilt sensor, and not every phone will share it — iPhones and
iPads never do. Those phones show your scene in front of the rear camera picture instead. You
still get a sense of the scene being in the room, but the view stays put as you turn. Magic
Window also needs the default camera: with a `camera follow` block you get neither the
look-around nor the camera picture. On a desktop there is no tilt sensor, so nothing changes.

In a headset, Magic Window becomes full VR, since a headset already tracks your head as you
move it.

### `set AR scene scale: [ ] cm distance: [ ] cm height: [ ] cm`

Shrinks your whole scene down to a model you can walk around.

- **Scale** — how wide the scene appears in the room, in centimetres. The whole world is
  scaled so that its widest side measures that much. Set it to `0` for life size, and you
  stand in the scene rather than looking at a model of it.
- **Distance** — how far in front of you the scene is placed when AR starts. 30 cm if you
  leave it alone.
- **Height** — how far the scene floats above the floor. `0` sits it on the floor.

The block starts out set to 80 cm, 30 cm in front of you, sitting on the floor. If you never
use the block at all, a **phone** gets a 150 cm scene it can look down on, and a **headset**
gets life size.

Flat ground gets out of the way when the scene is shrunk: it either disappears, or turns into
an invisible surface that still catches your objects' shadows, so the model looks like it is
sitting on your real table. Terrain built from a heightmap is part of your scene, so it stays
visible.

On a phone the scene is also pushed back far enough to fit on the screen when you hold the
phone naturally. A phone points wherever you hold it, so a model at arm's length would
otherwise sit below the screen entirely. In a headset you can just look down at your feet.

### `use [user / environment] camera as background`

Puts the picture from the device camera behind your scene. `user` is the selfie camera,
`environment` is the one on the back. This works on a phone, and on a desktop with a webcam,
and gives an AR-like effect without AR, which is useful on devices that cannot run it.

A **headset** cannot show its camera picture to a web page at all. Instead, this block makes
the enter button open AR, so your real room shows through wherever your scene is transparent.
The sky and background colour are turned off while that runs, and come back when you leave.

## What is different in AR

**Tap instead of point.** A phone has one screen and no controllers, so there is no pointer —
you tap objects on the screen. In a headset you keep your controllers, and your hands, and
they work as they do in VR.

**Your UI looks the way it does on screen.** Buttons, sliders and text panels stay where they
are as you move the phone around, and you tap them exactly as you would on a desktop. The
`show VR UI on wrist` block has no controller to attach anything to, so it makes no difference
on a phone.

**Movement blocks are for VR.** `set VR view` and the teleport blocks do nothing in AR. Here
you move by moving — walking around your room, or carrying the phone around the scene.

## Tips

- Try your scene out at the size you mean to use. Something that reads well as an 80 cm model
  on a phone can be overwhelming at life size.
- Give the scene somewhere to sit. A model on the floor of a cluttered room is harder to see
  than one raised onto a table with the height setting.
- Bright rooms wash out dark scenes. Strong, well-lit colours show up better in AR than subtle
  ones.
