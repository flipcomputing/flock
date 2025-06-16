import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap, generateUniqueId } from "../generators";
import { flock } from "../flock.js";
import {
  modelNames,
  multiObjectNames,
  objectNames,
  characterNames,
  objectColours,
} from "../config.js";

export let gizmoManager;

const blueColor = flock.BABYLON.Color3.FromHexString("#0072B2"); // Colour for X-axis
const greenColor = flock.BABYLON.Color3.FromHexString("#009E73"); // Colour for Y-axis
const orangeColor = flock.BABYLON.Color3.FromHexString("#D55E00"); // Colour for Z-axis

const colorFields = {
  HAIR_COLOR: "#000000", // Hair: black
  SKIN_COLOR: "#A15C33", // Skin: custom skin tone
  EYES_COLOR: "#000000", // Eyes: black
  SLEEVES_COLOR: "#008B8B", // Sleeves: dark cyan
  SHORTS_COLOR: "#00008B", // Shorts: dark blue
  TSHIRT_COLOR: "#FF8F60", // T-Shirt: light orange
};

export function updateOrCreateMeshFromBlock(block, changeEvent) {
 /* console.log("updateOrCreateMeshFromBlock", {
    id: block.id,
    isEnabled: block.isEnabled(),
    hasMesh: !!getMeshFromBlock(block),
  });*/

  if (window.loadingCode || block.disposed || !block.isEnabled()) return;

  const mesh = getMeshFromBlock(block);

  // Create a mesh if it doesn't exist
  if (!mesh) {
    createMeshOnCanvas(block);
    return;
  }

  // Handle update events (if there's a valid mesh already)
  if (
    changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
    (
      ["set_sky_color", "set_background_color", "create_ground"].includes(
        block.type
      ) || mesh
    )
  ) {
    updateMeshFromBlock(mesh, block, changeEvent);
  }
}



window.selectedColor = "#ffffff"; // Default color

document.addEventListener("DOMContentLoaded", function () {
  const colorInput = document.getElementById("colorPickerButton");

  window.addEventListener("keydown", (event) => {
    // Check if both Ctrl and the comma key (,) are pressed
    if (event.ctrlKey && event.code === "Comma") {
      focusCameraOnMesh();
    }
  });

  // Attach the event listener to capture color changes when user interacts with the input
  colorInput?.addEventListener("input", (event) => {
    window.selectedColor = event.target.value; // Store the selected color

    // Delay the blur to ensure the color selection is processed first
    setTimeout(() => {
      colorInput.blur(); // Close the picker after a brief delay
      colorInput.setAttribute("type", "text");
      colorInput.setAttribute("type", "color");
    }, 100); // Adjust the delay time as needed
    // Call a function to handle the selected color
    pickMeshFromCanvas();
  });
});

function pickMeshFromCanvas() {
  const canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the flock.BABYLON.js canvas

  document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

  const onPickMesh = function (event) {
    // Get the canvas bounds relative to the window
    const canvasRect = canvas.getBoundingClientRect();

    // Check if the click happened outside the canvas
    if (
      event.clientX < canvasRect.left ||
      event.clientX > canvasRect.right ||
      event.clientY < canvasRect.top ||
      event.clientY > canvasRect.bottom
    ) {
      window.removeEventListener("click", onPickMesh);
      document.body.style.cursor = "default";
      return;
    }

    // Calculate the click position relative to the canvas, not the window
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // Create a picking ray using the adjusted canvas coordinates
    const pickRay = flock.scene.createPickingRay(
      canvasX,
      canvasY,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera,
    );

    // Perform the picking
    const pickResult = flock.scene.pickWithRay(
      pickRay,
      (mesh) => mesh.isPickable,
    );

    flock.changeColorMesh(pickResult.pickedMesh, selectedColor);
    updateBlockColorAndHighlight(pickResult.pickedMesh, selectedColor);

    document.body.style.cursor = "default"; // Reset the cursor
    window.removeEventListener("click", onPickMesh); // Remove the event listener after picking
  };

  // Add event listener to pick the mesh on the next click
  window.addEventListener("click", onPickMesh);
}

export function deleteMeshFromBlock(blockId) {
  const mesh = getMeshFromBlockId(blockId);

  const blockKey = Object.keys(meshBlockIdMap).find(
    (key) => meshBlockIdMap[key] === blockId,
  );

  if (blockKey) {
    // Remove mappings
    delete meshMap[blockKey];
    delete meshBlockIdMap[blockKey];
  }

  if (mesh && mesh.name !== "__root__") {
    flock.dispose(mesh.name);
  }
}

export function getMeshFromBlock(block) {
  const blockKey = Object.keys(meshMap).find((key) => meshMap[key] === block);

  if (!blockKey) return null;

  const found = flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);

  return found;
}

function rescaleBoundingBox(bb, newScale) {
  // Get the current world matrix before any transformation
  const originalWorldMatrix = bb.getWorldMatrix().clone();

  // Extract the original world position
  const originalPosition = originalWorldMatrix.getTranslation();

  // Bake current transform into vertices
  bb.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1 first
  bb.scaling.set(1, 1, 1);

  // Set the new scale and bake it
  bb.scaling.set(newScale, newScale, newScale);
  bb.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1 again
  bb.scaling.set(1, 1, 1);

  // Restore the original world position
  bb.position.copyFrom(originalPosition);
}

function getBlockValue(block) {
  if (!block) return null;

  const fieldNames = block.inputList
    .flatMap((input) => input.fieldRow)
    .map((field) => field.name);

  for (const name of fieldNames) {
    const field = block.getField(name);
    if (field) {
      return field.getValue(); // returns number, text, or colour depending on the field
    }
  }

  return null;
}

function extractMaterialInfo(materialBlock) {
  const textureSet = materialBlock.getFieldValue("TEXTURE_SET");

  let baseColor = null;
  const baseColorBlock = materialBlock.getInputTargetBlock("BASE_COLOR");
  if (baseColorBlock) {
    baseColor = getBlockValue(baseColorBlock);
  }

  let alpha = 1;
  const alphaBlock = materialBlock.getInputTargetBlock("ALPHA");
  if (alphaBlock) {
    const alphaVal = getBlockValue(alphaBlock);
    if (alphaVal !== null) alpha = parseFloat(alphaVal);
  }

  return { textureSet, baseColor, alpha };
}

