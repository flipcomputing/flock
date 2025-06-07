
# Flock XR API Documentation

## Overview

Flock XR is a creative coding platform for 3D development using Blockly and Babylon.js. This document describes the JavaScript API that's available when writing code in Flock.

## Core Functions

### Scene Management

#### `initialize()`
Initializes the Flock environment and sets up the 3D scene.

**Example:**
```javascript
await initialize();
```

#### `createEngine()`
Creates a new Babylon.js rendering engine.

#### `createScene()`
Creates a new 3D scene with default lighting and camera setup.

### Animation

#### `playAnimation(meshName, options)`
Plays an animation on a specified mesh.

**Parameters:**
- `meshName` (string): Name of the mesh to animate
- `options` (object): Animation configuration
  - `animationName` (string): Name of the animation to play
  - `loop` (boolean, default: false): Whether to loop the animation
  - `restart` (boolean, default: true): Whether to restart if already playing

**Example:**
```javascript
await playAnimation("character1", { 
  animationName: "walk", 
  loop: true 
});
```

#### `switchAnimation(meshName, options)`
Switches to a different animation on a mesh.

**Parameters:**
- `meshName` (string): Name of the mesh
- `options` (object): Animation options
  - `animationName` (string): Name of the animation to switch to
  - `loop` (boolean, default: true): Whether to loop
  - `restart` (boolean, default: false): Whether to restart

**Example:**
```javascript
await switchAnimation("character1", { 
  animationName: "run" 
});
```

#### `animateKeyFrames(meshName, options)`
Animates a property using keyframes.

**Parameters:**
- `meshName` (string): Name of the mesh to animate
- `options` (object): Animation configuration
  - `keyframes` (array): Array of keyframe objects with `duration` and `value`
  - `property` (string): Property to animate (e.g., "color", "alpha", "position")
  - `easing` (string, default: "Linear"): Easing function
  - `loop` (boolean, default: false): Whether to loop
  - `reverse` (boolean, default: false): Whether to reverse

**Example:**
```javascript
await animateKeyFrames("box1", {
  keyframes: [
    { duration: 0, value: "#FF0000" },
    { duration: 2, value: "#00FF00" }
  ],
  property: "color",
  loop: true
});
```

#### `glideTo(meshName, options)`
Smoothly moves a mesh to a new position.

**Parameters:**
- `meshName` (string): Name of the mesh to move
- `options` (object): Movement configuration
  - `x`, `y`, `z` (number, default: 0): Target position coordinates
  - `duration` (number, default: 1000): Duration in milliseconds
  - `easing` (string, default: "Linear"): Easing function
  - `reverse` (boolean, default: false): Whether to reverse
  - `loop` (boolean, default: false): Whether to loop

**Example:**
```javascript
await glideTo("player", {
  x: 5, y: 0, z: 3,
  duration: 2000,
  easing: "SineEase"
});
```

#### `rotateAnim(meshName, options)`
Rotates a mesh with animation.

**Parameters:**
- `meshName` (string): Name of the mesh to rotate
- `options` (object): Rotation configuration
  - `x`, `y`, `z` (number, default: 0): Rotation angles in degrees
  - `duration` (number, default: 1000): Duration in milliseconds
  - `easing` (string, default: "Linear"): Easing function
  - `reverse` (boolean, default: false): Whether to reverse
  - `loop` (boolean, default: false): Whether to loop

**Example:**
```javascript
await rotateAnim("box1", {
  x: 90, y: 180, z: 0,
  duration: 1500
});
```

#### `animateProperty(meshName, options)`
Animates a specific property of a mesh.

**Parameters:**
- `meshName` (string): Name of the mesh
- `options` (object): Animation configuration
  - `property` (string): Property to animate
  - `targetValue` (any): Target value for the property
  - `duration` (number, default: 1000): Duration in milliseconds
  - `reverse` (boolean, default: false): Whether to reverse
  - `loop` (boolean, default: false): Whether to loop
  - `mode` (string, default: "AWAIT"): Animation mode

### Audio

#### `playSound(soundName, options)`
Plays a sound effect or music.

**Parameters:**
- `soundName` (string): Name of the sound file
- `options` (object): Sound configuration
  - `volume` (number, 0-1): Volume level
  - `loop` (boolean): Whether to loop the sound
  - `spatial` (boolean): Whether to use 3D spatial audio

#### `stopAllSounds()`
Stops all currently playing sounds.

### Models and Objects

#### `createCharacter(options)`
Creates a character model in the scene.

