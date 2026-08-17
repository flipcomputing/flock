# Accessibility statement for Flock XR

This accessibility statement applies to the current development version of Flock XR which is developed in public. For information about the current release aligned with curriculum resources, please visit [flockxr.com](https://flockxr.com/).

The Flock XR project is committed to accessibility. The app has been designed with an inclusion-first approach from the start. We prioritize accessibility and work with lived experience consultants and experts and co-design with young people from relevant communities.

Documentation for keyboard controls is included in the app through the `Ctrl + /` command or the keyboard help button. Detailed instructions are available on the keyboard controls page on the hub.

The font size of the help text is customisable. 

## Keyboard controls

Flock XR supports keyboard controls for the blocks workspace, the user interface and the 3D canvas. This enables users with fine motor challenges to create projects without needing to use a mouse, trackpad or touchscreen. Keyboard support also enables accessibility devices such as adaptive switches and grid input software.

### Output 3D canvas

Projects created in Flock XR are fully keyboard accessible. Keyboard controls can be used for movement and button inputs. The on-click behavior is also available through pressing the E key when an interact indicator appears for an object.

Keys can also be mapped to suit user preferences.

2D UI controls are also accessible and have a visible focus indicator. 

### Blocks workspace

Block-based coding apps have typically been inaccessible to young people. Recent work on Blockly is changing that. Flock XR has a grant from NLnet which includes integration of keyboard controls into the Flock XR workspace. It is now possible to fully create Flock XR projects using the keyboard.

### User interface

The Flock XR user interface is keyboard accessible including the menus and gizmos. Use `Ctrl + B` to open the area menu to quickly move between areas and `Tab` to move within areas.

The color-picker gizmo has keyboard controls for the color wheel, color swatches and sliders. 

The project inspector, from the Tools section of the menu, is keyboard accessible. 

## Screen reader and blindness

Flock XR allows users to create in 3D space. Although the visual aspects of the environment are not directly accessible to users without sight, there are many other ways to engage with 3D digital space and physical inputs and outputs. Flock XR is architected to allow for multimodal experiences.

Flock XR has partial screen reader support. We are seeking funding to make this comprehensive.

### Output 3D canvas

In 2026, Esther Mbugua, a final-year Computer Science student from the University of Sheffield, created a prototype of screen reader support for the 3D canvas and got feedback from local screen reader users. The prototype provided information about nearby objects and interaction. This has since been extended to provide additional information and navigation and interaction support. This is very much a work in progress and there are many ways this can be improved in future.

Flock XR offers a rich environment for users who are blind or visually impaired with rich spatial information, comprehensive music creation features with spatial audio, and the ability to interact with the BBC micro:bit and games controllers.

### 2D Output UI

On-screen 2D UI components created by projects are accessible with a screen reader through equivalents with ARIA labels. This includes text, buttons, sliders and text input boxes. 

### Blocks workspace

The blocks workspace does not yet have custom labels for all fields. We have put some preliminary integration in place with the Blockly v13 screen reader support and we’re seeking funding to complete this and add specialized screen reader support for custom blocks.

Flock XR offers a describe block in the Text category. This block is used to provide a custom description of an object which is then used in screen reader output. This is the 3D equivalent of alt text on the web and allows users to offer rich audio descriptions of objects in a scene.

### User interface

The Flock XR user interface uses ARIA labels and follows best practices. Some custom menus require additional development effort which is on our roadmap.

Screen reader support works alongside a games controller so you can access screen reader shortcuts via the left gamepad arrow buttons and use the games controller joysticks and buttons for gameplay.

Notifications are also announced. 

## Low vision

Flock XR has a number of features for low vision but we’re aware that this could be further extended in future.

### Zoom

Flock XR can be used with browser zoom to increase the size of text and UI components throughout the user interface. There are also separate controls for the blocks workspace to allow blocks to be further zoomed in. This feature is also useful for classroom use on an electronic whiteboard or projector.

### Atkinson hyperlegible font

Flock XR uses the Atkinson Hyperlegible Font throughout including on coding blocks, the user interface and in text on the canvas. This font has been designed for users with low vision and has clearly distinguishable letters. For example, the number 0 has a strikethrough to distinguish it from the letter O. We have chosen this as the main font rather than offering it as an option as this design is helpful for all users.

### Dark contrast and low vision themes

The dark contrast theme offers higher contrast for users that need or prefer it. We also have a low vision black and white mode that does not rely on colors and uses icons instead.

### Browser font size

Flock XR respects the browser font size settings so users can set their minimum font size in the browser and Flock XR will apply that to 2D UI text on the Flock XR canvas.

## Color blindness

### Block category colors

The category colors in Flock XR have been chosen to be as color-blind friendly as possible. The low vision black and white theme uses icons instead of colors to offer another alternative.

### Gizmos

Traditional 3D tool gizmos use red, green and blue for the axes on gizmos for positioning, rotating and scaling objects on the canvas. Red and green are particularly problematic for users who are color blind. Instead, Flock XR uses the closest colors from the Okabe-Ito color theme which has been designed for maximum discrimination by users who are color blind.

### Data visualization

Flock XR can be used to create data visualizations. The color palettes in the color picker include Okabe-Ito which is a set of colors designed for use in data visualization where distinguishable colors are needed.

We plan to further investigate how users can have control over colors in projects created by others.

## Subtitles

Flock XR has blocks for subtitles. These can be globally enabled for projects that use text-to-speech blocks. There is also a subtitle block that can be used to provide audio descriptions that are controlled by a project creator.

We intend to further expand this feature with audio descriptions of sounds in future.

## Games controllers

Flock XR supports gamepad controllers for gameplay and for controlling the camera at design time. This means it is possible to use adaptive games controllers to play projects created with Flock XR.

There has been interest in making the Flock XR user interface and blocks workspace fully accessible with a games controller. We will endeavor to explore this in future.

## Motor control

In addition to keyboard controls and support for adaptive inputs, Flock XR has a number of features to support users with fine motor control challenges.

### Context toolbar and bottom bar buttons

Additional actions for blocks are available from the right-click menu in Flock XR which requires a tap-and-hold gesture on touch screens. Common actions are offered on a pop-up context menu which is easier to access.

Additional actions for the blocks workspace are available as buttons in the bottom toolbar.

### Locking blocks

Blocks that are not currently being edited can be locked from the context menu. This avoids accidental edits.

### Tap before drag on phones

On small phone screens, Flock XR requires a tap to select a block before dragging to avoid accidental drags. This may be offered as a setting for all platforms in future. Please let us know if this would be useful.

## Cognitive accessibility

### Cognitive load and dyslexia

Flock XR tries hard to balance having a clean interface with making features easily discoverable.

Language used has been tested and refined in many classrooms during co-design sessions with educators and young people. Icons with strong correspondence to their actions are used throughout.

We would consider adding a dyslexia-specific or additional dyslexia-friendly font if users feel that this would be a useful alternative to the Atkinson Hyperlegible font.

### Neurodivergence

Flock XR follows a universal design for learning approach throughout the tool and resources.

This means that we offer alternative ways to achieve an outcome. For example, students can use visual gizmos to place objects on the canvas or they can use code blocks and they can move back and forwards between the representations.

We consider differences such as aphantasia (no visual imagery) and spatial cognitive challenges (such as topographical developmental disorientation and dyspraxia) which can have implications in a visuospatial context.

### Social, emotional and mental health

Specialist computing educator Catherine Moore has written an excellent article that shares her experience and advice on using Flock XR with students with additional social, emotional and mental health needs.

[Programming 3D worlds in Flock XR with students with social, emotional and mental health needs](https://sheffieldclc.net/programming-3d-worlds-in-flock-xr-with-students-with-social-emotional-and-mental-health-needs/)

## Virtual reality

### Cyber-sickness
Studies have shown that females are more likely to suffer from cyber-sickness in virtual reality. 

Flock XR defaults to viewing and interaction patterns that are considered less likely to trigger cyber sickness. This includes comfort motion where the camera jumps when movement stops rather than moving continually, and snap turn rotation rather than smooth notation. 

We don't restrict other interaction patterns to maximie opportunities for creativity, but we encourage project developers to think carefully about how they use VR features, particularly when sharing projects.

## Feedback and contact information

If you encounter an accessibility barrier in Flock XR or need information in a different format, please [contact the Flock XR team](https://flipcomputing.com/contact/). You can find more information about Flock XR at [flockxr.com](https://flockxr.com/).

## Review date

This statement was last reviewed on 17 August 2026.