export function updateMeshFromBlock(mesh, block, changeEvent) {
  if (
    !mesh &&
    !["set_sky_color", "set_background_color", "create_ground"].includes(
      block.type,
    )
  )
    return;

  const changedBlock = Blockly.getMainWorkspace().getBlockById(
    changeEvent.blockId,
  );

  const parent = changedBlock.getParent() || changedBlock;
  let changed;

  parent.inputList.forEach((input) => {
    let value =
      input?.connection?.shadowState?.id ||
      input?.connection?.targetConnection?.sourceBlock_?.id;
    if (value === changedBlock.id) changed = input.name;
  });

  if (!changed) return;

  const shapeType = block.type;

  if (mesh && mesh.physics) mesh.physics.disablePreStep = true;

  let color;

  if (
    ![
      "load_model",
      "load_multi_object",
      "load_character",
      "create_map",
    ].includes(block.type)
  ) {
    color = block
      .getInput("COLOR")
      .connection.targetBlock()
      .getFieldValue("COLOR");
  } else if (block.type === "load_multi_object") {
    // Get the block connected to the "COLORS" input
    const colorsBlock = block.getInput("COLORS").connection.targetBlock();

    // Initialize an array to store the color values
    let colorsArray = [];

    if (colorsBlock) {
      // Loop through the child blocks (array items) and get their values
      colorsBlock.childBlocks_.forEach((childBlock) => {
        // Get the color value from the child block
        const color = childBlock.getFieldValue("COLOR");
        if (color) {
          colorsArray.push(color);
        }
      });
    }

    color = colorsArray;
  }

  if (block.type === "set_sky_color") {
    let isColorList = false;
    let colorList = [];

    for (let child of block.childBlocks_) {
      if (child.type === "lists_create_with") {
        isColorList = true;
        for (let input of child.inputList) {
          colorList.push(input.connection.targetBlock().getFieldValue("COLOR"));
        }
      }
    }

    if (isColorList) {
      color = colorList;
    }

    flock.setSky(color);
    return;
  }
  if (block.type === "set_background_color") {
    flock.setSky(color);
    return;
  }
  if (block.type === "create_ground") {
    flock.createGround(color, "ground");
    return;
  }
  if (block.type === "create_map") {
    let map = block.getFieldValue("MAP_NAME");
    const materialBlock = block.getInputTargetBlock("MATERIAL");
    const { textureSet, baseColor, alpha } = extractMaterialInfo(materialBlock);
    const material = flock.createMaterial(baseColor, textureSet, alpha);
    flock.createMap(map, material);
    return;
  }

  if (block.type.startsWith("load_")) {
    let scale = block
      .getInput("SCALE")
      .connection.targetBlock()
      .getFieldValue("NUM");

    if (changed === "SCALE") {
      const relativeScale = changeEvent.oldValue
        ? scale / changeEvent.oldValue
        : scale;

      if (relativeScale !== 1) {
        const x = mesh.position.x;
        const y = mesh.position.y;
        const z = mesh.position.z;

        let ydiff;
        // Find the child that actually has geometry (i.e. the visual mesh)

        const relativeScale = changeEvent.oldValue
          ? scale / changeEvent.oldValue
          : scale;

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        ydiff = mesh.getBoundingInfo().boundingBox.extendSizeWorld.y;

        rescaleBoundingBox(mesh, relativeScale);
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();

        flock.positionAt(mesh.name, {
          x: mesh.position.x,
          y: mesh.position.y - ydiff,
          z: mesh.position.z,
        });

        const ydiffAfter = mesh.getBoundingInfo().boundingBox.extendSizeWorld.y;
        //mesh.position.y -= ydiffAfter;

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
      }
    }
  } else {
    flock.updatePhysics(mesh);
  }

  // Retrieve the position values (X, Y, Z) from the connected blocks
  let position;

  position = {
    x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
    y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
    z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
  };

  let colors,
    width,
    height,
    depth,
    diameterX,
    diameterY,
    diameterZ,
    cylinderHeight,
    diameterTop,
    diameterBottom,
    sides,
    capsuleHeight,
    diameter,
    planeWidth,
    planeHeight,
    modelName;
  // Shape-specific updates based on the block type
  switch (shapeType) {
    case "load_object":
      /*
			modelName = block.getFieldValue("MODELS");

			if (modelName !== mesh.metadata.modelName) {
				modelId = "tempid";

				let tempMesh = flock.newObject({
					modelName: modelName,
					modelId: modelId,
					color: color,
					scale: scale,
					position: { x: position.x, y: position.y, z: position.z },
					callback: () => {
						changeModel(tempMesh, mesh, modelName);
						
					},
				});
			}
			*/

      break;
    case "load_model":
      /*
			modelName = block.getFieldValue("MODELS");

			if (modelName !== mesh.metadata.modelName) {
				modelId = "tempid";

				let tempMesh = flock.newModel({
					modelName: modelName,
					modelId: modelId,
					scale: scale,
					position: { x: position.x, y: position.y, z: position.z },
					callback: () => {
						changeModel(tempMesh, mesh, modelName);

					},
				});
			}*/
      //console.log("Need to handle update of model");
      break;
    case "load_multi_object":
      //console.log("Need to handle update of multi model");
      break;
    case "load_character":
      modelName = block.getFieldValue("MODELS");

      if (changed in colorFields) {
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
        flock.applyColorsToCharacter(getMeshFromBlock(block), colors);
      }
      break;
    case "create_box":
      // Retrieve width, height, and depth from connected blocks
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

      // Set the absolute size of the box (not scaling)
      setAbsoluteSize(mesh, width, height, depth);
      break;

    case "create_sphere":
      // Retrieve diameter values for X, Y, Z from connected blocks
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

      // Set the absolute size of the sphere based on diameters
      setAbsoluteSize(mesh, diameterX, diameterY, diameterZ);
      break;

    case "create_cylinder":
      // Retrieve height, diameterTop, and diameterBottom from connected blocks
      if (
        ["HEIGHT", "DIAMETER_TOP", "DIAMETER_BOTTOM", "TESSELATIONS"].includes(
          changed,
        )
      ) {
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
        sides = block
          .getInput("TESSELLATIONS")
          .connection.targetBlock()
          .getFieldValue("NUM");

        updateCylinderGeometry(
          mesh,
          diameterTop,
          diameterBottom,
          cylinderHeight,
          sides,
        );
      }
      break;

    case "create_capsule":
      // Retrieve diameter and height from connected blocks
      if (["HEIGHT", "DIAMETER"].includes(changed)) {
        diameter = block
          .getInput("DIAMETER")
          .connection.targetBlock()
          .getFieldValue("NUM");
        capsuleHeight = block
          .getInput("HEIGHT")
          .connection.targetBlock()
          .getFieldValue("NUM");

        // Set the absolute size of the capsule
        setAbsoluteSize(mesh, diameter, capsuleHeight, diameter);
      }
      break;

    case "create_plane":
      // Retrieve width and height from connected blocks
      if (["HEIGHT", "WIDTH"].includes(changed)) {
        planeWidth = block
          .getInput("WIDTH")
          .connection.targetBlock()
          .getFieldValue("NUM");
        planeHeight = block
          .getInput("HEIGHT")
          .connection.targetBlock()
          .getFieldValue("NUM");

        // Set the absolute size of the plane
        setAbsoluteSize(mesh, planeWidth, planeHeight, 0); // Planes are usually flat in the Z dimension
      }
      break;

    default:
      console.warn(`Unknown shape type: ${shapeType}`);
  }

  // Use flock API to change the color and position of the mesh
  if (["COLOR", "COLORS"].includes(changed) || changed.startsWith("ADD")) {
    if (color) {
      // Check if color is the hardcoded purple and replace with config default
      if (color === "#9932cc" && block.type === "load_object") {
        const modelName = block.getFieldValue("MODELS");
        color = objectColours[modelName] || "#FFD700";
      }

      const ultimateParent = (mesh) =>
        mesh.parent ? ultimateParent(mesh.parent) : mesh;
      //color = flock.getColorFromString(color);
      mesh = ultimateParent(mesh);
      flock.changeColor(mesh.name, { color });
    }
  }

  // if (["X", "Y", "Z"].includes(changed)) {
  flock.positionAt(mesh.name, {
    x: position.x,
    y: position.y,
    z: position.z,
    useY: true,
  });

  //}
  //console.log("Update physics");
  flock.updatePhysics(mesh);
}

