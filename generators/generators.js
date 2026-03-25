import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import "@blockly/block-plus-minus";
import {
  clearMeshMaps,
  meshMap,
  meshBlockIdMap,
  generateUniqueId,
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

  javascriptGenerator.forBlock["min_centre_max"] = function (block) {
    const pivotOption = block.getFieldValue("PIVOT_OPTION");

    // Return the string value as a quoted literal
    return [`"${pivotOption}"`, javascriptGenerator.ORDER_ATOMIC];
  };

  javascriptGenerator.forBlock["create_map"] = function (block) {
    const mapName = block.getFieldValue("MAP_NAME");
    const material =
      javascriptGenerator.valueToCode(
        block,
        "MATERIAL",
        javascriptGenerator.ORDER_NONE,
      ) || "null";
    const meshId = "ground";
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;
    return `createMap("${mapName}", ${material});\n`;
  };

  javascriptGenerator.forBlock["up"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const upForce = getFieldValue(block, "UP_FORCE", "1"); // Default up force

    return `up(${modelName}, ${upForce});\n`;
  };

  javascriptGenerator.forBlock["hold"] = function (block) {
    const meshToAttach = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_TO_ATTACH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const targetMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("TARGET_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const xOffset =
      javascriptGenerator.valueToCode(
        block,
        "X_OFFSET",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const yOffset =
      javascriptGenerator.valueToCode(
        block,
        "Y_OFFSET",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const zOffset =
      javascriptGenerator.valueToCode(
        block,
        "Z_OFFSET",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";

    // Establish the hold action with offset
    return `await hold(${meshToAttach}, ${targetMesh}, ${xOffset}, ${yOffset}, ${zOffset});
        `;
  };

  javascriptGenerator.forBlock["key_pressed"] = function (block) {
    const key = block.getFieldValue("KEY");
    return [`keyPressed("${key}")`, javascriptGenerator.ORDER_NONE];
  };

  javascriptGenerator.forBlock["random_seeded_int"] = function (block) {
    const value_from = getFieldValue(block, "FROM", 0);
    const value_to = getFieldValue(block, "TO", 10);
    const value_seed = getFieldValue(block, "SEED", 123456);

    const code = `seededRandom(${value_from}, ${value_to}, ${value_seed})`;

    return [code, javascriptGenerator.ORDER_NONE];
  };

  javascriptGenerator.forBlock["to_number"] = function (block) {
    const string = javascriptGenerator.valueToCode(
      block,
      "STRING",
      javascriptGenerator.ORDER_ATOMIC,
    );
    const conversionType = block.getFieldValue("TYPE");

    let code;
    if (conversionType === "INT") {
      code = `parseInt(${string})`;
    } else {
      code = `parseFloat(${string})`;
    }

    return [code, javascriptGenerator.ORDER_NONE];
  };

  javascriptGenerator.forBlock["procedures_defnoreturn"] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("NAME"),
      Blockly.PROCEDURE_CATEGORY_NAME,
    );
    const args = block.argData_.map((elem) =>
      javascriptGenerator.nameDB_.getName(
        elem.model.name,
        Blockly.Names.NameType.VARIABLE,
      ),
    );
    const params = args.join(", ");

    const branch =
      javascriptGenerator.statementToCode(
        block,
        "STACK",
        javascriptGenerator.ORDER_NONE,
      ) || "";

    const code = `async function ${functionName}(${params}) {\n${branch}\n}`;
    return code;
  };

  javascriptGenerator.forBlock["procedures_callnoreturn"] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("NAME"),
      Blockly.PROCEDURE_CATEGORY_NAME,
    );
    const args = [];
    const variables = block.arguments_;
    for (let i = 0; i < variables.length; i++) {
      args[i] =
        javascriptGenerator.valueToCode(
          block,
          "ARG" + i,
          javascriptGenerator.ORDER_NONE,
        ) || "null";
    }
    const code = `await ${functionName}(${args.join(", ")});\n`;
    return code;
  };

  javascriptGenerator.forBlock["procedures_defreturn"] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("NAME"),
      Blockly.PROCEDURE_CATEGORY_NAME,
    );
    const args = block.argData_.map((elem) =>
      javascriptGenerator.nameDB_.getName(
        elem.model.name,
        Blockly.Names.NameType.VARIABLE,
      ),
    );
    const params = args.join(", ");
    const branch =
      javascriptGenerator.statementToCode(
        block,
        "STACK",
        javascriptGenerator.ORDER_NONE,
      ) || "";
    const returnValue =
      javascriptGenerator.valueToCode(
        block,
        "RETURN",
        javascriptGenerator.ORDER_NONE,
      ) || "";

    const code = `async function ${functionName}(${params}) {\n${branch}return ${returnValue};\n}`;
    return code;
  };

  javascriptGenerator.forBlock["procedures_callreturn"] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("NAME"),
      Blockly.PROCEDURE_CATEGORY_NAME,
    );
    const args = [];
    const variables = block.arguments_ || [];
    for (let i = 0; i < variables.length; i++) {
      args[i] =
        javascriptGenerator.valueToCode(
          block,
          "ARG" + i,
          javascriptGenerator.ORDER_NONE,
        ) || "null";
    }

    const code = `await ${functionName}(${args.join(", ")})`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };

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

  javascriptGenerator.forBlock["play_rumble_pattern"] = function (block) {
    const pattern = block.getFieldValue("PATTERN");
    return `playRumblePattern("${pattern}");\n`;
  };

  javascriptGenerator.forBlock["controller_rumble"] = function (block) {
    const motor = block.getFieldValue("MOTOR");
    const strength =
      javascriptGenerator.valueToCode(
        block,
        "STRENGTH",
        javascriptGenerator.ORDER_NONE,
      ) || "1";
    const duration =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_NONE,
      ) || "500";

    return `controllerRumble("${motor}", ${strength}, ${duration});\n`;
  };

  javascriptGenerator.forBlock["controller_rumble_pattern"] = function (block) {
    const motor = block.getFieldValue("MOTOR");
    const strength =
      javascriptGenerator.valueToCode(
        block,
        "STRENGTH",
        javascriptGenerator.ORDER_NONE,
      ) || "1";
    const onDuration =
      javascriptGenerator.valueToCode(
        block,
        "ON_DURATION",
        javascriptGenerator.ORDER_NONE,
      ) || "200";
    const offDuration =
      javascriptGenerator.valueToCode(
        block,
        "OFF_DURATION",
        javascriptGenerator.ORDER_NONE,
      ) || "100";
    const repeats =
      javascriptGenerator.valueToCode(
        block,
        "REPEATS",
        javascriptGenerator.ORDER_NONE,
      ) || "3";

    return `controllerRumblePattern("${motor}", ${strength}, ${onDuration}, ${offDuration}, ${repeats});\n`;
  };

  javascriptGenerator.forBlock["camera_control"] = function (block) {
    const key = block.getFieldValue("KEY");
    const action = block.getFieldValue("ACTION");

    return `cameraControl(${JSON.stringify(key)}, "${action}");\n`;
  };

  javascriptGenerator.forBlock["keyword_block"] = function (block) {
    // Since this block is replaced with another block, we return an empty string.
    return "";
  };

  /* DEPRECATED? 
  javascriptGenerator.forBlock["load_object2"] = function (block) {
    const modelName = block.getFieldValue("MODELS");
    const scale = getFieldValue(block, "SCALE", "1");
    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");
    const color = getFieldValue(block, "COLOR", '"#000000"');

    const { generatedName: variableName, userVariableName } = getVariableInfo(
      block,
      "ID_VAR",
    );

    //const meshId = modelName + "_" + generateUniqueId();
    const meshId = `${userVariableName}__${block.id}`;
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;
    // Generate the code for the "do" part (if present)
    let doCode = "";

    if (block.getInput("DO")) {
      doCode = javascriptGenerator.statementToCode(block, "DO") || "";
    }

    doCode = doCode ? `async function() {\n${doCode}\n}` : "";

    return `${variableName} = createObject({
                        modelName: '${modelName}',
                        modelId: '${meshId}',
                        color: ${color},
                        scale: ${scale},
                        position: { x: ${x}, y: ${y}, z: ${z} }${doCode ? `,\ncallback: ${doCode}` : ""}
                });\n`;
  };

  
  
  javascriptGenerator.forBlock["create_ground"] = function (block) {
    const meshId = "ground";
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;
    let color =
      javascriptGenerator.valueToCode(
        block,
        "COLOR",
        javascriptGenerator.ORDER_NONE,
      ) || '"#71BC78"';

    const colorBlock = block.getInputTargetBlock("COLOR");

    if (colorBlock && colorBlock.type === "material") {
      // Material blocks already generate a material object; pass it directly to
      // createGround so the material can be applied instead of trying to access
      // a colour property.
      color = javascriptGenerator.valueToCode(
        block,
        "COLOR",
        javascriptGenerator.ORDER_FUNCTION_CALL,
      );
    }

    return `createGround(${color}, "${meshId}");\n`;
  };

  javascriptGenerator.forBlock["create_wall"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#9932CC"');
    const startX = getFieldValue(block, "START_X", "0");
    const startZ = getFieldValue(block, "START_Z", "0");
    const endX = getFieldValue(block, "END_X", "1");
    const endZ = getFieldValue(block, "END_Z", "0");
    const yPosition = getFieldValue(block, "Y_POSITION", "0");
    const wallType = block.getFieldValue("WALL_TYPE");

    let variableName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const wallId = `wall_${generateUniqueId()}`;
    meshMap[wallId] = block;
    meshBlockIdMap[wallId] = block.id;
    // Directly passing all parameters to the helper function
    return `${variableName} = newWall(${color}, ${startX}, ${startZ}, ${endX}, ${endZ}, ${yPosition}, "${wallType}", "${wallId}");\n`;
  };

  javascriptGenerator.forBlock["create_custom_map"] = function (block) {
    const colors = [];
    for (let i = 1; i <= 25; i++) {
      const color =
        javascriptGenerator.valueToCode(
          block,
          `COLOR_${i}`,
          javascriptGenerator.ORDER_ATOMIC,
        ) || "#808080";
      colors.push(color);
    }
    return `await createCustomMap([${colors.join(", ")}]);\n`;
  };

  javascriptGenerator.forBlock["start2"] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, "DO");
    return `start(async function() {\n${branch}});\n`;
  };

  javascriptGenerator.forBlock["logic_placeholder"] = function (block) {
    return "";
  };

  javascriptGenerator.forBlock["when_touches"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
      true,
    );

    const otherModelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("OTHER_MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
      true,
    );

    const trigger = block.getFieldValue("TRIGGER");
    const doCode = javascriptGenerator.statementToCode(block, "DO");

    if (
      trigger === "OnIntersectionEnterTrigger" ||
      trigger === "OnIntersectionExitTrigger"
    ) {
      return `onIntersect(${modelName}, ${otherModelName}, {
          trigger: "${trigger}",
          callback: async function(${modelName}, ${otherModelName}) {
        ${doCode}
          }
        });\n`;
    } else {
      console.error("Invalid trigger type for 'when_touches' block:", trigger);
      return "";
    }
  };
  
  javascriptGenerator.forBlock["glide_to"] = function (block) {
    const meshVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const x =
      javascriptGenerator.valueToCode(
        block,
        "X",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const y =
      javascriptGenerator.valueToCode(
        block,
        "Y",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const z =
      javascriptGenerator.valueToCode(
        block,
        "Z",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const duration =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1000";
    const mode = block.getFieldValue("MODE");
    const reverse = block.getFieldValue("REVERSE") === "TRUE";
    const loop = block.getFieldValue("LOOP") === "TRUE";
    const easing = block.getFieldValue("EASING");

    const code = `${mode === "AWAIT" ? "await " : ""}glideTo(${meshVar}, { x: ${x}, y: ${y}, z: ${z}, duration: ${duration} / 1000, reverse: ${reverse}, loop: ${loop}, easing: "${easing}" });\n`;

    return code;
  };

    javascriptGenerator.forBlock["rotate_anim"] = function (block) {
      const meshName = javascriptGenerator.nameDB_.getName(
        block.getFieldValue("MESH_VAR"),
        Blockly.Names.NameType.VARIABLE,
      );
      const rotX = getFieldValue(block, "ROT_X", "0");
      const rotY = getFieldValue(block, "ROT_Y", "0");
      const rotZ = getFieldValue(block, "ROT_Z", "0");
      const duration = getFieldValue(block, "DURATION", "0");
      const mode = block.getFieldValue("MODE");
      const reverse = block.getFieldValue("REVERSE") === "TRUE";
      const loop = block.getFieldValue("LOOP") === "TRUE";
      const easing = block.getFieldValue("EASING");
  
      const asyncWrapper = mode === "AWAIT" ? "await " : "";
  
      return `${asyncWrapper}rotateAnim(${meshName}, { x: ${rotX}, y: ${rotY}, z: ${rotZ}, duration: ${duration}, reverse: ${reverse}, loop: ${loop}, easing: "${easing}" });\n`;
    };

  javascriptGenerator.forBlock["controls_doWhile"] = function (block) {
    const condition =
      javascriptGenerator.valueToCode(
        block,
        "BOOL",
        javascriptGenerator.ORDER_NONE,
      ) || "false";
    const branch = javascriptGenerator.statementToCode(block, "DO");

    return `
          do {
                  ${branch}

                  await wait(0);
          } while (${condition});\n`;
  };

  javascriptGenerator.forBlock["for_loop"] = function (block, generator) {
    const variable0 = generator.getVariableName(block.getFieldValue("VAR"));

    const argument0 =
      generator.valueToCode(block, "FROM", generator.ORDER_ASSIGNMENT) || "0";
    const argument1 =
      generator.valueToCode(block, "TO", generator.ORDER_ASSIGNMENT) || "0";
    const increment =
      generator.valueToCode(block, "BY", generator.ORDER_ASSIGNMENT) || "1";

    const branch = generator.statementToCode(block, "DO");

    // Timing and iteration counter variables
    const timingVar = generator.nameDB_.getDistinctName(
      `${variable0}_timing`,
      Blockly.Names.DEVELOPER_VARIABLE_TYPE,
    );

    const counterVar = generator.nameDB_.getDistinctName(
      `${variable0}_counter`,
      Blockly.Names.DEVELOPER_VARIABLE_TYPE,
    );

    return `
                  let ${timingVar} = performance.now();
                  let ${counterVar} = 0;
                  for (let ${variable0} = ${argument0}; (${increment} > 0 ? ${variable0} <= ${argument1} : ${variable0} >= ${argument1}); ${variable0} += ${increment}) {
                          ${branch}
                          ${counterVar}++;
                          if (${counterVar} % 10 === 0 && performance.now() - ${timingVar} > 16) {
                                  await new Promise(resolve => requestAnimationFrame(resolve));
                                  ${timingVar} = performance.now();
                          }
                  }
          `;
  };

  javascriptGenerator.forBlock["when_key_event"] = function (block) {
    const key = block.getFieldValue("KEY");
    const event = block.getFieldValue("EVENT"); // "starts" or "ends"
    const statements_do = javascriptGenerator.statementToCode(block, "DO");

    // Pass "true" if event is "ends" for the whenKeyPressed helper function
    return `whenKeyEvent("${key}", async () => {${statements_do}}, ${event === "ends"});\n`;
  };

  javascriptGenerator.forBlock["change_material"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const material = block.getFieldValue("MATERIALS");
    const color = getFieldValue(block, "COLOR", '"#ffffff"');

    return `await changeMaterial(${modelName}, "${material}", ${color});\n`;
  };

  javascriptGenerator.forBlock["greyscale_colour"] = function (block) {
    const colour = block.getFieldValue("COLOR");
    const code = `"${colour}"`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };

  javascriptGenerator.forBlock["colour_from_string2"] = function (block) {
    const color =
      javascriptGenerator.valueToCode(
        block,
        "COLOR",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "''";

    const code = `${color}`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };

  javascriptGenerator.forBlock["set_scene_bpm"] = function (block) {
    const bpm = javascriptGenerator.valueToCode(
      block,
      "BPM",
      javascriptGenerator.ORDER_ATOMIC,
    );
    return `setBPM("__everywhere__", ${bpm});\n`;
  };

  javascriptGenerator.forBlock["set_mesh_bpm"] = function (block) {
    const meshNameField = block.getFieldValue("MESH") || "__everywhere__";
    const meshName = `"${meshNameField}"`; // Always quoted

    const bpm =
      javascriptGenerator.valueToCode(
        block,
        "BPM",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "120"; // Default BPM if not connected

    return `await setBPM(${meshName}, ${bpm});\n`;
  };

  */
}

