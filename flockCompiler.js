import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import { defineBlocks, initializeVariableIndexes } from './blocks/blocks.js';
import { defineBaseBlocks } from './blocks/base.js';
import { defineShapeBlocks } from './blocks/shapes.js';
import { defineSceneBlocks } from './blocks/scene.js';
import { defineModelBlocks } from './blocks/models.js';
import { defineEffectsBlocks } from './blocks/effects.js';
import { defineCameraBlocks } from './blocks/camera.js';
import { defineXRBlocks } from './blocks/xr.js';
import { defineEventsBlocks } from './blocks/events.js';
import { definePhysicsBlocks } from './blocks/physics.js';
import { defineConnectBlocks } from './blocks/connect.js';
import { defineCombineBlocks } from './blocks/combine.js';
import { defineTransformBlocks } from './blocks/transform.js';
import { defineControlBlocks } from './blocks/control.js';
import { defineConditionBlocks } from './blocks/condition.js';
import { defineAnimateBlocks } from './blocks/animate.js';
import { defineSoundBlocks } from './blocks/sound.js';
import { defineMaterialsBlocks } from './blocks/materials.js';
import { defineColourBlocks } from './blocks/colour.js';
import { defineSensingBlocks } from './blocks/sensing.js';
import { defineTextBlocks } from './blocks/text.js';
import { defineGenerators } from './generators/generators.js';

let registered = false;

function registerBlocksAndGenerators() {
  if (registered) return;
  registered = true;

  const steps = [
    defineBaseBlocks,
    defineBlocks,
    defineSceneBlocks,
    defineModelBlocks,
    defineShapeBlocks,
    defineEffectsBlocks,
    defineCameraBlocks,
    defineXRBlocks,
    defineEventsBlocks,
    definePhysicsBlocks,
    defineConnectBlocks,
    defineCombineBlocks,
    defineTransformBlocks,
    defineControlBlocks,
    defineConditionBlocks,
    defineAnimateBlocks,
    defineSoundBlocks,
    defineMaterialsBlocks,
    defineColourBlocks,
    defineSensingBlocks,
    defineTextBlocks,
    defineGenerators,
  ];

  for (const step of steps) {
    try {
      step();
    } catch (error) {
      if (!/already (registered|been registered|exists)/i.test(String(error && error.message))) {
        throw error;
      }
    }
  }
}

export function compileFlockProject(projectJson) {
  registerBlocksAndGenerators();

  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(projectJson, workspace);
    try {
      initializeVariableIndexes();
    } catch {
      /* not required for code generation */
    }
    return javascriptGenerator.workspaceToCode(workspace);
  } finally {
    workspace.dispose();
  }
}