function createMeshOnCanvas(block) {
  const mesh = getMeshFromBlock(block);
  if (mesh) {
    console.warn("Mesh already exists for block", block.id);
    return;
  }

  //console.log("createMeshOnCanvas for block", block.id);
  Blockly.Events.setGroup(true);

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
    position = {
      x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
      y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
      z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
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

      // Always use the config default color for load_object blocks
      color = objectColours[modelName] || "#FFD700";

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

      newMesh = flpock.createPlane(`plane__${block.id}`, {
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

function setAbsoluteSize(mesh, width, height, depth) {
  flock.ensureUniqueGeometry(mesh);
  const boundingInfo = mesh.getBoundingInfo();
  const originalSize = boundingInfo.boundingBox.extendSize;

  // Store the current world matrix and decompose it
  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(
    currentScale,
    currentRotationQuaternion,
    currentPosition,
  );

  // Temporarily move mesh to origin
  mesh.position = flock.BABYLON.Vector3.Zero();
  mesh.rotation = flock.BABYLON.Vector3.Zero();

  // Calculate new scaling
  const newScaleX = width / (originalSize.x * 2);
  const newScaleY = height / (originalSize.y * 2);
  const newScaleZ = depth === 0 ? 1 : depth / (originalSize.z * 2);

  // Apply scaling
  mesh.scaling = new flock.BABYLON.Vector3(newScaleX, newScaleY, newScaleZ);

  // Bake the scaling into the vertices
  mesh.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1
  mesh.scaling = new flock.BABYLON.Vector3(1, 1, 1);

  // Restore original position and rotation from world matrix
  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;

  let shapeType = null;
  if (mesh.metadata) shapeType = mesh.metadata.shapeType;

  if (mesh.physics && shapeType) {
    const shape = mesh.physics.shape;
    let newShape, diameterBottom, startPoint, endPoint, diameter;

    // Create the new physics shape based on the type
    switch (shapeType) {
      case "Box":
        newShape = new flock.BABYLON.PhysicsShapeBox(
          new flock.BABYLON.Vector3(0, 0, 0),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          new flock.BABYLON.Vector3(width, height, depth),
          mesh.getScene(),
        );
        break;
      case "Cylinder":
        diameterBottom = Math.min(width, depth);
        startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
        endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);
        newShape = new flock.BABYLON.PhysicsShapeCylinder(
          startPoint,
          endPoint,
          diameterBottom / 2,
          mesh.getScene(),
        );
        break;
      case "Sphere":
        newShape = new flock.BABYLON.PhysicsShapeSphere(
          new flock.BABYLON.Vector3(0, 0, 0),
          Math.max(width, depth, height) / 2,
          mesh.getScene(),
        );
        break;
      case "Capsule":
        diameter = Math.min(width, depth);

        newShape = flock.createCapsuleFromBoundingBox(mesh, mesh.getScene());
        break;
      default:
        console.log("Unknown or unsupported physics shape type: " + shapeType);
        break;
    }

    if (newShape) {
      shape.dispose();
      const physicsBody = mesh.physics;
      physicsBody.shape = newShape;
      mesh.physics.disablePreStep;
      mesh.computeWorldMatrix(true);
    }
  }
}

function updateCylinderGeometry(
  mesh,
  diameterTop,
  diameterBottom,
  height,
  sides,
) {
  // Store the current world matrix and decompose it
  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(
    currentScale,
    currentRotationQuaternion,
    currentPosition,
  );

  // If the mesh has geometry, dispose of it before updating
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  // Temporarily reset mesh transform
  mesh.position = flock.BABYLON.Vector3.Zero();
  mesh.rotation = flock.BABYLON.Vector3.Zero();
  mesh.scaling = new flock.BABYLON.Vector3(1, 1, 1);

  // Create a temporary mesh with the provided dimensions (already in world space)
  const tempMesh = flock.BABYLON.MeshBuilder.CreateCylinder(
    "",
    {
      height: height,
      diameterTop: diameterTop,
      diameterBottom: diameterBottom,
      tessellation: sides,
      updatable: true,
    },
    mesh.getScene(),
  );

  // Extract vertex data from the temporary mesh
  const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(tempMesh);

  // Create new geometry for the mesh
  const newGeometry = new flock.BABYLON.Geometry(
    mesh.name + "_geometry",
    mesh.getScene(),
    vertexData,
    true,
    mesh,
  );

  // Apply the new geometry to the mesh
  newGeometry.applyToMesh(mesh);
  mesh.makeGeometryUnique();

  // Dispose of the temporary mesh after extracting vertex data
  tempMesh.dispose();

  // Restore position and rotation only, keep scale at 1,1,1
  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;
  mesh.scaling = new flock.BABYLON.Vector3(1, 1, 1);

  // Ensure the world matrix is updated
  mesh.computeWorldMatrix(true);
}

// Helper function to create and attach shadow blocks
function addShadowBlock(block, inputName, blockType, defaultValue) {
  const shadowBlock = Blockly.getMainWorkspace().newBlock(blockType);

  // Determine the correct field based on block type
  const fieldName = ["colour", "skin_colour"].includes(blockType)
    ? "COLOR"
    : "NUM";

  shadowBlock.setFieldValue(String(defaultValue), fieldName);
  shadowBlock.setShadow(true); // Ensure it's treated as a shadow block
  shadowBlock.setMovable(false); // Prevent dragging
  shadowBlock.setDeletable(false); // Prevent deletion
  shadowBlock.initSvg();
  shadowBlock.render();
  block.getInput(inputName).connection.connect(shadowBlock.outputConnection);
}

function setPositionValues(block, position, shapeType) {
  // Set X, Y, Z values
  setNumberInput(block, "X", position.x);
  setNumberInput(block, "Y", position.y);
  setNumberInput(block, "Z", position.z);
}

// Helper function to set a numeric input value or create a shadow block if missing
function setNumberInput(block, inputName, value) {
  let inputConnection = block.getInput(inputName).connection;
  let targetBlock = inputConnection.targetBlock();

  if (!targetBlock) {
    // Create a shadow block for the input if none exists
    const shadowBlock = Blockly.getMainWorkspace().newBlock("math_number");
    shadowBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
    shadowBlock.setShadow(true); // Ensure it's treated as a shadow block
    shadowBlock.setMovable(false); // Prevent dragging
    shadowBlock.setDeletable(false); // Prevent deletion
    shadowBlock.initSvg();
    shadowBlock.render();
    inputConnection.connect(shadowBlock.outputConnection);
  } else {
    // Set the value if a block is already connected
    targetBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
  }
}

function getMeshFromBlockId(blockId) {
  const blockKey = Object.keys(meshMap).find(
    (key) => meshBlockIdMap[key] === blockId,
  );

  return flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
}

function addShapeToWorkspace(shapeType, position) {
  //console.log("Adding shape to workspace", shapeType, position);
  Blockly.Events.setGroup("workspace-add");

  // Create the shape block in the Blockly workspace

  const block = Blockly.getMainWorkspace().newBlock(shapeType);

  Blockly.Events.disable();
  let color,
    width,
    height,
    depth,
    diameterX,
    diameterY,
    diameterZ,
    diameter,
    diameterTop,
    diameterBottom,
    sides;

  // Set different fields based on the shape type and capture the actual values
  switch (shapeType) {
    case "create_box":
      color = flock.randomColour();
      width = 1;
      height = 1;
      depth = 1;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "WIDTH", "math_number", width);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      addShadowBlock(block, "DEPTH", "math_number", depth);
      break;

    case "create_sphere":
      color = flock.randomColour();
      diameterX = 1;
      diameterY = 1;
      diameterZ = 1;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "DIAMETER_X", "math_number", diameterX);
      addShadowBlock(block, "DIAMETER_Y", "math_number", diameterY);
      addShadowBlock(block, "DIAMETER_Z", "math_number", diameterZ);
      break;

    case "create_cylinder":
      color = flock.randomColour();
      height = 1;
      diameterTop = 1;
      diameterBottom = 1;
      sides = 24;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      addShadowBlock(block, "DIAMETER_TOP", "math_number", diameterTop);
      addShadowBlock(block, "DIAMETER_BOTTOM", "math_number", diameterBottom);
      addShadowBlock(block, "TESSELLATIONS", "math_number", sides);
      break;

    case "create_capsule":
      color = flock.randomColour();
      diameter = 1;
      height = 2;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "DIAMETER", "math_number", diameter);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      break;

    case "create_plane":
      color = flock.randomColour();
      width = 2;
      height = 2;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "WIDTH", "math_number", width);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      break;

    default:
      Blockly.Events.setGroup(false);
      return;
  }

  // Set position values (X, Y, Z) from the picked position
  setPositionValues(block, position, shapeType);
  // Initialize and render the shape block
  block.initSvg();
  block.render();
  Blockly.Events.enable();
  Blockly.Events.setGroup("workspace-add");

  // Create a new 'start' block and connect the shape block to it
  const startBlock = Blockly.getMainWorkspace().newBlock("start");
  startBlock.initSvg();
  startBlock.render();

  const connection = startBlock.getInput("DO").connection;
  if (connection) {
    connection.connect(block.previousConnection);
  }

  Blockly.Events.setGroup(false);

  highlightBlockById(Blockly.getMainWorkspace(), block);
}

function selectCharacter(characterName) {
  document.getElementById("shapes-dropdown").style.display = "none";
  document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

  setTimeout(() => {
    const onPick = function (event) {
      const canvasRect = flock.canvas.getBoundingClientRect();
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;

      const pickResult = flock.scene.pick(canvasX, canvasY);
      if (pickResult.hit) {
        const pickedPosition = pickResult.pickedPoint;

        // Start a Blockly event group to ensure undo/redo tracks all changes
        Blockly.Events.setGroup(true);

        try {
          // Add the load_character block to the workspace at the picked location
          const block = Blockly.getMainWorkspace().newBlock("load_character");
          block.setFieldValue(characterName, "MODELS"); // Set the selected character

          // Set position values (X, Y, Z) from the picked position
          setPositionValues(block, pickedPosition, "load_character");

          // Add shadow block for SCALE using the addShadowBlock helper function
          const scale = 1; // Default scale value
          addShadowBlock(block, "SCALE", "math_number", scale);

          // Add shadow blocks for colour inputs with default values

          Object.keys(colorFields).forEach((colorInputName) => {
            addShadowBlock(
              block,
              colorInputName,
              colorInputName === "SKIN_COLOR" ? "skin_colour" : "colour",
              colorFields[colorInputName],
            );
          });

          block.initSvg();
          block.render();
          highlightBlockById(Blockly.getMainWorkspace(), block);

          // Create a new start block and connect the character block to it
          const startBlock = Blockly.getMainWorkspace().newBlock("start");
          startBlock.initSvg();
          startBlock.render();
          const connection = startBlock.getInput("DO").connection;
          if (connection) {
            connection.connect(block.previousConnection);
          }
        } finally {
          // End the event group to ensure everything can be undone/redone as a group
          Blockly.Events.setGroup(false);
        }
      }

      document.body.style.cursor = "default";
      window.removeEventListener("click", onPick);
    };

    window.addEventListener("click", onPick);
  }, 300); // Small delay to avoid firing immediately from the menu click
}
window.selectCharacter = selectCharacter;

function selectShape(shapeType) {
  document.getElementById("shapes-dropdown").style.display = "none";
  document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

  // Delay adding the click listener to avoid the immediate menu click issue
  setTimeout(() => {
    const onPick = function (event) {
      const canvasRect = flock.canvas.getBoundingClientRect();
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;
      const pickResult = flock.scene.pick(canvasX, canvasY);

      if (pickResult.hit) {
        const pickedPosition = pickResult.pickedPoint; // Get picked position

        addShapeToWorkspace(shapeType, pickedPosition); // Add the selected shape at this position
        document.body.style.cursor = "default"; // Reset cursor after picking
        window.removeEventListener("click", onPick); // Remove the click listener after pick
      } else {
        console.log("No object was picked, please try again.");
      }
    };

    // Attach the event listener to wait for the next click on the scene
    window.addEventListener("click", onPick);
  }, 300); // Small delay (300ms) to avoid firing immediately
}
window.selectShape = selectShape;