javascriptGenerator.forBlock["get_lexical_variable"] = function (block) {
  const variableName = block.getFieldValue("VAR");
  const code = variableName;
  return [code, javascriptGenerator.ORDER_ATOMIC];
};

javascriptGenerator.forBlock["xyz"] = function (block) {
  const x =
    javascriptGenerator.valueToCode(
      block,
      "X",
      javascriptGenerator.ORDER_ATOMIC,
    ) || "0";
  const y =
    javascriptGenerator.valueToCode(
      block,
      "Y",
      javascriptGenerator.ORDER_ATOMIC,
    ) || "0";
  const z =
    javascriptGenerator.valueToCode(
      block,
      "Z",
      javascriptGenerator.ORDER_ATOMIC,
    ) || "0";

  // Generate a tuple representing the vector
  const code = `[${x}, ${y}, ${z}]`;
  return [code, javascriptGenerator.ORDER_ATOMIC];
};

javascriptGenerator.forBlock["math_random_int"] = function (block) {
  const from =
    javascriptGenerator.valueToCode(
      block,
      "FROM",
      javascriptGenerator.ORDER_NONE,
    ) || "0";
  const to =
    javascriptGenerator.valueToCode(
      block,
      "TO",
      javascriptGenerator.ORDER_NONE,
    ) || "0";
  const code = "randomInteger(" + from + ", " + to + ")";
  return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
};

