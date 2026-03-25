import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { meshMap, meshBlockIdMap, generateUniqueId } from "./mesh-state.js";
import { getFieldValue } from "./generators-utilities.js";

export function registerSceneGenerators(javascriptGenerator) {
  // -------------------------------
  // SCENE
  // -------------------------------
  // Sky
  // Map with material
  // Background
  // Show object
  // Hide object
  // Dispose object
  // -------------------------------
  // OBJECTS
  // -------------------------------
  // Add model
  // Add character
  // Add item
  // Add object
  // Add box
  // Add sphere
  // Add cylinder
  // Add capsule
  // Add plane
  // Add clone
  // -------------------------------
  // EFFECTS
  // -------------------------------
  // Light intensity
  // Get light as
  // Add particle effect on object
  // Particle system
  // Set fog color
  // -------------------------------
  // CAMERA
  // -------------------------------
  // Get camera as
  // Camera follow object
  // Camera rotate
  // -------------------------------
  // XR
  // -------------------------------
  // Use camera as background
  // Set XR mode to
  // Export object as
}