function selectModel(modelName) {
  // Close the shapes menu after selecting a model
  document.getElementById("shapes-dropdown").style.display = "none";

  document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

  // Add a delay to avoid immediate firing
  setTimeout(() => {
    const onPick = function (event) {
      const canvasRect = flock.canvas.getBoundingClientRect();
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;

      const pickResult = flock.scene.pick(canvasX, canvasY);
      if (pickResult.hit) {
        const pickedPosition = pickResult.pickedPoint;

        // Start a Blockly event group to ensure undo/redo tracks all changes
        Blockly.Events.setGroup(true);

        try {
          // Add the load_model block to the workspace at the picked location
          const block = Blockly.getMainWorkspace().newBlock("load_model");
          block.setFieldValue(modelName, "MODELS"); // Set the selected model

          setPositionValues(block, pickedPosition, "load_model"); // Set X, Y, Z

          // Create shadow block for SCALE using the addShadowBlock helper function
          const scale = 1; // Default scale value
          addShadowBlock(block, "SCALE", "math_number", scale);

          block.initSvg();
          block.render();

          highlightBlockById(Blockly.getMainWorkspace(), block);

          // Create a new start block and connect the model block to it
          const startBlock = Blockly.getMainWorkspace().newBlock("start");
          startBlock.initSvg();
          startBlock.render();
          const connection = startBlock.getInput("DO").connection;
          if (connection) {
            connection.connect(block.previousConnection);
          }
        } finally {
          // End the event group to ensure undo/redo works properly
          Blockly.Events.setGroup(false);
        }
      }

      document.body.style.cursor = "default"; // Reset cursor after picking
      window.removeEventListener("click", onPick); // Remove the click listener after pick
    };

    // Attach the event listener to wait for the next click on the scene
    window.addEventListener("click", onPick);
  }, 300); // Delay to avoid firing from the menu click
}
window.selectModel = selectModel;

function selectObject(objectName) {
  selectObjectWithCommand(objectName, "shapes-dropdown", "load_object");
}

function selectMultiObject(objectName) {
  selectObjectWithCommand(objectName, "shapes-dropdown", "load_multi_object");
}
window.selectMultiObject = selectMultiObject;

function selectObjectWithCommand(objectName, menu, command) {
  document.getElementById(menu).style.display = "none";
  const canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the flock.BABYLON.js canvas

  document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

  setTimeout(() => {
    const onPickMesh = function (event) {
      // Get the canvas bounds relative to the window
      const canvasRect = canvas.getBoundingClientRect();

      // Check if the click happened outside the canvas
      if (
        event.clientX < canvasRect.left ||
        event.clientX > canvasRect.right ||
        event.clientY < canvasRect.top ||
        event.clientY > canvasRect.bottom
      ) {
        window.removeEventListener("click", onPickMesh);
        document.body.style.cursor = "default";
        return;
      }

      // Calculate the click position relative to the canvas, not the window
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;

      // Create a picking ray using the adjusted canvas coordinates
      const pickRay = flock.scene.createPickingRay(
        canvasX,
        canvasY,
        flock.BABYLON.Matrix.Identity(),
        flock.scene.activeCamera,
      );

      // Perform the picking
      const pickResult = flock.scene.pickWithRay(
        pickRay,
        (mesh) => mesh.isPickable,
      );

      if (pickResult.hit) {
        const pickedPosition = pickResult.pickedPoint;

        // Start a Blockly event group to ensure undo/redo tracks all changes
        Blockly.Events.setGroup(true);

        try {
          //console.log("Create new block", command);
          // Create the load_object block
          const block = Blockly.getMainWorkspace().newBlock(command);
          block.initSvg();
          highlightBlockById(Blockly.getMainWorkspace(), block);

          // Set object name
          block.setFieldValue(objectName, "MODELS");

          // Set position values (X, Y, Z) from the picked position
          setPositionValues(block, pickedPosition, command);

          // Add shadow block for SCALE
          const scale = 1; // Default scale
          addShadowBlock(block, "SCALE", "math_number", scale);

          if (command === "load_object") {
            // Add shadow block for COLOR using the first color from config array
            const configColors = objectColours[objectName];
            const color = Array.isArray(configColors)
              ? configColors[0]
              : configColors || "#FFD700";
            addShadowBlock(block, "COLOR", "colour", color);
          } else if (command === "load_multi_object") {
            if (Blockly.Blocks["load_multi_object"].updateColorsField) {
              Blockly.Blocks["load_multi_object"].updateColorsField.call(block);
            }
          }

          block.render();

          // Create a new 'start' block and connect the load_object block to it
          const startBlock = Blockly.getMainWorkspace().newBlock("start");
          startBlock.initSvg();
          startBlock.render();

          // Connect the load_object block to the start block
          const connection = startBlock.getInput("DO").connection;
          if (connection) {
            connection.connect(block.previousConnection);
          }
        } finally {
          // End the event group to ensure everything can be undone/redone as a group
          Blockly.Events.setGroup(false);
        }
      }

      document.body.style.cursor = "default"; // Reset the cursor
      window.removeEventListener("click", onPickMesh); // Remove the event listener after picking
    };

    // Add event listener to pick the mesh on the next click
    window.addEventListener("click", onPickMesh);
  }, 200);
}
window.selectObject = selectObject;

// Scroll function to move the object row left or right
function scrollObjects(direction) {
  const objectRow = document.getElementById("object-row");
  const scrollAmount = 100; // Adjust scroll amount as needed
  objectRow.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

// Function to load characters into the menu
function loadCharacterImages() {
  const characterRow = document.getElementById("character-row");
  characterRow.replaceChildren();
  // Clear existing characters

  characterNames.forEach((name) => {
    const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension

    const img = document.createElement("img");
    img.src = `./images/${baseName}.png`;
    img.alt = baseName;
    img.addEventListener("click", () => selectCharacter(name));

    const li = document.createElement("li");
    li.appendChild(img);

    characterRow.appendChild(li);
  });
}

// Scroll function to move the character row left or right
function scrollCharacters(direction) {
  const characterRow = document.getElementById("character-row");
  const scrollAmount = 100; // Adjust scroll amount as needed
  characterRow.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

// Call this function to initialize the characters when the menu is opened
function showShapes() {
  if (gizmoManager.attachedMesh) {
    gizmoManager.attachedMesh.showBoundingBox = false;
    gizmoManager.attachedMesh
      .getChildMeshes()
      .forEach((child) => (child.showBoundingBox = false));
  }

  const dropdown = document.getElementById("shapes-dropdown");
  dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
  //loadModelImages(); // Load the models into the menu
  loadObjectImages(); // Load the objects into the menu
  loadMultiImages(); // Load the objects into the menu
  loadCharacterImages(); // Load the characters into the menu
}

// Close the shapes menu if the user clicks outside of it
document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("shapes-dropdown");

  // Guard against null dropdown in standalone environment
  if (!dropdown) return;

  const isClickInside = dropdown.contains(event.target);

  const isClickOnToggle =
    showShapesButton && showShapesButton.contains(event.target);

  if (!isClickInside && !isClickOnToggle) {
    dropdown.style.display = "none";
  }
});

