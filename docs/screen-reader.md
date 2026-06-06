# Screen reader accessibility in Flock XR

## Overview

Flock XR has an intial prototype of built-in screen reader support, enabling users who rely on assistive technology to navigate 3D worlds, interact with objects, and build programs. The implementation uses standard ARIA live regions and works with major screen readers including Windows Narrator, NVDA, JAWS, and VoiceOver.

This functionality is available in the [development version of Flock XR](https://flipcomputing.github.io/flock/) which is under active development. If you're interested in a more stable version for trying out the features then do get in touch. 

Flock XR also has initial screen reader support for creating project using Blockly blocks using Blockly v13. Additional work is ongoing to integrate this functionality into Flock XR so that creating projects is fully screen reader accessible. 

Flock XR supports spatial audio so sounds can be attached to meshes in 3D space and the volume and direction changes based on the proximity of the player to the source. 

The 2D UI componentsthat can be used in Flock XR are accessible by using tab and then interacting. This can be used to build text-based programs that are screen reader accessible. 

Many more features are on our roadmap, subject to funding, making Flock XR a viable coding environment for blind and visually impaired learners.

## Using Flock XR projects

### How it works

When a Flock XR world loads, the screen reader announces a brief introduction describing the scene and available controls. After that, objects and events are announced on demand via keyboard shortcuts, or automatically as they happen during a running program.

### Keyboard commands

These shortcuts work when the 3D canvas is focused.

- **Ctrl+H** — Repeat the help text and keyboard instructions
- **Ctrl+I** — Read a summary of the current scene and nearby objects
- **Ctrl+J** — Describe the nearest object — name, direction, distance, and any text or interaction hint
- **Ctrl+K** — Describe the object directly ahead (within a 45° forward cone)

#### Movement and navigation

- **W or Z** — Move forward (Z is an AZERTY layout alias)
- **S** — Move backward
- **A or Q** — Move left (Q is an AZERTY layout alias)
- **D** — Move right
- **Mouse** — Look around
- **E** — Interact with the nearest interactable object

### Gamepad / controller support

A gamepad or game controller can be used in place of, or alongside, the keyboard. Standard PS4-compatible controllers (and most other modern controllers) are supported.

#### Accessibility controls — D-pad

On controllers with a left analogue stick, the D-pad is reserved for accessibility commands. The directions correspond to the positions of the I, J, and K keys on a keyboard — I is above J, and K is below it:

- **D-pad Up** — Scene summary (Ctrl+I)
- **D-pad Left** — Nearest object (Ctrl+J)
- **D-pad Down** — Object ahead (Ctrl+K)

#### Movement and action buttons

- **Left stick** — Move forward / backward / left / right
- **Right stick** — Look around (camera)
- **L1 / R1 shoulder buttons** — Turn left / turn right
- **Circle (PS4)** — Interact with nearest object (same as E key)
- **Cross / X (PS4)** — General action (space bar equivalent)
- **Triangle (PS4)** — Action / camera up
- **Square (PS4)** — Action / camera down

On controllers without a left analogue stick the D-pad controls movement instead of accessibility commands which are still available from the keyboard.

### Scene and object descriptions

#### Scene summary — Ctrl+I

Gives an overview of the environment and the main objects in the scene, sorted by distance from your character. Includes any on-screen instruction text set by the program.

#### Nearest object — Ctrl+J

Announces the closest non-environment object, including:

- Object name
- Direction relative to where you are facing (e.g. "in front of you, to your right")
- Distance ("very close", "nearby", "a short distance away", "further away", "far away")
- Any text or say text associated with the object
- An interaction hint if the object is interactable

Distance is measured from the nearest surface of the object's bounding box, so large objects are described as close when you are standing next to them.

#### Facing object — Ctrl+K

Identifies the object directly ahead within a 45° cone in front of your character or the camera, measured along the ground plane. Reports direction (Forward, Left, or Right) and distance. Objects you are standing on or inside are excluded from this check.

### Interacting with objects

When an object is interactable, this is included in the nearest object announcement (Ctrl+J). Press **E** (or Circle on a PS4 controller) to interact. The screen reader announces the object name, any text it shows, and any interaction hint.

The visual interact indicator appears when an interactable object is within approximately 4 metres of your character. Objects further away are not highlighted.

### 2D UI components

Flock XR programs can include 2D UI components such as text input fields, sliders, and buttons. 

- **Tab** from the canvas to move focus into the UI controls.
- **Shift+Tab** moves backwards, returning to the canvas at either end.
- Sliders are exposed as range inputs and can be adjusted with the arrow keys.
- Text inputs are full HTML text fields — screen readers stay in forms mode and keypresses go directly to the field.
- Buttons can be activated with Enter or Space.

The tab order of UI controls reflects the order in which they are added.

## Creating projects with Blockly

Blockly v13 is adding screen reader support for creating projects using a screen reader. Flock XR has partial support for this and we're hoping to add full support as soon as we can by fully integrating with Flock XR blockly blocks. 

Screen reader support builds on keyboard controls support for Blockly. Keyboard navigation is currently being added to the Flock XR UI and Blockly blocks. 

### Sound blocks

Flock XR has a range of sound blocks including longer themes, sound effects and musical note blocks. We intend to improve these blocks and make them blocks fully accessible to screen reader users.

Sounds can be played from everywhere in the scene or attached to an object to provide spatial audio. Spatial audio means that a sound comes from a particular position in 3D space and is heard relative to the player. 

This feature can be used to add interest and orientation for users who are blind or visually impaired. 

### Say blocks and print blocks

Flock XR programs can display text to the player using **say** and **print** blocks.

- **Print blocks** — text is live-announced by the screen reader when it appears on screen.
- **Say blocks with a duration** — text is live-announced immediately when the say block fires, and is also included in the nearest object description (Ctrl+J) for as long as it is displayed.
- **Say with duration 0** (persistent say) — the text is not live-announced, but is stored as a permanent description for the object and becomes part of the nearest object description when you use Ctrl+J. This is useful for setting a standing description that players can discover when they approach.

Flock XR also has speech blocks that can generate speech from text. 

### Text projects
The 2D controls mean that Flock XR can be used to build text-based programs — games and interactive stories that work through text output and input without relying on the 3D scene visually. Using print blocks, say blocks, and UI input blocks, it is possible to create projects that are usable by screen reader users.

## Future
There's so much we can do in Flock XR to allow the creation and exploration of 3D spatial worlds using a screen reader. 

This includes adding sonification to help users navigate, adding improved music composition and spatial audio support and adding haptic feedback through low cost games controllers. And probably lots of things we haven't thought of yet. 

Flock XR enables young people to have creative expression. It can also be used to increase awareness of screen reader use so that young people can themselves create projects that are accessible to others. 

Spatial computing is imcreasingly important in society and industry with some key capabilities that are relevant to users who are blind or visually impaired. Flock XR has the potential to offer virtual experiences that enable users to practice skills such as tech-supported 3D navigation. 

## Credits

Screen reader support for creating Blockly projects in Flock XR is possible through [Blockly's keyboard navigation and screen reader support](https://www.blockly.com/accessibility). Tracy (creator and maintainer of Flock XR played a key role in this work through the [micro:bit Educational Foundation](https://microbit.org/accessibility/microsoft-makecode/)), working closely with a youth panel. 

Support for adding keyboard controls support to Flock XR is ongoing and supported by [NLnet](https://nlnet.nl/project/FlockXR-a11y-mobile-UX/). 

The initial screen reader accessibility prototype for Flock XR was developed by **Esther Mbugua**, a final year Computer Science student at the University of Sheffield.

- [Esther's GitHub](https://github.com/essymbugua)
- [Esther's LinkedIn](https://uk.linkedin.com/in/esther-mbugua-513b9a25b)

The work has been extended and further developed since the initial prototype and we would like to take it much further.

We continually use the [RNIB Gaming Devkit](https://github.com/RNIB-MediaAndCulture/Gaming_Devkit/blob/main/Devkit.md) as a useful reference for accessible game development.

## Supporting the work

Flock XR is open-source and accessibility work is ongoing. We are actively looking for sponsorship to continue developing screen reader support, improve the Blockly editor experience, and make Flock XR more widely accessible.

We're really excited about what is possible here, but we're going to need support to complete this work to a high standard including working closely with users who have a deep understanding of how this capability needs to work. 

- [Sponsor Flock XR on GitHub Sponsors](https://github.com/sponsors/flipcomputing)
- [Get in touch via flockxr.com](https://flipcomputing.com/contact/)
