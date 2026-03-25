import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap, generateUniqueId } from "./mesh-state.js";
import {
  getFieldValue,
  getVariableInfo,
  getPositionTuple,
  createMesh,
} from "./generators-utilities.js";

export function registerSceneGenerators(javascriptGenerator) {
  // -------------------------------
  // SCENE
  // -------------------------------

  // Sky -------------------------------------------------------------
  javascriptGenerator.forBlock["set_sky_color"] = function (block) {
    const meshId = "sky";
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;
    let color =
      javascriptGenerator.valueToCode(
        block,
        "COLOR",
        javascriptGenerator.ORDER_NONE,
      ) || '"#6495ED"';

    return `setSky(${color});\n`;
  };
  // Map with material ------------------------------------------------

  // Background -------------------------------------------------------
  javascriptGenerator.forBlock["set_background_color"] = function (block) {
    // Defaults to a quoted hex string (e.g., "#6495ED")
    let color = getFieldValue(block, "COLOR", '"#6495ED"');

    const colorInput = block.getInput("COLOR");
    const colorBlock = colorInput?.connection?.targetBlock();

    if (colorBlock && colorBlock.type === "material") {
      color = `(function(m){
                const c = (m && (m.color || m.diffuseColor || m.albedoColor));
                return (c && c.toHexString) ? c.toHexString() : "#6495ED";
              })(${color})`;
    }

    const meshId = "sky";
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;

    // Background block should always request clear-color behaviour
    return `setSky(${color}, { clear: true });\n`;
  };

  // Show object ------------------------------------------------------
  javascriptGenerator.forBlock["show"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return `await show(${modelName});\n`;
  };

  // Hide object ------------------------------------------------------

  javascriptGenerator.forBlock["hide"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return `await hide(${modelName});\n`;
  };

  // Dispose object ---------------------------------------------------
  javascriptGenerator.forBlock["dispose"] = function (block) {
    // Get the selected variable name
    const meshVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    // Generate code to call the dispose helper for the selected mesh
    const code = `dispose(${meshVar});\n`;
    return code;
  };

  // -------------------------------
  // OBJECTS
  // -------------------------------

  // Add model --------------------------------------------------------
  javascriptGenerator.forBlock["load_model"] = function (block) {
    const modelName = block.getFieldValue("MODELS");
    const scale = getFieldValue(block, "SCALE", "1");
    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");
    const { generatedName: variableName, userVariableName } = getVariableInfo(
      block,
      "ID_VAR",
    );

    const meshId = `${userVariableName}__${block.id}`;
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;

    let doCode = "";
    if (block.getInput("DO")) {
      doCode = javascriptGenerator.statementToCode(block, "DO") || "";
    }
    doCode = doCode ? `async function() {\n${doCode}\n}` : "";

    return `${variableName} = createModel({
                        modelName: '${modelName}',
                        modelId: '${meshId}',
                        scale: ${scale},
                        position: { x: ${x}, y: ${y}, z: ${z} }${doCode ? `,\ncallback: ${doCode}` : ""}
                });\n`;
  };

  // Add character ----------------------------------------------------
  javascriptGenerator.forBlock["load_character"] = function (block) {
    const modelName = block.getFieldValue("MODELS");
    const scale = getFieldValue(block, "SCALE", "1");
    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");
    const hairColor = getFieldValue(block, "HAIR_COLOR", "#000000");
    const skinColor = getFieldValue(block, "SKIN_COLOR", "#FFE0BD");
    const eyesColor = getFieldValue(block, "EYES_COLOR", "#0000FF");
    const sleevesColor = getFieldValue(block, "SLEEVES_COLOR", "#FFFFFF");
    const shortsColor = getFieldValue(block, "SHORTS_COLOR", "#000000");
    const tshirtColor = getFieldValue(block, "TSHIRT_COLOR", "#FF0000");
    const { generatedName: variableName, userVariableName } = getVariableInfo(
      block,
      "ID_VAR",
    );

    const meshId = `${userVariableName}__${block.id}`;
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;
    // Generate the code for the "do" part (if present)
    let doCode = "";

    if (block.getInput("DO")) {
      doCode = javascriptGenerator.statementToCode(block, "DO") || "";
    }

    doCode = doCode ? `async function() {\n${doCode}\n}` : "";

    return `${variableName} = createCharacter({
                  modelName: '${modelName}',
                  modelId: '${meshId}',
                  scale: ${scale},
                  position: { x: ${x}, y: ${y}, z: ${z} },
                  colors: {
                        hair: ${hairColor},
                        skin: ${skinColor},
                        eyes: ${eyesColor},
                        sleeves: ${sleevesColor},
                        shorts: ${shortsColor},
                        tshirt: ${tshirtColor}
                  }${doCode ? `, callback: ${doCode}` : ""}
                });\n`;
  };

  // Add item ---------------------------------------------------------
  javascriptGenerator.forBlock["load_object"] = function (block) {
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

    const meshId = `${userVariableName}__${block.id}`;
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;
    //```text
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
  // Add object -------------------------------------------------------
  javascriptGenerator.forBlock["load_multi_object"] = function (block) {
    const modelName = block.getFieldValue("MODELS");
    const scale = getFieldValue(block, "SCALE", "1");
    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");
    const color = getFieldValue(block, "COLORS", "#000000");

    const { generatedName: variableName, userVariableName } = getVariableInfo(
      block,
      "ID_VAR",
    );

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

  // Add box ---------------------------------------------------------
  javascriptGenerator.forBlock["create_box"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#9932CC"');
    const width = getFieldValue(block, "WIDTH", "1");
    const height = getFieldValue(block, "HEIGHT", "1");
    const depth = getFieldValue(block, "DEPTH", "1");

    const positionSource = getPositionTuple(block);

    const params = [
      `color: ${color}`,
      `width: ${width}`,
      `height: ${height}`,
      `depth: ${depth}`,
      `position: ${positionSource}`,
    ];

    return createMesh(block, "Box", params, "box");
  };

  // Add sphere ---------------------------------------------------------
  javascriptGenerator.forBlock["create_sphere"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#9932CC"');
    const diameterX = getFieldValue(block, "DIAMETER_X", "1");
    const diameterY = getFieldValue(block, "DIAMETER_Y", "1");
    const diameterZ = getFieldValue(block, "DIAMETER_Z", "1");

    const positionSource = getPositionTuple(block);

    const params = [
      `color: ${color}`,
      `diameterX: ${diameterX}`,
      `diameterY: ${diameterY}`,
      `diameterZ: ${diameterZ}`,
      `position: ${positionSource}`,
    ];

    return createMesh(block, "Sphere", params, "sphere");
  };

  // Add cylinder -------------------------------------------------------
  javascriptGenerator.forBlock["create_cylinder"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#9932CC"');
    const height = getFieldValue(block, "HEIGHT", "2");
    const diameterTop = getFieldValue(block, "DIAMETER_TOP", "1");
    const diameterBottom = getFieldValue(block, "DIAMETER_BOTTOM", "1");
    const tessellations = getFieldValue(block, "TESSELLATIONS", "12");

    const positionSource = getPositionTuple(block);

    const params = [
      `color: ${color}`,
      `height: ${height}`,
      `diameterTop: ${diameterTop}`,
      `diameterBottom: ${diameterBottom}`,
      `tessellation: ${tessellations}`,
      `position: ${positionSource}`,
    ];

    return createMesh(block, "Cylinder", params, "cylinder");
  };

  // Add capsule --------------------------------------------------------
  javascriptGenerator.forBlock["create_capsule"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#9932CC"');
    const diameter = getFieldValue(block, "DIAMETER", "1");
    const height = getFieldValue(block, "HEIGHT", "2");

    const positionSource = getPositionTuple(block);

    const params = [
      `color: ${color}`,
      `diameter: ${diameter}`,
      `height: ${height}`,
      `position: ${positionSource}`,
    ];

    return createMesh(block, "Capsule", params, "capsule");
  };

  // Add plane ----------------------------------------------------------
  javascriptGenerator.forBlock["create_plane"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#9932CC"');
    const width = getFieldValue(block, "WIDTH", "1");
    const height = getFieldValue(block, "HEIGHT", "1");

    const positionSource = getPositionTuple(block);

    const params = [
      `color: ${color}`,
      `width: ${width}`,
      `height: ${height}`,
      `position: ${positionSource}`,
    ];

    return createMesh(block, "Plane", params, "plane");
  };

  // Add clone ----------------------------------------------------------
  javascriptGenerator.forBlock["clone_mesh"] = function (block) {
    // Get the source mesh variable
    const sourceMeshName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("SOURCE_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    // Get the target clone variable
    const cloneVariableName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("CLONE_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    // Generate a unique ID for the clone
    const cloneId = sourceMeshName + "_" + generateUniqueId();
    meshMap[cloneId] = block;
    meshBlockIdMap[cloneId] = block.id;

    // Generate the code for the "do" part (if present)
    let doCode = "";
    if (block.getInput("DO")) {
      doCode = javascriptGenerator.statementToCode(block, "DO") || "";
    }

    // Wrap "DO" code in an async function if it exists
    doCode = doCode ? `async function() {\n${doCode}\n}` : "";

    // Return the code to clone the mesh
    return `${cloneVariableName} = cloneMesh({
                          sourceMeshName: ${sourceMeshName},
                          cloneId: '${cloneId}'${doCode ? `,\ncallback: ${doCode}` : ""}
                  });\n`;
  };
  // -------------------------------
  // EFFECTS
  // -------------------------------
  // Light intensity -------------------------------------------------
  javascriptGenerator.forBlock["main_light"] = function (block) {
    const intensity =
      javascriptGenerator.valueToCode(
        block,
        "INTENSITY",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1.0";
    const diffuse =
      javascriptGenerator.valueToCode(
        block,
        "DIFFUSE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "#FFFFFF";
    const groundColor =
      javascriptGenerator.valueToCode(
        block,
        "GROUND_COLOR",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "#808080";

    return `lightIntensity(${intensity});\nlightColor(${diffuse}, ${groundColor});\n`;
  };

  // Get light as --------------------------------------------------
  javascriptGenerator.forBlock["get_light"] = function (block) {
    const variableName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return `${variableName} = getMainLight();\n`;
  };

  // Add particle effect on object ----------------------------------
  javascriptGenerator.forBlock["create_particle_effect"] = function (block) {
    const emitRate = parseFloat(
      javascriptGenerator.valueToCode(
        block,
        "RATE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "10",
    );
    const startColor =
      javascriptGenerator.valueToCode(
        block,
        "START_COLOR",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '"#FFFFFF"';
    const endColor =
      javascriptGenerator.valueToCode(
        block,
        "END_COLOR",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '"#000000"';
    const startAlpha = parseFloat(
      javascriptGenerator.valueToCode(
        block,
        "START_ALPHA",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1.0",
    );
    const endAlpha = parseFloat(
      javascriptGenerator.valueToCode(
        block,
        "END_ALPHA",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1.0",
    );
    const minSize =
      javascriptGenerator.valueToCode(
        block,
        "MIN_SIZE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.1";
    const maxSize =
      javascriptGenerator.valueToCode(
        block,
        "MAX_SIZE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1.0";
    const minLifetime =
      javascriptGenerator.valueToCode(
        block,
        "MIN_LIFETIME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1.0";
    const maxLifetime =
      javascriptGenerator.valueToCode(
        block,
        "MAX_LIFETIME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "5.0";
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
    const minAngularSpeed =
      javascriptGenerator.valueToCode(
        block,
        "MIN_ANGULAR_SPEED",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 0;
    const maxAngularSpeed =
      javascriptGenerator.valueToCode(
        block,
        "MAX_ANGULAR_SPEED",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 0;
    const minInitialRotation =
      javascriptGenerator.valueToCode(
        block,
        "MIN_INITIAL_ROTATION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 0;
    const maxInitialRotation =
      javascriptGenerator.valueToCode(
        block,
        "MAX_INITIAL_ROTATION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 0;

    const variableName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const emitterMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("EMITTER_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    const shape = block.getFieldValue("SHAPE");
    const gravity = block.getFieldValue("GRAVITY") === "TRUE";

    const options = `
            {
                  emitterMesh: ${emitterMesh},
                  emitRate: ${emitRate},
                  colors: {
                    start: ${startColor},
                    end: ${endColor}
                  },
                  alphas: {
                    start: ${startAlpha},
                    end: ${endAlpha}
                  },
                  sizes: {
                    start: ${minSize},
                    end: ${maxSize}
                  },
                  lifetime: {
                    min: ${minLifetime},
                    max: ${maxLifetime}
                  },
                  shape: "${shape}",
                  gravity: ${gravity},
                  direction: { x: ${x}, y: ${y}, z: ${z} },
                  rotation: {
                    angularSpeed: {
                          min: ${minAngularSpeed},
                          max: ${maxAngularSpeed}
                    },
                    initialRotation: {
                          min: ${minInitialRotation},
                          max: ${maxInitialRotation}
                    }
                  }
            }`;

    return `${variableName} = createParticleEffect("${variableName}", ${options.trim()});\n`;
  };

  // Particle system ------------------------------------------------
  javascriptGenerator.forBlock["control_particle_system"] = function (block) {
    const systemName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("SYSTEM_NAME"),
      Blockly.Names.NameType.VARIABLE,
    );
    const action = block.getFieldValue("ACTION");

    return `${action}ParticleSystem(${systemName});\n`;
  };

  // Set fog color --------------------------------------------------
  javascriptGenerator.forBlock["set_fog"] = function (block) {
    const fogColorHex = getFieldValue(block, "FOG_COLOR", "#9932CC");
    const fogMode = block.getFieldValue("FOG_MODE");
    const fogDensity =
      javascriptGenerator.valueToCode(
        block,
        "DENSITY",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.1"; // Default density
    const fogStart =
      javascriptGenerator.valueToCode(
        block,
        "START",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "50"; // Default start
    const fogEnd =
      javascriptGenerator.valueToCode(
        block,
        "END",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "100"; // Default end

    return `setFog({ fogColorHex: ${fogColorHex}, fogMode: "${fogMode}", fogDensity: ${fogDensity}, fogStart: ${fogStart}, fogEnd: ${fogEnd} });\n`;
  };

  // -------------------------------
  // CAMERA
  // -------------------------------
  // Get camera as --------------------------------------------------
  javascriptGenerator.forBlock["get_camera"] = function (block) {
    const variableName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return `${variableName} = getCamera();\n`;
  };

  // Camera follow object -------------------------------------------
  javascriptGenerator.forBlock["camera_follow"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const radius =
      javascriptGenerator.valueToCode(
        block,
        "RADIUS",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 7;

    const front = block.getFieldValue("FRONT") === "TRUE";

    return `await attachCamera(${modelName}, { radius: ${radius}, front: ${front} });\n`;
  };

  // Camera rotate --------------------------------------------------
  javascriptGenerator.forBlock["rotate_camera"] = function (block) {
    const degrees =
      javascriptGenerator.valueToCode(
        block,
        "DEGREES",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";

    return `rotateCamera(${degrees});\n`;
  };

  // -------------------------------
  // XR
  // -------------------------------
  // Use camera as background ---------------------------------------
  javascriptGenerator.forBlock["device_camera_background"] = function (block) {
    const cameraType = block.getFieldValue("CAMERA");

    return `setCameraBackground("${cameraType}");\n`;
  };

  // Set XR mode to -------------------------------------------------
  javascriptGenerator.forBlock["set_xr_mode"] = function (block) {
    const mode = block.getFieldValue("MODE");

    return `await setXRMode("${mode}");\n`;
  };

  // Export object as -----------------------------------------------
  javascriptGenerator.forBlock["export_mesh"] = function (block) {
    const meshVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const format = block.getFieldValue("FORMAT");

    // Generate the code that calls the helper function
    return `exportMesh(${meshVar}, "${format}");\n`;
  };
}