function scrollModels(direction) {
  const modelRow = document.getElementById("model-row");
  const scrollAmount = 100; // Adjust as needed
  modelRow.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

function openAboutPage() {
  window.open("https://flockxr.com/", "_blank");
}

window.openAboutPage = openAboutPage;

export function enableGizmos() {
  const positionButton = document.getElementById("positionButton");
  const rotationButton = document.getElementById("rotationButton");
  const scaleButton = document.getElementById("scaleButton");
  //const boundsButton = document.getElementById("boundsButton");
  //const focusButton = document.getElementById("focusButton");
  const hideButton = document.getElementById("hideButton");
  const duplicateButton = document.getElementById("duplicateButton");
  const deleteButton = document.getElementById("deleteButton");
  const cameraButton = document.getElementById("cameraButton");
  const showShapesButton = document.getElementById("showShapesButton");
  const colorPickerButton = document.getElementById("colorPickerButton");
  const aboutButton = document.getElementById("logo");

  const scrollModelsLeftButton = document.getElementById(
    "scrollModelsLeftButton",
  );
  const scrollModelsRightButton = document.getElementById(
    "scrollModelsRightButton",
  );
  const scrollObjectsLeftButton = document.getElementById(
    "scrollObjectsLeftButton",
  );
  const scrollObjectsRightButton = document.getElementById(
    "scrollObjectsRightButton",
  );
  const scrollCharactersLeftButton = document.getElementById(
    "scrollCharactersLeftButton",
  );
  const scrollCharactersRightButton = document.getElementById(
    "scrollCharactersRightButton",
  );

  // Enable the buttons
  positionButton.removeAttribute("disabled");
  rotationButton.removeAttribute("disabled");
  scaleButton.removeAttribute("disabled");
  //boundsButton.removeAttribute("disabled");
  //focusButton.removeAttribute("disabled");
  hideButton.removeAttribute("disabled");
  duplicateButton.removeAttribute("disabled");
  deleteButton.removeAttribute("disabled");
  cameraButton.removeAttribute("disabled");
  showShapesButton.removeAttribute("disabled");
  colorPickerButton.removeAttribute("disabled");
  aboutButton.removeAttribute("disabled");

  scrollModelsLeftButton.removeAttribute("disabled");
  scrollModelsRightButton.removeAttribute("disabled");
  scrollObjectsLeftButton.removeAttribute("disabled");
  scrollObjectsRightButton.removeAttribute("disabled");
  scrollCharactersLeftButton.removeAttribute("disabled");
  scrollCharactersRightButton.removeAttribute("disabled");

  // Attach event listeners
  positionButton.addEventListener("click", () => toggleGizmo("position"));
  rotationButton.addEventListener("click", () => toggleGizmo("rotation"));
  scaleButton.addEventListener("click", () => toggleGizmo("scale"));
  //boundsButton.addEventListener("click", () => toggleGizmo("bounds"));
  //focusButton.addEventListener("click", () => toggleGizmo("focus"));
  hideButton.addEventListener("click", () => toggleGizmo("select"));
  cameraButton.addEventListener("click", () => toggleGizmo("camera"));
  duplicateButton.addEventListener("click", () => toggleGizmo("duplicate"));
  deleteButton.addEventListener("click", () => toggleGizmo("delete"));
  showShapesButton.addEventListener("click", showShapes);
  //aboutButton.addEventListener("click", openAboutPage);
  scrollModelsLeftButton.addEventListener("click", () => scrollModels(-1));
  scrollModelsRightButton.addEventListener("click", () => scrollModels(1));
  scrollObjectsLeftButton.addEventListener("click", () => scrollObjects(-1));
  scrollObjectsRightButton.addEventListener("click", () => scrollObjects(1));
  scrollCharactersLeftButton.addEventListener("click", () =>
    scrollCharacters(-1),
  );
  scrollCharactersRightButton.addEventListener("click", () =>
    scrollCharacters(1),
  );
}

// Shared function to load images into the menu
function loadImages(rowId, namesArray, selectCallback) {
  const row = document.getElementById(rowId);
  row.replaceChildren(); // Clear existing items

  namesArray.forEach((name) => {
    const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension

    const img = document.createElement("img");
    img.src = `./images/${baseName}.png`;
    img.alt = baseName;
    img.addEventListener("click", () => {
      // Use a global function or bind properly if needed
      window[selectCallback](name);
    });

    const li = document.createElement("li");
    li.appendChild(img);

    row.appendChild(li);
  });
}

// Refactored loadModelImages using the shared function
function loadMultiImages() {
  loadImages("model-row", multiObjectNames, "selectMultiObject");
}

// Refactored loadObjectImages using the shared function
function loadObjectImages() {
  loadImages("object-row", objectNames, "selectObject");
}

function scrollToBlockTopParentLeft(workspace, blockId) {
  if (!workspace.isMovable()) {
    console.warn(
      "Tried to move a non-movable workspace. This could result" +
        " in blocks becoming inaccessible.",
    );
    return;
  }

  const block = blockId ? workspace.getBlockById(blockId) : null;
  if (!block) {
    return;
  }

  // Find the ultimate parent block
  let ultimateParent = block;
  while (ultimateParent.getParent()) {
    ultimateParent = ultimateParent.getParent();
  }

  // Get the position of the target block (for top positioning)
  const blockXY = block.getRelativeToSurfaceXY();

  // Get the position of the ultimate parent (for left positioning)
  const parentXY = ultimateParent.getRelativeToSurfaceXY();

  // Workspace scale, used to convert from workspace coordinates to pixels
  const scale = workspace.scale;

  // Convert block positions to pixels
  const pixelBlockY = blockXY.y * scale;
  const pixelParentX = parentXY.x * scale;

  // Get metrics to determine padding
  const metrics = workspace.getMetrics();

  // Calculate desired scroll position
  // For Y: position block at top with some padding (20px)
  // For X: position parent at left with some padding (20px)
  const padding = 20;
  const scrollToY = pixelBlockY - padding;
  const scrollToX = pixelParentX - padding;

  // Convert to canvas directions (negative values)
  const x = -scrollToX;
  const y = -scrollToY;

  // Scroll the workspace
  workspace.scroll(x, y);
}

function highlightBlockById(workspace, block) {
  if (block) {
    // Select the new block
    if (window.codeMode === "both") {
      workspace.getAllBlocks().forEach((b) => b.unselect());
      block.select();

      // Scroll to position the block at the top and its parent at the left
      scrollToBlockTopParentLeft(workspace, block.id);
    }
  }
}

function focusCameraOnMesh() {
  let mesh = gizmoManager.attachedMesh;
  if (mesh && mesh.name === "ground") mesh = null;
  if (!mesh && window.currentMesh) {
    const blockKey = Object.keys(meshMap).find(
      (key) => meshMap[key] === window.currentBlock,
    );
    mesh = flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
  }
  if (!mesh) return;

  mesh.computeWorldMatrix(true);
  const boundingInfo = mesh.getBoundingInfo();
  const newTarget = boundingInfo.boundingBox.centerWorld; // Center of the new mesh
  const camera = flock.scene.activeCamera;

  if (camera.metadata && camera.metadata.following) {
    const player = camera.metadata.following; // The player (mesh) the camera is following
    const playerDistance = 5; // Fixed distance between player and target

    // Keep the player's original Y position
    const originalPlayerY = player.position.y;

    // Position the player further away from camera than the target
    player.position = new flock.BABYLON.Vector3(
      newTarget.x,
      originalPlayerY,
      newTarget.z + playerDistance, // Higher Z value to be further from camera
    );

    // Calculate direction to target
    const directionToTarget = newTarget.subtract(player.position);
    directionToTarget.normalize();

    // Calculate the angle to face the target
    let angle = Math.atan2(directionToTarget.x, directionToTarget.z);

    // Set player rotation directly
    player.rotation.y = angle;

    // Calculate camera position behind the player
    const cameraDistance = camera.radius;
    const cameraPosition = new flock.BABYLON.Vector3(
      player.position.x,
      player.position.y + camera.radius * 0.3, // Slight elevation for better view
      player.position.z + cameraDistance, // Camera is now behind player (higher Z)
    );

    // Update camera position and target
    camera.setPosition(cameraPosition);
    camera.setTarget(player.position);
  } else {
    // For other types of cameras
    const currentDistance = camera.radius || 10;
    const currentYPosition = camera.position.y;

    // Position camera in front of the mesh
    const newCameraPosition = new flock.BABYLON.Vector3(
      newTarget.x,
      currentYPosition,
      newTarget.z - currentDistance, // Camera closer to screen than target
    );

    camera.position = newCameraPosition;
    camera.setTarget(newTarget);
  }
}

function findParentWithBlockId(mesh) {
  let currentNode = mesh;
  while (currentNode) {
    if (currentNode.blockKey !== undefined) {
      return currentNode;
    }
    currentNode = currentNode.parent;
  }

  return null;
}

function deleteBlockWithUndo(blockId) {
  const workspace = Blockly.getMainWorkspace();
  const block = workspace.getBlockById(blockId);

  if (block) {
    Blockly.Events.setGroup(true);
    try {
      const parentBlock = block.getParent();

      // Store reference to parent block before deletion
      let shouldCheckStartBlock = false;
      let startBlock = null;
      if (parentBlock && parentBlock.type === "start") {
        startBlock = parentBlock;
        shouldCheckStartBlock = true;
      }

      // Delete the selected block
      block.dispose(true);

      // After deletion, check if the start block is now empty
      if (shouldCheckStartBlock && startBlock) {
        let remainingChildren = 0;

        // Count remaining input-connected blocks
        startBlock.inputList.forEach((input) => {
          if (input.connection && input.connection.targetBlock()) {
            remainingChildren++;
          }
        });

        // Check if the start block still has a next block
        if (
          startBlock.nextConnection &&
          startBlock.nextConnection.targetBlock()
        ) {
          remainingChildren++;
        }

        // If no children remain, delete the start block
        if (remainingChildren === 0) {
          startBlock.dispose(true);
        }
      }
    } finally {
      Blockly.Events.setGroup(false);
    }

    gizmoManager.attachToMesh(null);
    turnOffAllGizmos();
  } else {
    console.log(`Block with ID ${blockId} not found.`);
  }
}

let cameraMode = "play";

function toggleGizmo(gizmoType) {
  // Disable all gizmos
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;

  if (gizmoManager.attachedMesh) {
    gizmoManager.attachedMesh.showBoundingBox = false;
    gizmoManager.attachedMesh
      .getChildMeshes()
      .forEach((child) => (child.showBoundingBox = false));
  }

  document.body.style.cursor = "default";

  let blockKey, blockId, canvas, onPickMesh;

  // Enable the selected gizmo
  switch (gizmoType) {
    case "camera":
      if (cameraMode === "play") {
        cameraMode = "fly";
        flock.printText(
          "Fly camera, use arrow keys and page up/down",
          15,
          "white",
        );
      } else {
        cameraMode = "play";
      }

      let currentCamera = flock.scene.activeCamera;
      console.log("Camera", flock.savedCamera);
      flock.scene.activeCamera = flock.savedCamera;
      flock.savedCamera = currentCamera;
      break;
    case "delete":
      blockKey = findParentWithBlockId(gizmoManager.attachedMesh).blockKey;
      blockId = meshBlockIdMap[blockKey];

      //console.log("Delete", blockKey, meshMap);
      deleteBlockWithUndo(blockId);
      break;
    case "duplicate":
      blockKey = findParentWithBlockId(gizmoManager.attachedMesh).blockKey;
      blockId = meshBlockIdMap[blockKey];

      document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

      canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the flock.BABYLON.js canvas

      onPickMesh = function (event) {
        const canvasRect = canvas.getBoundingClientRect();

        if (
          event.clientX < canvasRect.left ||
          event.clientX > canvasRect.right ||
          event.clientY < canvasRect.top ||
          event.clientY > canvasRect.bottom
        ) {
          window.removeEventListener("click", onPickMesh);
          document.body.style.cursor = "default";
          return;
        }

        const canvasX = event.clientX - canvasRect.left;
        const canvasY = event.clientY - canvasRect.top;

        const pickRay = flock.scene.createPickingRay(
          canvasX,
          canvasY,
          flock.BABYLON.Matrix.Identity(),
          flock.scene.activeCamera,
        );

        const pickResult = flock.scene.pickWithRay(
          pickRay,
          (mesh) => mesh.isPickable,
        );

        if (pickResult.hit) {
          const pickedPosition = pickResult.pickedPoint;

          const workspace = Blockly.getMainWorkspace();
          const originalBlock = workspace.getBlockById(blockId);

          //console.log("Duplicate", blockKey, meshMap);
          if (originalBlock) {
            // Serialize the block and its children, including shadows

            Blockly.Events.setGroup("duplicate");
            const blockJson = Blockly.serialization.blocks.save(originalBlock, {
              includeShadows: true, // Include shadow blocks in the duplication
            });

            // Remove the "next" connection from the serialized JSON
            if (blockJson.next) {
              delete blockJson.next;
            }
            // Append the duplicated block and its children
            const duplicateBlock = Blockly.serialization.blocks.append(
              blockJson,
              workspace,
            );

            setPositionValues(
              duplicateBlock,
              pickedPosition,
              duplicateBlock.type,
            );

            // Connect the new block as the next block
            if (
              originalBlock.nextConnection &&
              duplicateBlock.previousConnection
            ) {
              originalBlock.nextConnection.connect(
                duplicateBlock.previousConnection,
              );
            } else {
              // If no connection, visually position it
              duplicateBlock.moveBy(50, 50);
            }

            Blockly.Events.setGroup(false);

            // Initialise and render the duplicated block
            duplicateBlock.initSvg();
            duplicateBlock.render();
          }
        }
      };

      // Use setTimeout to defer listener setup
      document.body.style.cursor = "crosshair";
      setTimeout(() => {
        window.addEventListener("click", onPickMesh);
      }, 50);

      break;
    case "select": {
      gizmoManager.selectGizmoEnabled = true;

      // Store the pointer observable
      const pointerObservable = flock.scene.onPointerObservable;

      // Add the observer
      const pointerObserver = pointerObservable.add((event) => {
        if (event.type === flock.BABYLON.PointerEventTypes.POINTERPICK) {
          if (gizmoManager.attachedMesh) {
            gizmoManager.attachedMesh.showBoundingBox = false;
            gizmoManager.attachedMesh
              .getChildMeshes()
              .forEach((child) => (child.showBoundingBox = false));
            blockKey = findParentWithBlockId(
              gizmoManager.attachedMesh,
            ).blockKey;
          }
          const pickedMesh = event.pickInfo.pickedMesh;

          if (pickedMesh && pickedMesh.name !== "ground") {
            // Assuming 'mesh' is your Babylon.js mesh object
            const position = pickedMesh.getAbsolutePosition();

            // Round the coordinates to 2 decimal places
            const roundedPosition = new BABYLON.Vector3(
              parseFloat(position.x.toFixed(2)),
              parseFloat(position.y.toFixed(2)),
              parseFloat(position.z.toFixed(2)),
            );
            flock.printText("Position: " + roundedPosition, 30, "black");

            const block = meshMap[blockKey];
            highlightBlockById(Blockly.getMainWorkspace(), block);

            // Attach the gizmo to the selected mesh
            gizmoManager.attachToMesh(pickedMesh);

            // Show bounding box for the selected mesh
            pickedMesh.showBoundingBox = true;
          } else {
            if (pickedMesh && pickedMesh.name === "ground") {
              const position = event.pickInfo.pickedPoint;

              // Round the coordinates to 2 decimal places
              const roundedPosition = new BABYLON.Vector3(
                parseFloat(position.x.toFixed(2)),
                parseFloat(position.y.toFixed(2)),
                parseFloat(position.z.toFixed(2)),
              );
              flock.printText("Position: " + roundedPosition, 30, "black");
            }

            // Deselect if no mesh is picked
            if (gizmoManager.attachedMesh) {
              gizmoManager.attachedMesh
                .getChildMeshes()
                .forEach((child) => (child.showBoundingBox = false));
              gizmoManager.attachToMesh(null); // Detach the gizmo
            }
          }

          pointerObservable.remove(pointerObserver);
        }
      });

      break;
    }
    case "bounds":
      gizmoManager.boundingBoxGizmoEnabled = true;
      gizmoManager.boundingBoxDragBehavior.onDragStartObservable.add(
        function () {
          const mesh = gizmoManager.attachedMesh;

          const motionType = mesh.physics.getMotionType();
          mesh.savedMotionType = motionType;

          if (
            mesh.physics &&
            mesh.physics.getMotionType() !=
              flock.BABYLON.PhysicsMotionType.STATIC
          ) {
            mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.STATIC);
            mesh.physics.disablePreStep = false;
          }

          const block = meshMap[mesh.blockKey];

          highlightBlockById(Blockly.getMainWorkspace(), block);
        },
      );

      gizmoManager.boundingBoxDragBehavior.onDragEndObservable.add(function () {
        // Retrieve the mesh associated with the bb gizmo
        const mesh = gizmoManager.attachedMesh;

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        mesh.computeWorldMatrix(true);

        const block = meshMap[mesh.blockKey];

        let meshY = mesh.position.y;

        if (
          mesh.metadata &&
          mesh.metadata.yOffset &&
          mesh.metadata.yOffset != 0
        ) {
          const scale = block
            .getInput("SCALE")
            .connection.targetBlock()
            .getFieldValue("NUM");

          meshY -= scale * mesh.metadata.yOffset;
        }

        if (block) {
          block
            .getInput("X")
            .connection.targetBlock()
            .setFieldValue(
              String(Math.round(mesh.position.x * 10) / 10),
              "NUM",
            );
          block
            .getInput("Y")
            .connection.targetBlock()
            .setFieldValue(String(Math.round(meshY * 10) / 10), "NUM");
          block
            .getInput("Z")
            .connection.targetBlock()
            .setFieldValue(
              String(Math.round(mesh.position.z * 10) / 10),
              "NUM",
            );
        }
      });

      break;

    case "position":
      gizmoManager.positionGizmoEnabled = true;
      gizmoManager.gizmos.positionGizmo.snapDistance = 0.1;
      gizmoManager.gizmos.positionGizmo.xGizmo._coloredMaterial.diffuseColor =
        blueColor;
      gizmoManager.gizmos.positionGizmo.yGizmo._coloredMaterial.diffuseColor =
        greenColor;
      gizmoManager.gizmos.positionGizmo.zGizmo._coloredMaterial.diffuseColor =
        orangeColor;
      gizmoManager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;
      gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(function () {
        const mesh = gizmoManager.attachedMesh;
        const motionType = mesh.physics?.getMotionType();
        mesh.savedMotionType = motionType;

        if (
          mesh.physics &&
          motionType &&
          motionType != flock.BABYLON.PhysicsMotionType.ANIMATED
        ) {
          mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
          mesh.physics.disablePreStep = false;
        }

        const block = meshMap[mesh.blockKey];

        highlightBlockById(Blockly.getMainWorkspace(), block);
      });
      gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(function () {
        // Retrieve the mesh associated with the position gizmo
        const mesh = gizmoManager.attachedMesh;

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }
        mesh.computeWorldMatrix(true);

        const block = meshMap[mesh.blockKey];

        let meshY = mesh.position.y;

        if (mesh.metadata?.yOffset && mesh.metadata.yOffset != 0) {
          try {
            const scale = block
              .getInput("SCALE")
              .connection.targetBlock()
              .getFieldValue("NUM");

            meshY -= scale * mesh.metadata.yOffset;
          } catch (e) {}
        }

        if (block) {
          try {
            block
              .getInput("X")
              .connection.targetBlock()
              .setFieldValue(
                String(Math.round(mesh.position.x * 10) / 10),
                "NUM",
              );
          } catch (e) {}
          try {
            meshY -=
              mesh.getBoundingInfo().boundingBox.extendSize.y * mesh.scaling.y;
            block
              .getInput("Y")
              .connection.targetBlock()
              .setFieldValue(String(Math.round(meshY * 10) / 10), "NUM");
          } catch (e) {}
          try {
            block
              .getInput("Z")
              .connection.targetBlock()
              .setFieldValue(
                String(Math.round(mesh.position.z * 10) / 10),
                "NUM",
              );
          } catch (e) {}
        }
      });

      break;
    case "rotation":
      gizmoManager.rotationGizmoEnabled = true;
      gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      gizmoManager.gizmos.rotationGizmo.xGizmo._coloredMaterial.diffuseColor =
        blueColor;
      gizmoManager.gizmos.rotationGizmo.yGizmo._coloredMaterial.diffuseColor =
        greenColor;
      gizmoManager.gizmos.rotationGizmo.zGizmo._coloredMaterial.diffuseColor =
        orangeColor;

      gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(function () {
        let mesh = gizmoManager.attachedMesh;
        while (mesh.parent && !mesh.parent.physicsImpostor) {
          mesh = mesh.parent;
        }

        const motionType =
          mesh.physics.getMotionType() ||
          flock.BABYLON.PhysicsMotionType.STATIC;
        mesh.savedMotionType = motionType;

        if (
          mesh.physics &&
          mesh.physics.getMotionType() !=
            flock.BABYLON.PhysicsMotionType.ANIMATED
        ) {
          mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
          mesh.physics.disablePreStep = false;
        }

        const block = meshMap[mesh.blockKey];

        highlightBlockById(Blockly.getMainWorkspace(), block);
      });

      gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(function () {
        let mesh = gizmoManager.attachedMesh;
        while (mesh.parent && !mesh.parent.physics) {
          mesh = mesh.parent;
        }

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        const block = meshMap[mesh.blockKey];

        //console.log("Rotating", mesh, blockKey, meshMap);
        if (!block) {
          return;
        }

        //console.log("Rotating", block);
        if (!block.getInput("DO")) {
          block.appendStatementInput("DO").setCheck(null).appendField("");
        }

        // Check if the 'rotate_to' block already exists in the 'DO' section
        let rotateBlock = null;
        let modelVariable = block.getFieldValue("ID_VAR");
        const statementConnection = block.getInput("DO").connection;
        if (statementConnection && statementConnection.targetBlock()) {
          // Iterate through the blocks in the 'do' section to find 'rotate_to'
          let currentBlock = statementConnection.targetBlock();
          while (currentBlock) {
            if (currentBlock.type === "rotate_to") {
              const modelField = currentBlock.getFieldValue("MODEL");
              if (modelField === modelVariable) {
                rotateBlock = currentBlock;
                break;
              }
            }
            currentBlock = currentBlock.getNextBlock();
          }
        }

        // Create a new 'rotate_to' block if it doesn't exist
        if (!rotateBlock) {
          rotateBlock = Blockly.getMainWorkspace().newBlock("rotate_to");
          rotateBlock.setFieldValue(modelVariable, "MODEL");
          rotateBlock.initSvg();
          rotateBlock.render();

          // Add shadow blocks for X, Y, Z inputs
          ["X", "Y", "Z"].forEach((axis) => {
            const input = rotateBlock.getInput(axis);
            const shadowBlock =
              Blockly.getMainWorkspace().newBlock("math_number");
            shadowBlock.setShadow(true);
            shadowBlock.initSvg();
            shadowBlock.render();
            input.connection.connect(shadowBlock.outputConnection);
          });

          rotateBlock.render(); // Render the new block
          // Connect the new 'rotate_to' block to the 'do' section
          block
            .getInput("DO")
            .connection.connect(rotateBlock.previousConnection);
        }

        function getEulerAnglesFromQuaternion(quaternion) {
          const euler = quaternion.toEulerAngles(); // Converts quaternion to Euler angles
          return {
            x: Math.round(euler.x * (180 / Math.PI) * 10) / 10,
            y: Math.round(euler.y * (180 / Math.PI) * 10) / 10,
            z: Math.round(euler.z * (180 / Math.PI) * 10) / 10,
          };
        }

        // Get the correct rotation values, checking for quaternion
        let rotationX = 0,
          rotationY = 0,
          rotationZ = 0;
        if (mesh.rotationQuaternion) {
          // If using quaternion, convert it to Euler angles
          const rotation = getEulerAnglesFromQuaternion(
            mesh.rotationQuaternion,
          );
          rotationX = rotation.x;
          rotationY = rotation.y;
          rotationZ = rotation.z;
        } else {
          // If using standard Euler rotation
          rotationX = Math.round(mesh.rotation.x * (180 / Math.PI) * 10) / 10;
          rotationY = Math.round(mesh.rotation.y * (180 / Math.PI) * 10) / 10;
          rotationZ = Math.round(mesh.rotation.z * (180 / Math.PI) * 10) / 10;
        }

        // Helper to update the value of the connected block or shadow block
        function setRotationValue(inputName, value) {
          const input = rotateBlock.getInput(inputName);
          const connectedBlock = input.connection.targetBlock();

          if (connectedBlock) {
            connectedBlock.setFieldValue(String(value), "NUM");
          }
        }

        // Set the rotation values (X, Y, Z)
        setRotationValue("X", rotationX);
        setRotationValue("Y", rotationY);
        setRotationValue("Z", rotationZ);
      });

      break;

    case "scale":
      gizmoManager.scaleGizmoEnabled = true;
      gizmoManager.gizmos.scaleGizmo.PreserveScaling = true;
      gizmoManager.gizmos.scaleGizmo.xGizmo._coloredMaterial.diffuseColor =
        blueColor;
      gizmoManager.gizmos.scaleGizmo.yGizmo._coloredMaterial.diffuseColor =
        greenColor;
      gizmoManager.gizmos.scaleGizmo.zGizmo._coloredMaterial.diffuseColor =
        orangeColor;

      gizmoManager.gizmos.scaleGizmo.sensitivity = 4;

      // Track bottom for correct visual anchoring
      let originalBottomY = 0;

      gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add(() => {
        const mesh = gizmoManager.attachedMesh;
        flock.ensureUniqueGeometry(mesh);
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        originalBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;

        const motionType = mesh.physics?.getMotionType();
        mesh.savedMotionType = motionType;

        if (
          mesh.physics &&
          mesh.physics.getMotionType() !==
            flock.BABYLON.PhysicsMotionType.ANIMATED
        ) {
          mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
          mesh.physics.disablePreStep = false;
        }

        const block = meshMap[mesh.blockKey];
        highlightBlockById(Blockly.getMainWorkspace(), block);
      });

      gizmoManager.gizmos.scaleGizmo.onDragObservable.add(() => {
        const mesh = gizmoManager.attachedMesh;

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();

        const newBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
        const deltaY = originalBottomY - newBottomY;
        mesh.position.y += deltaY;

        const block = Blockly.getMainWorkspace().getBlockById(mesh.blockKey);
        if (gizmoManager.scaleGizmoEnabled) {
          switch (block?.type) {
            case "create_capsule":
            case "create_cylinder":
              mesh.scaling.z = mesh.scaling.x;
              break;
          }
        }
      });

      gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(() => {
        const mesh = gizmoManager.attachedMesh;
        const block = meshMap[mesh.blockKey];

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        try {
          // Ensure world matrix and bounding info are current
          mesh.computeWorldMatrix(true);
          mesh.refreshBoundingInfo();

          const newBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
          const deltaY = originalBottomY - newBottomY;
          mesh.position.y += deltaY;

          const originalSize = mesh
            .getBoundingInfo()
            .boundingBox.extendSize.scale(2);

          const newWidth =
            Math.round(originalSize.x * mesh.scaling.x * 10) / 10;
          const newHeight =
            Math.round(originalSize.y * mesh.scaling.y * 10) / 10;
          const newDepth =
            Math.round(originalSize.z * mesh.scaling.z * 10) / 10;

          switch (block.type) {
            case "create_plane":
              block
                .getInput("WIDTH")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              break;

            case "create_box":
              block
                .getInput("WIDTH")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              block
                .getInput("DEPTH")
                .connection.targetBlock()
                .setFieldValue(String(newDepth), "NUM");
              break;

            case "create_capsule":
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              block
                .getInput("DIAMETER")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              break;

            case "create_cylinder": {
              const boundingInfo = mesh.getBoundingInfo();
              const originalSize = boundingInfo.boundingBox.extendSize.scale(2);
              mesh.computeWorldMatrix(true);

              let newCylinderHeight = mesh.scaling.y * originalSize.y;
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(
                  String(Math.round(newCylinderHeight * 10) / 10),
                  "NUM",
                );

              let newScaledDiameter =
                Math.round(originalSize.x * mesh.scaling.x * 10) / 10;

              let currentTop = parseFloat(
                block
                  .getInput("DIAMETER_TOP")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );
              let currentBottom = parseFloat(
                block
                  .getInput("DIAMETER_BOTTOM")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );

              if (currentTop >= currentBottom) {
                let newTop = newScaledDiameter;
                let ratio = currentBottom / currentTop;
                let newBottom = Math.round(newTop * ratio * 10) / 10;
                block
                  .getInput("DIAMETER_TOP")
                  .connection.targetBlock()
                  .setFieldValue(String(newTop), "NUM");
                block
                  .getInput("DIAMETER_BOTTOM")
                  .connection.targetBlock()
                  .setFieldValue(String(newBottom), "NUM");
              } else {
                let newBottom = newScaledDiameter;
                let ratio = currentTop / currentBottom;
                let newTop = Math.round(newBottom * ratio * 10) / 10;
                block
                  .getInput("DIAMETER_BOTTOM")
                  .connection.targetBlock()
                  .setFieldValue(String(newBottom), "NUM");
                block
                  .getInput("DIAMETER_TOP")
                  .connection.targetBlock()
                  .setFieldValue(String(newTop), "NUM");
              }
              break;
            }

            case "create_sphere":
              block
                .getInput("DIAMETER_X")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              block
                .getInput("DIAMETER_Y")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              block
                .getInput("DIAMETER_Z")
                .connection.targetBlock()
                .setFieldValue(String(newDepth), "NUM");
              break;

            case "load_multi_object":
            case "load_object":
            case "load_character": {
              if (!block.getInput("DO")) {
                block.appendStatementInput("DO").setCheck(null).appendField("");
              }

              let scaleBlock = null;
              let modelVariable = block.getFieldValue("ID_VAR");
              const statementConnection = block.getInput("DO").connection;
              if (statementConnection && statementConnection.targetBlock()) {
                let currentBlock = statementConnection.targetBlock();
                while (currentBlock) {
                  if (currentBlock.type === "scale") {
                    const modelField = currentBlock.getFieldValue("BLOCK_NAME");
                    if (modelField === modelVariable) {
                      scaleBlock = currentBlock;
                      break;
                    }
                  }
                  currentBlock = currentBlock.getNextBlock();
                }
              }

              if (!scaleBlock) {
                scaleBlock = Blockly.getMainWorkspace().newBlock("scale");
                scaleBlock.setFieldValue(modelVariable, "BLOCK_NAME");
                scaleBlock.initSvg();
                scaleBlock.render();

                ["X", "Y", "Z"].forEach((axis) => {
                  const input = scaleBlock.getInput(axis);
                  const shadowBlock =
                    Blockly.getMainWorkspace().newBlock("math_number");
                  shadowBlock.setFieldValue("1", "NUM");
                  shadowBlock.setShadow(true);
                  shadowBlock.initSvg();
                  shadowBlock.render();
                  input.connection.connect(shadowBlock.outputConnection);
                });

                scaleBlock.render();
                block
                  .getInput("DO")
                  .connection.connect(scaleBlock.previousConnection);
              }

              function setScaleValue(inputName, value) {
                const input = scaleBlock.getInput(inputName);
                const connectedBlock = input.connection.targetBlock();

                if (connectedBlock) {
                  connectedBlock.setFieldValue(String(value), "NUM");
                }
              }

              const scaleX = Math.round(mesh.scaling.x * 10) / 10;
              const scaleY = Math.round(mesh.scaling.y * 10) / 10;
              const scaleZ = Math.round(mesh.scaling.z * 10) / 10;

              setScaleValue("X", scaleX);
              setScaleValue("Y", scaleY);
              setScaleValue("Z", scaleZ);
              break;
            }
          }
        } catch (e) {
          console.error("Error updating block values:", e);
        }
      });

      break;
    case "boundingBox":
      gizmoManager.boundingBoxGizmoEnabled = true;

      break;
    case "focus":
      focusCameraOnMesh();
      break;
    default:
      break;
  }
}

