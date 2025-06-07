
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
  - `loop` (boolean, default: true): Whether to loop the animation
  - `restart` (boolean, default: false): Whether to restart if already playing

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

#### `createCharacter(name, characterType, position)`
Creates a character model in the scene.

**Parameters:**
- `name` (string): Unique identifier for the character
- `characterType` (string): Type of character to create
- `position` (object): World position {x, y, z}

#### `createObject(name, objectType, position)`
Creates an object in the scene.

#### `createModel(name, modelPath, position, options)`
Loads and creates a custom 3D model.

### Shapes

#### `createBox(name, options)`
Creates a box geometry.

**Parameters:**
- `name` (string): Unique identifier
- `options` (object): Box configuration
  - `size` (number): Size of the box
  - `position` (object): Position {x, y, z}
  - `color` (string): Hex color value

#### `createSphere(name, options)`
Creates a sphere geometry.

#### `createCylinder(name, options)`
Creates a cylinder geometry.

#### `createCapsule(name, options)`
Creates a capsule geometry.

#### `createPlane(name, options)`
Creates a plane geometry.

### Materials and Effects

#### `highlight(meshName, options)`
Adds a highlight effect to a mesh.

**Parameters:**
- `meshName` (string): Name of the mesh to highlight
- `options` (object): Highlight configuration
  - `color` (string): Highlight color

#### `glow(meshName, options)`
Adds a glow effect to a mesh.

#### `tint(meshName, options)`
Applies a color tint to a mesh.

#### `setAlpha(meshName, alpha)`
Sets the transparency of a mesh.

**Parameters:**
- `meshName` (string): Name of the mesh
- `alpha` (number, 0-1): Transparency value (0 = transparent, 1 = opaque)

#### `changeColor(meshName, color)`
Changes the color of a mesh.

#### `clearEffects(meshName)`
Removes all visual effects from a mesh.

### Movement and Transform

#### `moveTo(meshName, position, options)`
Moves a mesh to a specific position.

**Parameters:**
- `meshName` (string): Name of the mesh to move
- `position` (object): Target position {x, y, z}
- `options` (object): Movement configuration
  - `duration` (number): Animation duration in milliseconds
  - `easing` (string): Easing function

#### `glideTo(meshName, position, duration)`
Smoothly animates a mesh to a new position.

#### `rotate(meshName, rotation, options)`
Rotates a mesh.

#### `scale(meshName, scaling, options)`
Scales a mesh.

### Physics

#### `setPhysics(meshName, physicsType)`
Applies physics properties to a mesh.

**Parameters:**
- `meshName` (string): Name of the mesh
- `physicsType` (string): Type of physics ("BOX", "SPHERE", "MESH", "NONE")

#### `applyForce(meshName, force)`
Applies a force to a physics-enabled mesh.

### Scene Environment

#### `createGround(options)`
Creates a ground plane.

#### `setSky(skyType)`
Sets the skybox/environment.

#### `lightIntensity(intensity)`
Adjusts the scene lighting intensity.

#### `setFog(options)`
Adds fog to the scene for atmospheric effects.

### Camera

#### `getCamera()`
Returns the active camera object.

#### `cameraControl(enabled)`
Enables/disables camera controls.

#### `attachCamera(meshName)`
Attaches the camera to follow a specific mesh.

### UI

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

#### `randomInteger(min, max)`
Returns a random integer between min and max.

#### `keyPressed(key)`
Checks if a specific key is currently pressed.

#### `getProperty(meshName, propertyName)`
Gets a property value from a mesh (position, rotation, scale, etc.).

### Events

#### `onEvent(eventName, handler)`
Registers an event handler.

#### `broadcastEvent(eventName, data)`
Broadcasts a custom event.

#### `onTrigger(meshName, callback)`
Sets up collision/trigger detection for a mesh.

## Examples

### Basic Scene Setup
```javascript
await initialize();
await createScene();

// Create a character
await createCharacter("player", "Character1", {x: 0, y: 0, z: 0});

// Add some objects
await createBox("box1", {
  size: 1,
  position: {x: 2, y: 0.5, z: 0},
  color: "#ff0000"
});

// Play an animation
await playAnimation("player", {
  animationName: "wave",
  loop: false
});
```

### Interactive Game Loop
```javascript
forever(async () => {
  if (keyPressed("W")) {
    await glideTo("player", {x: 0, y: 0, z: 2}, 500);
  }
  
  if (keyPressed(" ")) {
    await playSound("jump");
    await playAnimation("player", {animationName: "jump"});
  }
});
```

## Constants and Configuration

### Character Types
- `"Character1"`, `"Character2"`, `"Character3"`, `"Character4"`
- `"Cat"`, `"Monkey"`, `"Person"`

### Physics Types
- `"BOX"` - Box collision shape
- `"SPHERE"` - Sphere collision shape  
- `"MESH"` - Mesh collision shape
- `"NONE"` - No physics

### Key Codes
- Standard keyboard keys: `"W"`, `"A"`, `"S"`, `"D"`, `" "` (space)
- Special keys: `"ANY"`, `"NONE"`

## Error Handling

Most Flock functions are asynchronous and should be awaited. If a mesh or resource is not found, functions will typically fail silently or log warnings to the console.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to Flock XR.