**Parameters:**
- `options` (object): Character configuration
  - `modelName` (string): Name of the character model file
  - `modelId` (string): Unique identifier for the character
  - `scale` (number, default: 1): Scale factor
  - `position` (object): World position {x, y, z}
  - `colors` (object): Color configuration for different parts

**Example:**
```javascript
const player = createCharacter({
  modelName: 'Character2.glb',
  modelId: 'player_unique_id',
  scale: 1,
  position: { x: 0, y: 0, z: 0 },
  colors: {
    hair: "#ffcc00",
    skin: "#f0d5b1",
    eyes: "#33cc00"
  }
});
```

#### `createObject(name, objectType, position, options)`
Creates an object in the scene.

#### `createModel(name, modelPath, position, options)`
Loads and creates a custom 3D model.

### Shapes

#### `createBox(name, color, width, height, depth, position)`
Creates a box geometry.

**Parameters:**
- `name` (string): Unique identifier
- `color` (string): Hex color value
- `width`, `height`, `depth` (number): Dimensions
- `position` (array): Position [x, y, z]

**Example:**
```javascript
const box1 = createBox("myBox", "#ff0000", 2, 2, 2, [0, 1, 0]);
```

#### `createSphere(name, options)`
Creates a sphere geometry.

#### `createCylinder(name, options)`
Creates a cylinder geometry.

#### `createCapsule(name, options)`
Creates a capsule geometry.

#### `createPlane(name, options)`
Creates a plane geometry.

### Materials and Effects

#### `setAlpha(meshName, alpha)`
Sets the transparency of a mesh.

**Parameters:**
- `meshName` (string): Name of the mesh
- `alpha` (number, 0-1): Transparency value (0 = transparent, 1 = opaque)

**Example:**
```javascript
await setAlpha("box1", 0.75);
```

#### `changeColor(meshName, color)`
Changes the color of a mesh.

#### `highlight(meshName, options)`
Adds a highlight effect to a mesh.

#### `glow(meshName, options)`
Adds a glow effect to a mesh.

#### `tint(meshName, options)`
Applies a color tint to a mesh.

#### `clearEffects(meshName)`
Removes all visual effects from a mesh.

### Movement and Transform

#### `moveTo(meshName, position, options)`
Moves a mesh to a specific position instantly.

#### `moveForward(meshName, distance)`
Moves a mesh forward by a specified distance.

**Parameters:**
- `meshName` (string): Name of the mesh to move
- `distance` (number): Distance to move forward

#### `rotate(meshName, x, y, z)`
Rotates a mesh instantly.

**Parameters:**
- `meshName` (string): Name of the mesh
- `x`, `y`, `z` (number): Rotation values

#### `scale(meshName, scaling, options)`
Scales a mesh.

### Physics

#### `setPhysics(meshName, physicsType)`
Applies physics properties to a mesh.

**Parameters:**
- `meshName` (string): Name of the mesh
- `physicsType` (string): Type of physics ("DYNAMIC", "STATIC", "KINEMATIC")

**Example:**
```javascript
await setPhysics("player", "DYNAMIC");
```

#### `applyForce(meshName, force)`
Applies a force to a physics-enabled mesh.

### Scene Environment

#### `createGround(color, name)`
Creates a ground plane.

**Parameters:**
- `color` (string): Hex color for the ground
- `name` (string): Name identifier for the ground

**Example:**
```javascript
createGround("#ffffff", "ground");
```

#### `setSky(color)`
Sets the skybox/environment color.

**Parameters:**
- `color` (string): Hex color for the sky

**Example:**
```javascript
setSky("#ffffff");
```

#### `lightIntensity(intensity)`
Adjusts the scene lighting intensity.

#### `setFog(options)`
Adds fog to the scene for atmospheric effects.

### Camera

#### `getCamera()`
Returns the active camera object.

**Example:**
```javascript
const camera = getCamera();
```

#### `cameraControl(enabled)`
Enables/disables camera controls.

#### `attachCamera(meshName, distance)`
Attaches the camera to follow a specific mesh.

**Parameters:**
- `meshName` (string): Name of the mesh to follow
- `distance` (number): Distance from the mesh

**Example:**
```javascript
await attachCamera("player", 7);
```

### UI

#### `printText(text, size, color)`
Displays text in the UI.

**Parameters:**
- `text` (string): Text to display
- `size` (number): Font size
- `color` (string): Hex color

**Example:**
```javascript
printText('🌈 Hello', 30, "#000080");
```