window.toggleGizmo = toggleGizmo;

function turnOffAllGizmos() {
  if (gizmoManager.attachedMesh) {
    gizmoManager.attachedMesh.showBoundingBox = false;
    gizmoManager.attachedMesh
      .getChildMeshes()
      .forEach((child) => (child.showBoundingBox = false));
  }
  gizmoManager.attachToMesh(null);
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;
}

window.turnOffAllGizmos = turnOffAllGizmos;

const characterMaterials = [
  "Hair",
  "Skin",
  "Eyes",
  "Sleeves",
  "Shorts",
  "TShirt",
];

function updateBlockColorAndHighlight(mesh, selectedColor) {
  let block = null;
  let materialName = null;
  let colorIndex, ultimateParent;

  if (!mesh) {
    block = meshMap["sky"];

    block
      .getInput("COLOR")
      .connection.targetBlock()
      .setFieldValue(selectedColor, "COLOR");

    return;
  } else {
    materialName = mesh?.material?.name?.replace(/_clone$/, "");
    colorIndex = mesh.metadata.materialIndex;
    ultimateParent = (mesh) =>
      mesh.parent ? ultimateParent(mesh.parent) : mesh;
  }

  if (mesh && materialName) {
    /*console.log("Looking up block", mesh.name, ultimateParent(mesh).blockKey);*/
    block = meshMap[ultimateParent(mesh).blockKey];

    if (!block) {
      console.error(
        "Block not found for mesh:",
        mesh.name,
        ultimateParent(mesh).blockKey,
        mesh.name,
        ultimateParent(mesh).name,
        meshMap,
      );

      return;
    }

    if (characterMaterials.includes(materialName)) {
      // Update the corresponding character submesh color field (e.g., HAIR_COLOR, SKIN_COLOR)

      const materialToFieldMap = {
        Hair: "HAIR_COLOR",
        Skin: "SKIN_COLOR",
        Eyes: "EYES_COLOR",
        Sleeves: "SLEEVES_COLOR",
        Shorts: "SHORTS_COLOR",
        TShirt: "TSHIRT_COLOR",
      };

      const fieldName = materialToFieldMap[materialName];

      if (fieldName) {
        // Update the corresponding character color field in the block
        Blockly.Events.setGroup(true);
        block
          .getInput(fieldName)
          .connection.targetBlock()
          .setFieldValue(selectedColor, "COLOR");
        Blockly.Events.setGroup(false);
      } else {
        console.error("No matching field for material:", materialName);
      }
    } else if (block.type === "load_multi_object") {
      block.updateColorAtIndex(selectedColor, colorIndex);
    } else {
      // For load_object blocks, check if we should use config default instead of purple
      if (block.type === "load_object" && selectedColor === "#9932cc") {
        const modelName = block.getFieldValue("MODELS");
        const configColor = objectColours[modelName] || "#FFD700";
        block
          .getInput("COLOR")
          .connection.targetBlock()
          .setFieldValue(configColor, "COLOR");
      } else {
        block
          .getInput("COLOR")
          .connection.targetBlock()
          .setFieldValue(selectedColor, "COLOR");
      }
    }
  }

  block?.initSvg();

  highlightBlockById(Blockly.getMainWorkspace(), block);
}

