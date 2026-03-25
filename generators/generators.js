import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import "@blockly/block-plus-minus";
import {
  clearMeshMaps,
  meshMap,
  meshBlockIdMap,
  generateUniqueId, // Remove if you agree that create_wall is deprecated
} from "./mesh-state.js";
import { getFieldValue } from "./generators-utilities.js";

// Import the generator registration functions for different categories of blocks
import { registerSceneGenerators } from "./generators-scene.js";
import { registerEventsGenerators } from "./generators-events.js";
import { registerTransformGenerators } from "./generators-transform.js";
import { registerAnimateGenerators } from "./generators-animate.js";
import { registerControlGenerators } from "./generators-control.js";
import { registerConditionGenerators } from "./generators-condition.js";
import { registerSensingGenerators } from "./generators-sensing.js";
import { registerTextGenerators } from "./generators-text.js";
import { registerMaterialGenerators } from "./generators-material.js";
import { registerSoundGenerators } from "./generators-sound.js";
import { registerDataGenerators } from "./generators-data.js";
import { registerMathGenerators } from "./generators-math.js";
import { registerFunctionsGenerators } from "./generators-functions.js";

// Used outside of this file
export * from "./mesh-state.js";

// Set up all generators from external files
export function defineGenerators() {
  // Allow Flock users to use "name" as a variable name
  const reservedWordsWithoutName = javascriptGenerator.RESERVED_WORDS_.split(
    ",",
  )
    .map((word) => word.trim())
    .filter((word) => word && word !== "name")
    .join(",");

  // Force re-initialization of animation generators
  delete javascriptGenerator.forBlock["play_animation"];
  delete javascriptGenerator.forBlock["switch_animation"];

  // Register generators for each category of blocks
  registerSceneGenerators(javascriptGenerator);
  registerEventsGenerators(javascriptGenerator);
  registerTransformGenerators(javascriptGenerator);
  registerAnimateGenerators(javascriptGenerator);
  registerControlGenerators(javascriptGenerator);
  registerConditionGenerators(javascriptGenerator);
  registerSensingGenerators(javascriptGenerator);
  registerTextGenerators(javascriptGenerator);
  registerMaterialGenerators(javascriptGenerator);
  registerSoundGenerators(javascriptGenerator);
  registerDataGenerators(javascriptGenerator);
  registerMathGenerators(javascriptGenerator);
  registerFunctionsGenerators(javascriptGenerator);

  // Initialise
  javascriptGenerator.init = function (workspace) {
    clearMeshMaps();
    if (!javascriptGenerator.nameDB_) {
      javascriptGenerator.nameDB_ = new Blockly.Names(reservedWordsWithoutName);
    } else {
      javascriptGenerator.nameDB_.reset();
    }
    javascriptGenerator.nameDB_.setVariableMap(workspace.getVariableMap());
    javascriptGenerator.nameDB_.populateVariables(workspace);
    javascriptGenerator.nameDB_.populateProcedures(workspace);

    const defvars = [];
    const userVariableDefaults = new Map();
    // Add developer variables (not created or named by the user).
    const devVarList = Blockly.Variables.allDeveloperVariables(workspace);
    for (let i = 0; i < devVarList.length; i++) {
      defvars.push(
        javascriptGenerator.nameDB_.getName(
          devVarList[i],
          Blockly.Names.NameType.DEVELOPER_VARIABLE,
        ),
      );
    }

    // Add user variables, but only ones that are being used.
    const variables = Blockly.Variables.allUsedVarModels(workspace);
    for (let i = 0; i < variables.length; i++) {
      const variableModel = variables[i];
      const generatedName = javascriptGenerator.nameDB_.getName(
        variableModel.getId(),
        Blockly.Names.NameType.VARIABLE,
      );
      defvars.push(generatedName);
      userVariableDefaults.set(generatedName, variableModel.name);
    }

    // Declare all of the variables.
    if (defvars.length) {
      let defvarsmesh = defvars.map(function (name) {
        const initialValue = userVariableDefaults.has(name)
          ? userVariableDefaults.get(name)
          : name;
        return `let ${name} = ${JSON.stringify(initialValue)};`;
      });
      javascriptGenerator.definitions_["variables"] =
        `// Made with Flock XR\n` + defvarsmesh.join(" ") + "\n";
    }

    javascriptGenerator.isInitialized = true;
  };
}