#### `buttonControls(type, enabled, color)`
Creates button controls for user interaction.

**Parameters:**
- `type` (string): Type of controls (e.g., "ARROWS")
- `enabled` (boolean): Whether controls are enabled
- `color` (string): Hex color for the buttons

**Example:**
```javascript
buttonControls("ARROWS", true, "#cc33cc");
```

#### `say(meshName, text, duration)`
Displays speech bubble text above a mesh.

#### `UIText(text, options)`
Creates UI text elements.

#### `UIButton(text, callback, options)`
Creates interactive UI buttons.

### Utility Functions

#### `wait(duration)`
Pauses execution for a specified time.

**Parameters:**
- `duration` (number): Wait time in milliseconds

**Example:**
```javascript
await wait(100);
```

#### `randomInteger(min, max)`
Returns a random integer between min and max.

**Example:**
```javascript
const random = randomInteger(1, 5);
```

#### `randomColour()`
Returns a random hex color.

**Example:**
```javascript
const color = randomColour();
```

#### `keyPressed(key)`
Checks if a specific key is currently pressed.

**Parameters:**
- `key` (string): Key to check (e.g., "w", "a", "s", "d")

**Example:**
```javascript
if (keyPressed("w")) {
  // Move forward
}
```

#### `getProperty(meshName, propertyName)`
Gets a property value from a mesh.

### Events and Control Flow

#### `forever(callback)`
Runs a function in an infinite loop.

**Parameters:**
- `callback` (function): Function to execute repeatedly

**Example:**
```javascript
forever(async () => {
  if (keyPressed("w")) {
    moveForward("player", 3);
    await switchAnimation("player", { animationName: "Walk" });
  } else {
    await switchAnimation("player", { animationName: "Idle" });
  }
});
```

#### `onEvent(eventName, handler)`
Registers an event handler.

#### `broadcastEvent(eventName, data)`
Broadcasts a custom event.

#### `onTrigger(meshName, callback)`
Sets up collision/trigger detection for a mesh.

## Examples

For a complete working example, see [example.html](example.html) in the repository, which demonstrates a full Flock XR application with character movement, physics, and camera controls.

### Basic Scene Setup
```javascript
setSky("#ffffff");
createGround("#ffffff", "ground");
printText('🌈 Hello', 30, "#000080");
buttonControls("ARROWS", true, "#cc33cc");

const player = createCharacter({
  modelName: 'Character2.glb',
  modelId: 'player_unique_id',
  scale: 1,
  position: { x: 0, y: 0, z: 0 }
});

await setPhysics(player, "DYNAMIC");
await attachCamera(player, 7);
```

### Interactive Game Loop
```javascript
forever(async () => {
  if (keyPressed("w")) {
    moveForward("player", 3);
    await switchAnimation("player", { animationName: "Walk" });
  } else if (keyPressed("s")) {
    moveForward("player", -3);
    await switchAnimation("player", { animationName: "Walk" });
  } else {
    await switchAnimation("player", { animationName: "Idle" });
  }
});
```

### Animation Examples
```javascript
// Keyframe animation
await animateKeyFrames("box1", {
  keyframes: [
    { duration: 0, value: "#FF0000" },
    { duration: 2, value: "#00FF00" },
    { duration: 4, value: "#0000FF" }
  ],
  property: "color",
  loop: true
});

// Smooth movement
await glideTo("player", {
  x: 10, y: 0, z: 5,
  duration: 3000,
  easing: "SineEase"
});
```

## Constants and Configuration

### Character Types
- `"Character1"`, `"Character2"`, `"Character3"`, `"Character4"`
- `"Cat"`, `"Monkey"`, `"Person"`

### Physics Types
- `"DYNAMIC"` - Object affected by forces and gravity
- `"STATIC"` - Fixed object that doesn't move
- `"KINEMATIC"` - Object that can be moved but isn't affected by forces

### Easing Functions
- `"Linear"`, `"SineEase"`, `"CubicEase"`, `"QuadraticEase"`
- `"ExponentialEase"`, `"BounceEase"`, `"ElasticEase"`, `"BackEase"`

### Key Codes
- Movement keys: `"w"`, `"a"`, `"s"`, `"d"`
- Special keys: `" "` (space), `"ANY"`, `"NONE"`

## Error Handling

Most Flock functions are asynchronous and should be awaited. If a mesh or resource is not found, functions will typically fail silently or log warnings to the console.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to Flock XR.
