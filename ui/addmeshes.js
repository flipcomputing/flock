import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap, generateUniqueId } from "../generators";
import { flock } from "../flock.js";
import { extractMaterialInfo } from "./blockmesh.js";

export function createMeshOnCanvas(block) {
  
  const mesh = getMeshFromBlock(block);
  if (mesh) {
    console.warn("Mesh already exists for block", block.id);
    return;
  }

  // Create a unique group ID for this specific shape creation
  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);

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
    case "create_map": {
      meshId = "ground";
      meshMap[meshId] = block;
      meshBlockIdMap[meshId] = block.id;
      let map = block.getFieldValue("MAP_NAME");
      const materialBlock = block.getInputTargetBlock("MATERIAL");
      const { textureSet, baseColor, alpha } =
        extractMaterialInfo(materialBlock);
      const material = flock.createMaterial(baseColor, textureSet, alpha);
      flock.createMap(map, material);
      break;
    }
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

      newMesh = flock.createBox(`box__${block.id}`, {
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

      newMesh = flock.createSphere(`sphere__${block.id}`, {
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

      newMesh = flock.createCylinder(`cylinder__${block.id}`, {
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

      newMesh = flock.createCapsule(`capsule__${block.id}`, {
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

      newMesh = flock.createPlane(`plane__${block.id}`, {
        color,
        width: planeWidth,
        height: planeHeight,
        position: [position.x, position.y, position.z],
      });

      break;

    default:
      Blockly.Events.setGroup(false);
      return;
    }

    if (newMesh) {
      meshMap[block.id] = block;
      meshBlockIdMap[block.id] = block.id;
    }

  Blockly.Events.setGroup(false);
}

function getMeshFromBlock(block) {
  const blockKey = Object.keys(meshMap).find((key) => meshMap[key] === block);

  if (!blockKey) return null;

  const found = flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);

  return found;
}

export function setPositionValues(block, position, blockType) {
  // Helper function to set position values on blocks
  if (block && position) {
    try {
      // Helper function to set or create shadow block for position input
      function setOrCreatePositionInput(inputName, value) {
        const input = block.getInput(inputName);
        if (!input) return;

        let targetBlock = input.connection.targetBlock();

        if (!targetBlock) {
          // Create a shadow block if none exists
          const shadowBlock = Blockly.getMainWorkspace().newBlock("math_number");
          shadowBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
          shadowBlock.setShadow(true);
          shadowBlock.setMovable(false);
          shadowBlock.setDeletable(false);
          shadowBlock.initSvg();
          shadowBlock.render();
          input.connection.connect(shadowBlock.outputConnection);
        } else {
          // Set the value if a block is already connected
          targetBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
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