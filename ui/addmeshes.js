import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap, generateUniqueId } from "../generators";
import { flock } from "../flock.js";
import {
  extractMaterialInfo,
  getMeshFromBlock,
  readColourValue,
} from "./blockmesh.js";

export function createMeshOnCanvas(block) {

  const mesh = getMeshFromBlock(block);
  if (mesh) {
    console.warn("Mesh already exists for block", block.id);
    return;
  }

  // For shapes (not models), defer creation with aggressive event isolation
  const isShape = [
    "create_box",
    "create_sphere",
    "create_cylinder",
    "create_capsule",
    "create_plane",
  ].includes(block.type);

  if (isShape) {
    // Use the same grouping approach as objects for consistency
    // Group all shape creation events together

    try {
      createShapeInternal(block);
    } finally {
    }
    return;
  }

  let shapeType = block.type;
  let position, scale, color, modelName, newMesh;

  if (
    ![
      "set_sky_color",
      "set_background_color",
      "create_ground",
      "create_map",
    ].includes(block.type)
  ) {
    // Helper function to safely get position value
    function getPositionValue(inputName, defaultValue = 0) {
      const input = block.getInput(inputName);
      if (!input || !input.connection) return defaultValue;

      const targetBlock = input.connection.targetBlock();
      if (!targetBlock) return defaultValue;

      const value = targetBlock.getFieldValue("NUM");
      return value !== null ? parseFloat(value) : defaultValue;
    }

    position = {
      x: getPositionValue("X", 0),
      y: getPositionValue("Y", 0),
      z: getPositionValue("Z", 0),
    };
  }

  let meshId,
    colors,
    width,
    height,
    depth,
    diameterX,
    diameterY,
    diameterZ,
    cylinderHeight,
    diameterTop,
    diameterBottom,
    capsuleHeight,
    capsuleDiameter,
    planeWidth,
    planeHeight;

  // Handle block types
  switch (shapeType) {
    case "set_sky_color":
      meshId = "sky";
      meshMap[meshId] = block;
      meshBlockIdMap[meshId] = block.id;
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      flock.setSky(color);
      break;
    case "set_background_color":
      meshId = "sky";
      meshMap[meshId] = block;
      meshBlockIdMap[meshId] = block.id;
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      flock.setSky(color);
      break;
    case "create_ground":
      meshId = "ground";
      meshMap[meshId] = block;
      meshBlockIdMap[meshId] = block.id;
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      flock.createGround(color, "ground");
      break;
    case "create_map":
      meshId = "ground";
      meshMap[meshId] = block;
      meshBlockIdMap[meshId] = block.id;

      const mapName = block.getFieldValue("MAP_NAME") || "NONE";
      const materialBlock = block.getInputTargetBlock("MATERIAL");

      let textureSet, baseColor, alpha;
      if (materialBlock) {
        ({ textureSet, baseColor, alpha } = extractMaterialInfo(materialBlock));
      } else {
        textureSet = null;
        baseColor = "#808080";
        alpha = 1;
      }

      const material = flock.createMaterial({
        color: baseColor,
        materialName: textureSet,
        alpha,
      });

      flock.createMap(mapName, material);

      break;

    // --- Model Loading Blocks --
    case "load_model":
      modelName = block.getFieldValue("MODELS");
      scale = block
        .getInput("SCALE")
        .connection.targetBlock()
        .getFieldValue("NUM");

      meshId = modelName + "_" + generateUniqueId();
      meshMap[meshId] = block;
      meshBlockIdMap[meshId] = block.id;
      // Use flock API for loading models

      newMesh = flock.createModel({
        modelName: modelName,
        modelId: meshId,
        scale: scale,
        position: { x: position.x, y: position.y, z: position.z },
      });
      break;

    case "load_character":
      modelName = block.getFieldValue("MODELS");

      scale = block
        .getInput("SCALE")
        .connection.targetBlock()
        .getFieldValue("NUM");

      // Retrieve colours
      colors = {
        hair: block
          .getInput("HAIR_COLOR")
          .connection.targetBlock()
          .getFieldValue("COLOR"),
        skin: block
          .getInput("SKIN_COLOR")
          .connection.targetBlock()
          .getFieldValue("COLOR"),
        eyes: block
          .getInput("EYES_COLOR")
          .connection.targetBlock()
          .getFieldValue("COLOR"),
        tshirt: block
          .getInput("TSHIRT_COLOR")
          .connection.targetBlock()
          .getFieldValue("COLOR"),
        shorts: block
          .getInput("SHORTS_COLOR")
          .connection.targetBlock()
          .getFieldValue("COLOR"),
        sleeves: block
          .getInput("SLEEVES_COLOR")
          .connection.targetBlock()
          .getFieldValue("COLOR"),
      };

      meshId = `${modelName}__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;

      newMesh = flock.createCharacter({
        modelName: modelName,
        modelId: meshId,
        scale: scale,
        position: { x: position.x, y: position.y, z: position.z },
        colors: colors,
      });

      break;

    case "load_object":
      modelName = block.getFieldValue("MODELS");
      scale = block
        .getInput("SCALE")
        .connection.targetBlock()
        .getFieldValue("NUM");

      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");

      meshId = `${modelName}__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;
      // Use flock API for objects
      newMesh = flock.createObject({
        modelName: modelName,
        modelId: meshId,
        color: color,
        scale: scale,
        position: { x: position.x, y: position.y, z: position.z },
        callback: () => {},
      });

      break;

    case "load_multi_object": {
      modelName = block.getFieldValue("MODELS");
      scale = block
        .getInput("SCALE")
        .connection.targetBlock()
        .getFieldValue("NUM");

      const colorsBlock = block.getInput("COLORS").connection.targetBlock();
      let colorsArray = [];
      if (colorsBlock && colorsBlock.type === "lists_create_with") {
        colorsBlock.inputList.forEach((input) => {
          // Only process value inputs named "ADD*"
          if (input.name && input.name.startsWith("ADD") && input.connection) {
            const colorBlock = input.connection.targetBlock();
            if (colorBlock) {
              const colorVal = colorBlock.getFieldValue("COLOR");
              if (colorVal) {
                colorsArray.push(colorVal);
              }
            }
          }
        });
      }

      meshId = `${modelName}__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;

      newMesh = flock.createObject({
        modelName: modelName,
        modelId: meshId,
        color: colorsArray,
        scale: scale,
        position: { x: position.x, y: position.y, z: position.z },
        callback: () => {},
      });

      break;
    }
    // --- Shape Creation Blocks ---
    case "create_box":
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      width = block
        .getInput("WIDTH")
        .connection.targetBlock()
        .getFieldValue("NUM");
      height = block
        .getInput("HEIGHT")
        .connection.targetBlock()
        .getFieldValue("NUM");
      depth = block
        .getInput("DEPTH")
        .connection.targetBlock()
        .getFieldValue("NUM");

      meshId = `box__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;

      newMesh = flock.createBox(meshId, {
        color,
        width,
        height,
        depth,
        position: [position.x, position.y, position.z],
      });
      break;

    case "create_sphere":
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      diameterX = block
        .getInput("DIAMETER_X")
        .connection.targetBlock()
        .getFieldValue("NUM");
      diameterY = block
        .getInput("DIAMETER_Y")
        .connection.targetBlock()
        .getFieldValue("NUM");
      diameterZ = block
        .getInput("DIAMETER_Z")
        .connection.targetBlock()
        .getFieldValue("NUM");

      meshId = `sphere__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;

      newMesh = flock.createSphere(meshId, {
        color,
        diameterX,
        diameterY,
        diameterZ,
        position: [position.x, position.y, position.z],
      });
      break;

    case "create_cylinder":
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      cylinderHeight = block
        .getInput("HEIGHT")
        .connection.targetBlock()
        .getFieldValue("NUM");
      diameterTop = block
        .getInput("DIAMETER_TOP")
        .connection.targetBlock()
        .getFieldValue("NUM");
      diameterBottom = block
        .getInput("DIAMETER_BOTTOM")
        .connection.targetBlock()
        .getFieldValue("NUM");

      meshId = `cylinder__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;

      newMesh = flock.createCylinder(meshId, {
        color,
        height: cylinderHeight,
        diameterTop,
        diameterBottom,
        tessellation: 24,
        position: [position.x, position.y, position.z],
      });
      break;

    case "create_capsule":
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      capsuleDiameter = block
        .getInput("DIAMETER")
        .connection.targetBlock()
        .getFieldValue("NUM");
      capsuleHeight = block
        .getInput("HEIGHT")
        .connection.targetBlock()
        .getFieldValue("NUM");

      meshId = `capsule__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;

      newMesh = flock.createCapsule(meshId, {
        color,
        diameter: capsuleDiameter,
        height: capsuleHeight,
        position: [position.x, position.y, position.z],
      });
      break;

    case "create_plane":
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      planeWidth = block
        .getInput("WIDTH")
        .connection.targetBlock()
        .getFieldValue("NUM");
      planeHeight = block
        .getInput("HEIGHT")
        .connection.targetBlock()
        .getFieldValue("NUM");

      meshId = `plane__${block.id}`;
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;

      newMesh = flock.createPlane(meshId, {
        color,
        width: planeWidth,
        height: planeHeight,
        position: [position.x, position.y, position.z],
      });
      break;

    default:
      //Blockly.Events.setGroup(false);
      return;
  }

  if (newMesh) {
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;
  }
}

function createShapeInternal(block) {
  const shapeType = block.type;
  let position, scale, color, newMesh, alpha;
  let width,
    height,
    depth,
    diameterX,
    diameterY,
    diameterZ,
    cylinderHeight,
    diameterTop,
    diameterBottom,
    capsuleHeight,
    capsuleDiameter,
    planeWidth,
    planeHeight;

  // Helper function to safely get position value
  function getPositionValue(inputName, defaultValue = 0) {
    const input = block.getInput(inputName);
    if (!input || !input.connection) return defaultValue;

    const targetBlock = input.connection.targetBlock();
    if (!targetBlock) return defaultValue;

    const value = targetBlock.getFieldValue("NUM");
    return value !== null ? parseFloat(value) : defaultValue;
  }

  // Helper function to safely get field value from connected block
  function getConnectedFieldValue(inputName, fieldName, defaultValue) {
    const input = block.getInput(inputName);
    if (!input || !input.connection) {
      console.warn(
        `Input ${inputName} not found or has no connection on block ${block.type}`,
      );
      return defaultValue;
    }

    const targetBlock = input.connection.targetBlock();
    if (!targetBlock) {
      console.warn(
        `No target block connected to input ${inputName} on block ${block.type}`,
      );
      return defaultValue;
    }

    try {
      const value = targetBlock.getFieldValue(fieldName);
      return value !== null ? value : defaultValue;
    } catch (e) {
      console.error(
        `Error getting field ${fieldName} from connected block:`,
        e,
      );
      return defaultValue;
    }
  }

  position = {
    x: getPositionValue("X", 0),
    y: getPositionValue("Y", 0),
    z: getPositionValue("Z", 0),
  };

  const resolveColorOrMaterial = (defaultColor = "#ff0000") => {
    const colorInput = block.getInputTargetBlock("COLOR");
    let alpha = 1;
    let colorOrMaterial = defaultColor;

    if (colorInput?.type === "material") {
      const materialInfo = extractMaterialInfo(colorInput);
      alpha = materialInfo.alpha ?? 1;
      const hasMaterial =
        materialInfo.textureSet && materialInfo.textureSet !== "NONE";
      const baseColor = materialInfo.baseColor ?? defaultColor;

      colorOrMaterial = hasMaterial
        ? {
            materialName: materialInfo.textureSet,
            color: baseColor,
            alpha,
          }
        : baseColor;
    } else {
      const read = readColourValue(colorInput);
      colorOrMaterial = read.value ?? defaultColor;
    }

    return { colorOrMaterial, alpha };
  };

  // Handle shape creation blocks
  switch (shapeType) {
    case "create_box":
      ({ colorOrMaterial: color, alpha } = resolveColorOrMaterial("#ff0000"));
      width = parseFloat(getConnectedFieldValue("WIDTH", "NUM", "1"));
      height = parseFloat(getConnectedFieldValue("HEIGHT", "NUM", "1"));
      depth = parseFloat(getConnectedFieldValue("DEPTH", "NUM", "1"));

      newMesh = flock.createBox(`box__${block.id}`, {
        color,
        width,
        height,
        depth,
        position: [position.x, position.y, position.z],
        alpha,
      });
      break;

    case "create_sphere":
      ({ colorOrMaterial: color, alpha } = resolveColorOrMaterial("#ff0000"));
      diameterX = parseFloat(getConnectedFieldValue("DIAMETER_X", "NUM", "1"));
      diameterY = parseFloat(getConnectedFieldValue("DIAMETER_Y", "NUM", "1"));
      diameterZ = parseFloat(getConnectedFieldValue("DIAMETER_Z", "NUM", "1"));

      newMesh = flock.createSphere(`sphere__${block.id}`, {
        color,
        diameterX,
        diameterY,
        diameterZ,
        position: [position.x, position.y, position.z],
        alpha,
      });
      break;

    case "create_cylinder":
      ({ colorOrMaterial: color, alpha } = resolveColorOrMaterial("#ff0000"));
      cylinderHeight = parseFloat(getConnectedFieldValue("HEIGHT", "NUM", "1"));
      diameterTop = parseFloat(
        getConnectedFieldValue("DIAMETER_TOP", "NUM", "1"),
      );
      diameterBottom = parseFloat(
        getConnectedFieldValue("DIAMETER_BOTTOM", "NUM", "1"),
      );

      newMesh = flock.createCylinder(`cylinder__${block.id}`, {
        color,
        height: cylinderHeight,
        diameterTop,
        diameterBottom,
        tessellation: 24,
        position: [position.x, position.y, position.z],
        alpha,
      });
      break;

    case "create_capsule":
      ({ colorOrMaterial: color, alpha } = resolveColorOrMaterial("#ff0000"));
      capsuleDiameter = parseFloat(
        getConnectedFieldValue("DIAMETER", "NUM", "1"),
      );
      capsuleHeight = parseFloat(getConnectedFieldValue("HEIGHT", "NUM", "1"));

      newMesh = flock.createCapsule(`capsule__${block.id}`, {
        color,
        diameter: capsuleDiameter,
        height: capsuleHeight,
        position: [position.x, position.y, position.z],
        alpha,
      });
      break;

    case "create_plane":
      ({ colorOrMaterial: color, alpha } = resolveColorOrMaterial("#ff0000"));
      planeWidth = parseFloat(getConnectedFieldValue("WIDTH", "NUM", "2"));
      planeHeight = parseFloat(getConnectedFieldValue("HEIGHT", "NUM", "2"));

      newMesh = flock.createPlane(`plane__${block.id}`, {
        color,
        width: planeWidth,
        height: planeHeight,
        position: [position.x, position.y, position.z],
        alpha,
      });
      break;

    default:
      return;
  }

  if (newMesh) {
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;
  }
}

// Updated setPositionValues function with rounding behavior
export function setPositionValues(block, position, blockType) {
  // Helper function to set position values on blocks
  if (block && position) {
    try {
      // Helper function to set or create shadow block for position input
      function setOrCreatePositionInput(inputName, value) {
        const input = block.getInput(inputName);
        if (!input) return;

        // Round the value to 1 decimal place
        const roundedValue = Math.round(value * 10) / 10;

        let targetBlock = input.connection.targetBlock();
        if (!targetBlock) {
          // Create a shadow block if none exists
          const shadowBlock =
            Blockly.getMainWorkspace().newBlock("math_number");
          shadowBlock.setFieldValue(String(roundedValue), "NUM");
          shadowBlock.setShadow(true);
          shadowBlock.setMovable(false);
          shadowBlock.setDeletable(false);
          shadowBlock.initSvg();
          shadowBlock.render();
          input.connection.connect(shadowBlock.outputConnection);
        } else {
          // Set the value if a block is already connected
          targetBlock.setFieldValue(String(roundedValue), "NUM");
        }
      }

      setOrCreatePositionInput("X", position.x);
      setOrCreatePositionInput("Y", position.y);
      setOrCreatePositionInput("Z", position.z);
    } catch (e) {
      console.warn("Could not set position values for block:", blockType, e);
    }
  }
}

function roundPositionValue(value) {
  return Math.round(value * 10) / 10; // 1 decimal place
}