javascriptGenerator.forBlock["lists_getIndex"] = function (block) {
  const mode = block.getFieldValue("MODE") || "GET";
  const where = block.getFieldValue("WHERE") || "FROM_START";
  const listOrder =
    where === "RANDOM"
      ? javascriptGenerator.ORDER_NONE
      : javascriptGenerator.ORDER_MEMBER;
  const list =
    javascriptGenerator.valueToCode(block, "VALUE", listOrder) || "[]";

  switch (where) {
    case "FIRST":
      if (mode === "GET") {
        return [`${list}[0]`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "GET_REMOVE") {
        return [`${list}.shift()`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "REMOVE") {
        return `${list}.shift();\n`;
      }
      break;

    case "LAST":
      if (mode === "GET") {
        return [`${list}.slice(-1)[0]`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "GET_REMOVE") {
        return [`${list}.pop()`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "REMOVE") {
        return `${list}.pop();\n`;
      }
      break;

    case "FROM_START": {
      const at = javascriptGenerator.getAdjusted(block, "AT");
      if (mode === "GET") {
        return [`${list}[${at}]`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "GET_REMOVE") {
        return [
          `${list}.splice(${at}, 1)[0]`,
          javascriptGenerator.ORDER_FUNCTION_CALL,
        ];
      }
      if (mode === "REMOVE") {
        return `${list}.splice(${at}, 1);\n`;
      }
      break;
    }

    case "FROM_END": {
      const at = javascriptGenerator.getAdjusted(block, "AT", 1, true);
      if (mode === "GET") {
        return [
          `${list}.slice(${at})[0]`,
          javascriptGenerator.ORDER_FUNCTION_CALL,
        ];
      }
      if (mode === "GET_REMOVE") {
        return [
          `${list}.splice(${at}, 1)[0]`,
          javascriptGenerator.ORDER_FUNCTION_CALL,
        ];
      }
      if (mode === "REMOVE") {
        return `${list}.splice(${at}, 1);\n`;
      }
      break;
    }

    case "RANDOM": {
      const functionName = javascriptGenerator.provideFunction_(
        "listsGetRandomItem",
        `
function ${javascriptGenerator.FUNCTION_NAME_PLACEHOLDER_}(list, remove) {
  var x = randomInteger(0, list.length - 1);
  if (remove) {
    return list.splice(x, 1)[0];
  } else {
    return list[x];
  }
}
`,
      );
      const code = `${functionName}(${list}, ${mode !== "GET"})`;
      if (mode === "GET" || mode === "GET_REMOVE") {
        return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
      }
      if (mode === "REMOVE") {
        return `${code};\n`;
      }
      break;
    }
  }

  throw Error("Unhandled combination (lists_getIndex).");
};

javascriptGenerator.forBlock["lists_setIndex"] = function (block) {
  function cacheList() {
    if (list.match(/^\w+$/)) {
      return "";
    }

    const listVar = javascriptGenerator.nameDB_.getDistinctName(
      "tmpList",
      Blockly.Names.NameType.VARIABLE,
    );
    const listAssignment = `var ${listVar} = ${list};\n`;
    list = listVar;
    return listAssignment;
  }

  let list =
    javascriptGenerator.valueToCode(
      block,
      "LIST",
      javascriptGenerator.ORDER_MEMBER,
    ) || "[]";
  const mode = block.getFieldValue("MODE") || "GET";
  let where = block.getFieldValue("WHERE") || "FROM_START";
  const value =
    javascriptGenerator.valueToCode(
      block,
      "TO",
      javascriptGenerator.ORDER_ASSIGNMENT,
    ) || "null";

  switch (where) {
    case "FIRST":
      if (mode === "SET") {
        return `${list}[0] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return `${list}.unshift(${value});\n`;
      }
      break;

    case "LAST":
      if (mode === "SET") {
        return cacheList() + `${list}[${list}.length - 1] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return `${list}.push(${value});\n`;
      }
      break;

    case "FROM_START": {
      const index = javascriptGenerator.getAdjusted(block, "AT");
      if (mode === "SET") {
        return `${list}[${index}] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return `${list}.splice(${index}, 0, ${value});\n`;
      }
      break;
    }

    case "FROM_END": {
      const index = javascriptGenerator.getAdjusted(
        block,
        "AT",
        1,
        false,
        javascriptGenerator.ORDER_SUBTRACTION,
      );
      const listCache = cacheList();
      if (mode === "SET") {
        return listCache + `${list}[${list}.length - ${index}] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return (
          listCache +
          `${list}.splice(${list}.length - ${index}, 0, ${value});\n`
        );
      }
      break;
    }

    case "RANDOM": {
      let code = cacheList();
      const xVar = javascriptGenerator.nameDB_.getDistinctName(
        "tmpX",
        Blockly.Names.NameType.VARIABLE,
      );
      code += `var ${xVar} = randomInteger(0, ${list}.length - 1);\n`;
      if (mode === "SET") {
        return code + `${list}[${xVar}] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return code + `${list}.splice(${xVar}, 0, ${value});\n`;
      }
      break;
    }
  }

  throw Error("Unhandled combination (lists_setIndex).");
};

javascriptGenerator.forBlock["lists_add_item"] = function (block) {
  const listName = javascriptGenerator.nameDB_.getName(
    block.getFieldValue("LIST"),
    Blockly.Names.NameType.VARIABLE,
  );
  const value =
    javascriptGenerator.valueToCode(
      block,
      "TO",
      javascriptGenerator.ORDER_ASSIGNMENT,
    ) || '""';

  return `if (!Array.isArray(${listName})) {\n  ${listName} = [];\n}\n${listName}.push(${value});\n`;
};

javascriptGenerator.forBlock["lists_delete_nth"] = function (block) {
  const listName = javascriptGenerator.nameDB_.getName(
    block.getFieldValue("LIST"),
    Blockly.Names.NameType.VARIABLE,
  );
  const index =
    javascriptGenerator.valueToCode(
      block,
      "INDEX",
      javascriptGenerator.ORDER_NONE,
    ) || "0";

  return `if (Array.isArray(${listName})) {
  ${listName}.splice(${index}, 1);
}
`;
};

javascriptGenerator.forBlock["keyword"] = function (block) {
  return "";
};

javascriptGenerator.forBlock["animate_property"] = function (block) {
  const meshName = javascriptGenerator.nameDB_.getName(
    block.getFieldValue("MESH_VAR"),
    Blockly.Names.NameType.VARIABLE,
  );
  const property = block.getFieldValue("PROPERTY");
  const targetValue = getFieldValue(block, "TARGET_VALUE", "0.5");
  const duration = getFieldValue(block, "DURATION", "1");
  const mode = block.getFieldValue("MODE");
  const reverse = block.getFieldValue("REVERSE") === "TRUE";
  const loop = block.getFieldValue("LOOP") === "TRUE";

  const asyncWrapper = mode === "AWAIT" ? "await " : "";

  return `${asyncWrapper}animateProperty(${meshName}, { property: "${property}", targetValue: ${targetValue}, duration: ${duration}, reverse: ${reverse}, loop: ${loop}, mode: "${mode}" });\n`;
};