export function setGizmoManager(value) {
  gizmoManager = value;

  const originalAttach = gizmoManager.attachToMesh.bind(gizmoManager);
  gizmoManager.attachToMesh = (mesh) => {
    if (mesh && mesh.name === "ground") {
      turnOffAllGizmos();
      mesh = null;
    }

    if (gizmoManager.attachedMesh) {
      gizmoManager.attachedMesh.showBoundingBox = false;
      gizmoManager.attachedMesh
        .getChildMeshes()
        .forEach((child) => (child.showBoundingBox = false));

      if (mesh) {
        while (mesh && mesh.parent && !mesh.parent.physics) {
          mesh = mesh.parent;
        }

        const block = Blockly.getMainWorkspace().getBlockById(mesh.blockKey);

        if (block && gizmoManager.scaleGizmoEnabled) {
          switch (block.type) {
            case "create_plane":
            case "create_capsule":
            case "create_cylinder":
              gizmoManager.gizmos.scaleGizmo.zGizmo.isEnabled = false;

              break;

            default:
              gizmoManager.gizmos.scaleGizmo.zGizmo.isEnabled = true;
          }
        }
      }
    }

    if (mesh && mesh.physics) {
      mesh.physics.disablePreStep = false;
    }

    if (mesh) {
      const block = meshMap[mesh.blockKey];
      //highlightBlockById(Blockly.getMainWorkspace(), block);
    }
    originalAttach(mesh);
  };

  const canvas = flock.scene.getEngine().getRenderingCanvas();

  // Add event listener for keydown events on the canvas
  canvas.addEventListener("keydown", function (event) {
    if (event.keyCode === 46) {
      // KeyCode for 'Delete' key is 46
      // Handle delete action

      const blockKey = findParentWithBlockId(
        gizmoManager.attachedMesh,
      ).blockKey;
      const blockId = meshBlockIdMap[blockKey];

      //console.log("Delete", blockKey, meshMap);
      deleteBlockWithUndo(blockId);
    }
  });
}

export function disposeGizmoManager() {
  if (gizmoManager) {
    gizmoManager.dispose();
    gizmoManager = null; // Clear the global reference for garbage collection
  }
}
