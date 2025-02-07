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

export function updateOrCreateMeshFromBlock(block, changeEvent) {
  if (window.loadingCode || block.disposed) return;

  if (
    (changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
      block.id === changeEvent.blockId) ||
    block.id ===
      Blockly.getMainWorkspace().getBlockById(changeEvent.blockId)?.getParent()
        ?.id
  ) {
    const mesh = getMeshFromBlock(block);

    if (mesh) {
      updateMeshFromBlock(mesh, block, changeEvent);
    }
  } else {
    if (
      changeEvent.type === Blockly.Events.BLOCK_CREATE &&
      block.id === changeEvent.blockId
    ) {
      createMeshOnCanvas(block);
    }
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
      flock.scene.activeCamera
    );

    // Perform the picking
    const pickResult = flock.scene.pickWithRay(
      pickRay,
      (mesh) => mesh.isPickable
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
    (key) => meshBlockIdMap[key] === blockId
  );

  //console.log("Deleting mesh from block:", blockId, blockKey, meshBlockIdMap, mesh);

  if (blockKey) {
    // Remove mappings
    delete meshMap[blockKey];
    delete meshBlockIdMap[blockKey];
  }

  //console.log("Mesh map after deletion:", blockId, blockKey, meshMap)

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

export function updateMeshFromBlock(mesh, block) {
  //console.log("Update mesh from block");
  const shapeType = block.type;

  if (mesh && mesh.physics) mesh.physics.disablePreStep = true;

  let color, modelName;

  if (
    !["load_model", "load_multi_object", "load_character"].includes(block.type)
  ) {
    color = block
      .getInput("COLOR")
      .connection.targetBlock()
      .getFieldValue("COLOR");
  }

  if (block.type.startsWith("load_")) {
    let scale = block
      .getInput("SCALE")
      .connection.targetBlock()
      .getFieldValue("NUM");
  }

  // Retrieve the position values (X, Y, Z) from the connected blocks
  const position = {
    x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
    y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
    z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
  };

  flock.positionAt(mesh.name, position.x, position.y, position.z, false);

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
    radius,
    planeWidth,
    planeHeight;
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

      console.log("Need to handle update of object", modelName);

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
      console.log("Need to handle update of model");
      break;
    case "load_multi_object":
      console.log("Need to handle update of multi model");
      break;
    case "load_character":
      modelName = block.getFieldValue("MODELS");
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
        sides
      );
      break;

    case "create_capsule":
      // Retrieve radius and height from connected blocks
      radius = block
        .getInput("RADIUS")
        .connection.targetBlock()
        .getFieldValue("NUM");
      capsuleHeight = block
        .getInput("HEIGHT")
        .connection.targetBlock()
        .getFieldValue("NUM");

      // Set the absolute size of the capsule
      setAbsoluteSize(mesh, radius * 2, capsuleHeight, radius * 2);
      break;

    case "create_plane":
      // Retrieve width and height from connected blocks
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
      break;

    default:
      console.warn(`Unknown shape type: ${shapeType}`);
  }

  // Use flock API to change the color and position of the mesh
  if (color) {
    color = flock.getColorFromString(color);
    flock.changeColor(mesh.name, color);
  }
}

function createMeshOnCanvas(block) {
  //console.log("Create mesh on canvas", block.id);

  Blockly.Events.setGroup(true);

  let shapeType = block.type;
  let position, scale, color, modelName, newMesh;

  // Retrieve position for all block types
  position = {
    x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
    y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
    z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
  };

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
    capsuleRadius,
    planeWidth,
    planeHeight;
  // Handle block types
  switch (shapeType) {
    // --- Model Loading Blocks ---
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

      meshId = modelName + "_" + generateUniqueId();
      // Use flock API for characters

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

    case "load_multi_object":
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

      newMesh = flock.createBox(
        `box__${block.id}`,
        color,
        width,
        height,
        depth,
        [position.x, position.y, position.z]
      );

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

      newMesh = flock.createSphere(
        `sphere__${block.id}`,
        color,
        diameterX,
        diameterY,
        diameterZ,
        [position.x, position.y, position.z]
      );
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

      newMesh = flock.createCylinder(
        `cylinder__${block.id}`,
        color,
        cylinderHeight,
        diameterTop,
        diameterBottom,
        24,
        [position.x, position.y, position.z]
      );
      break;

    case "create_capsule":
      color = block
        .getInput("COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR");
      capsuleRadius = block
        .getInput("RADIUS")
        .connection.targetBlock()
        .getFieldValue("NUM");
      capsuleHeight = block
        .getInput("HEIGHT")
        .connection.targetBlock()
        .getFieldValue("NUM");

      newMesh = flock.createCapsule(
        `capsule__${block.id}`,
        color,
        capsuleRadius,
        capsuleHeight,
        [position.x, position.y, position.z]
      );
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

      newMesh = flock.createPlane(
        `plane__${block.id}`,
        color,
        planeWidth,
        planeHeight,
        [position.x, position.y, position.z]
      );
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
  const boundingInfo = mesh.getBoundingInfo();
  const originalSize = boundingInfo.boundingBox.extendSize;

  mesh.scaling.x = width / (originalSize.x * 2);
  mesh.scaling.y = height / (originalSize.y * 2);
  mesh.scaling.z = depth === 0 ? 1 : depth / (originalSize.z * 2);

  let shapeType = null;

  if (mesh.metadata) shapeType = mesh.metadata.shapeType;

  if (mesh.physics && shapeType) {
    const shape = mesh.physics.shape;
    let newShape, diameterBottom, startPoint, endPoint, radius;

    // Create the new physics shape based on the type
    switch (shapeType) {
      case "Box":
        newShape = new flock.BABYLON.PhysicsShapeBox(
          new flock.BABYLON.Vector3(0, 0, 0),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          new flock.BABYLON.Vector3(width, height, depth),
          mesh.getScene()
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
          mesh.getScene()
        );
        break;

      case "Sphere":
        newShape = new flock.BABYLON.PhysicsShapeSphere(
          new flock.BABYLON.Vector3(0, 0, 0),
          Math.max(width, depth, height) / 2,
          mesh.getScene()
        );
        break;

      case "Capsule":
        radius = Math.min(width, depth) / 2;
        newShape = new flock.BABYLON.PhysicsShapeCapsule(
          new flock.BABYLON.Vector3(0, 0, 0),
          radius, // Radius of the spherical ends
          height / 2, // Half the height of the cylindrical part
          mesh.getScene()
        );
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
  sides
) {
  // If the mesh has geometry, dispose of it before updating
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  // Create a temporary mesh to generate the vertex data for the updated cylinder
  const tempMesh = flock.BABYLON.MeshBuilder.CreateCylinder(
    "",
    {
      height: height,
      diameterTop: diameterTop,
      diameterBottom: diameterBottom,
      tessellation: sides,
      updatable: true,
    },
    mesh.getScene()
  );

  // Extract vertex data from the temporary mesh
  const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(tempMesh);

  // Create new geometry for the mesh
  const newGeometry = new flock.BABYLON.Geometry(
    mesh.name + "_geometry",
    mesh.getScene(),
    vertexData,
    true,
    mesh
  );

  // Apply the new geometry to the mesh
  newGeometry.applyToMesh(mesh);
  mesh.makeGeometryUnique();
  // Dispose of the temporary mesh after extracting vertex data
  tempMesh.dispose();
}

// Helper function to create and attach shadow blocks
function addShadowBlock(block, inputName, blockType, defaultValue) {
  const shadowBlock = Blockly.getMainWorkspace().newBlock(blockType);

  // Determine the correct field based on block type
  const fieldName = blockType === "colour" ? "COLOR" : "NUM";

  shadowBlock.setFieldValue(String(defaultValue), fieldName);
  shadowBlock.setShadow(true); // Ensure it's treated as a shadow block
  shadowBlock.setMovable(false); // Prevent dragging
  shadowBlock.setDeletable(false); // Prevent deletion
  shadowBlock.initSvg();
  shadowBlock.render();
  block.getInput(inputName).connection.connect(shadowBlock.outputConnection);
}

function setPositionValues(block, position, shapeType) {
  //console.log("Set position values", position, shapeType);
  let adjustedY = position.y;

  // Adjust Y based on the shape type
  switch (shapeType) {
    case "create_box":
      adjustedY += block.getInputTargetBlock("HEIGHT")
        ? block.getInputTargetBlock("HEIGHT").getFieldValue("NUM") / 2
        : 0.5; // Default to 0.5 if undefined
      break;

    case "create_sphere":
      adjustedY += block.getInputTargetBlock("DIAMETER_Y")
        ? block.getInputTargetBlock("DIAMETER_Y").getFieldValue("NUM") / 2
        : 0.5;
      break;

    case "create_cylinder":
      adjustedY += block.getInputTargetBlock("HEIGHT")
        ? block.getInputTargetBlock("HEIGHT").getFieldValue("NUM") / 2
        : 1;
      break;

    case "create_capsule":
      adjustedY += block.getInputTargetBlock("HEIGHT")
        ? block.getInputTargetBlock("HEIGHT").getFieldValue("NUM") / 2
        : 1;
      break;

    case "create_plane":
      adjustedY += block.getInputTargetBlock("HEIGHT")
        ? block.getInputTargetBlock("HEIGHT").getFieldValue("NUM") / 2
        : 1;
      break;

    case "load_model":
      break;

    case "load_multi_object":
      break;

    case "load_character":
      break;

    case "load_object":
      //console.log("Adjusting y");
      // Adjust Y based on SCALE input
      adjustedY += block.getInputTargetBlock("SCALE")
        ? 0.5 + block.getInputTargetBlock("SCALE").getFieldValue("NUM") / 2
        : 1;
      break;

    default:
      console.error("Unknown shape type: " + shapeType);
  }

  // Set X, Y, Z values
  setNumberInput(block, "X", position.x);
  setNumberInput(block, "Y", adjustedY);
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
    (key) => meshBlockIdMap[key] === blockId
  );

  return flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
}

function addShapeToWorkspace(shapeType, position) {
  //console.log("Adding shape to workspace", shapeType, position);
  Blockly.Events.setGroup(true);
  // Create the shape block in the Blockly workspace
  const block = Blockly.getMainWorkspace().newBlock(shapeType);

  let color,
    width,
    height,
    depth,
    diameterX,
    diameterY,
    diameterZ,
    radius,
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
      height = 2;
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
      radius = 0.5;
      height = 2;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "RADIUS", "math_number", radius);
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
  //highlightBlockById(Blockly.getMainWorkspace(), block);

  // Create a new 'start' block and connect the shape block to it
  const startBlock = Blockly.getMainWorkspace().newBlock("start");
  startBlock.initSvg();
  startBlock.render();

  const connection = startBlock.getInput("DO").connection;
  if (connection) {
    connection.connect(block.previousConnection);
  }

  Blockly.Events.setGroup(false);
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
          const colorFields = {
            HAIR_COLOR: "#000000", // Hair: black
            SKIN_COLOR: "#A15C33", // Skin: custom skin tone
            EYES_COLOR: "#000000", // Eyes: black
            SLEEVES_COLOR: "#008B8B", // Sleeves: dark cyan
            SHORTS_COLOR: "#00008B", // Shorts: dark blue
            TSHIRT_COLOR: "#FF8F60", // T-Shirt: light orange
          };

          Object.keys(colorFields).forEach((colorInputName) => {
            addShadowBlock(
              block,
              colorInputName,
              "colour",
              colorFields[colorInputName]
            );
          });

          block.initSvg();
          block.render();
          //highlightBlockById(Blockly.getMainWorkspace(), block);

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
          //highlightBlockById(Blockly.getMainWorkspace(), block);

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

					//highlightBlockById(Blockly.getMainWorkspace(), block);

					// Set object name
					block.setFieldValue(objectName, "MODELS");

					// Set position values (X, Y, Z) from the picked position
					setPositionValues(block, pickedPosition, command);

					// Add shadow block for SCALE
					const scale = 1; // Default scale
					addShadowBlock(block, "SCALE", "math_number", scale);

					if (command === "load_object") {
						// Add shadow block for COLOR
						const color = objectColours[objectName];
						addShadowBlock(block, "COLOR", "colour", color);
					}

					block.render();

					// Create a new 'start' block and connect the load_object block to it
					const startBlock =
						Blockly.getMainWorkspace().newBlock("start");
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
  characterRow.innerHTML = ""; // Clear existing characters

  characterNames.forEach((name) => {
    const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension
    const li = document.createElement("li");
    li.innerHTML = `<img src="./images/${baseName}.png" alt="${baseName}" onclick="selectCharacter('${name}')">`;
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
  const dropdown = document.getElementById("shapes-dropdown");
  dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
  //loadModelImages(); // Load the models into the menu
  loadObjectImages(); // Load the objects into the menu
  loadMultiImages(); // Load the objects into the menu
  loadCharacterImages(); // Load the characters into the menu
}

function scrollModels(direction) {
  const modelRow = document.getElementById("model-row");
  const scrollAmount = 100; // Adjust as needed
  modelRow.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

function openAboutPage() {
  window.open("https://github.com/flipcomputing/flock/", "_blank");
}

window.openAboutPage = openAboutPage;

export function enableGizmos() {
  const positionButton = document.getElementById("positionButton");
  const rotationButton = document.getElementById("rotationButton");
  const scaleButton = document.getElementById("scaleButton");
  const boundsButton = document.getElementById("boundsButton");
  const focusButton = document.getElementById("focusButton");
  const hideButton = document.getElementById("hideButton");
  const duplicateButton = document.getElementById("duplicateButton");
  const deleteButton = document.getElementById("deleteButton");
  const showShapesButton = document.getElementById("showShapesButton");
  const colorPickerButton = document.getElementById("colorPickerButton");
  const aboutButton = document.getElementById("logo");

  const scrollModelsLeftButton = document.getElementById(
    "scrollModelsLeftButton"
  );
  const scrollModelsRightButton = document.getElementById(
    "scrollModelsRightButton"
  );
  const scrollObjectsLeftButton = document.getElementById(
    "scrollObjectsLeftButton"
  );
  const scrollObjectsRightButton = document.getElementById(
    "scrollObjectsRightButton"
  );
  const scrollCharactersLeftButton = document.getElementById(
    "scrollCharactersLeftButton"
  );
  const scrollCharactersRightButton = document.getElementById(
    "scrollCharactersRightButton"
  );

  // Enable the buttons
  positionButton.removeAttribute("disabled");
  rotationButton.removeAttribute("disabled");
  scaleButton.removeAttribute("disabled");
  boundsButton.removeAttribute("disabled");
  focusButton.removeAttribute("disabled");
  hideButton.removeAttribute("disabled");
  duplicateButton.removeAttribute("disabled");
  deleteButton.removeAttribute("disabled");
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
  boundsButton.addEventListener("click", () => toggleGizmo("bounds"));
  focusButton.addEventListener("click", () => toggleGizmo("focus"));
  hideButton.addEventListener("click", () => toggleGizmo("select"));
  duplicateButton.addEventListener("click", () => toggleGizmo("duplicate"));
  deleteButton.addEventListener("click", () => toggleGizmo("delete"));
  showShapesButton.addEventListener("click", showShapes);
  aboutButton.addEventListener("click", openAboutPage);
  scrollModelsLeftButton.addEventListener("click", () => scrollModels(-1));
  scrollModelsRightButton.addEventListener("click", () => scrollModels(1));
  scrollObjectsLeftButton.addEventListener("click", () => scrollObjects(-1));
  scrollObjectsRightButton.addEventListener("click", () => scrollObjects(1));
  scrollCharactersLeftButton.addEventListener("click", () =>
    scrollCharacters(-1)
  );
  scrollCharactersRightButton.addEventListener("click", () =>
    scrollCharacters(1)
  );
}

// Shared function to load images into the menu
function loadImages(rowId, namesArray, selectCallback) {
  const row = document.getElementById(rowId);
  row.innerHTML = ""; // Clear existing items

  namesArray.forEach((name) => {
    const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension
    const li = document.createElement("li");
    li.innerHTML = `<img src="./images/${baseName}.png" alt="${baseName}" onclick="${selectCallback}('${name}')">`;
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

function highlightBlockById(workspace, block) {
  if (block) {
    // Unselect all other blocks
    workspace.getAllBlocks().forEach((b) => b.unselect());

    // Select the new block
    if (window.codeMode === "both") block.select();

    // Center the block within the viewport
    workspace.centerOnBlock(block.id);
  }
}

function focusCameraOnMesh() {
  let mesh = gizmoManager.attachedMesh;
  if (mesh.name === "ground") mesh = null;

  if (!mesh && window.currentMesh) {
    const blockKey = Object.keys(meshMap).find(
      (key) => meshMap[key] === window.currentBlock
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

    // Maintain the player's Y position (on the ground)
    const originalPlayerY = player.position.y;

    // Set the player's position directly in front of the new target
    const playerDistance = camera.radius; // Distance the camera keeps from the player (preserve this)

    // Calculate the player's forward direction (based on rotation)
    const forward = new flock.BABYLON.Vector3(0, 0, -1); // Default forward direction (Z axis)
    const playerRotationMatrix = flock.BABYLON.Matrix.RotationY(
      player.rotation.y
    );
    const playerForward = flock.BABYLON.Vector3.TransformCoordinates(
      forward,
      playerRotationMatrix
    );

    // Update the player's position (in front of the target)
    player.position.set(
      newTarget.x,
      originalPlayerY,
      newTarget.z + playerDistance
    );

    player.lookAt(newTarget);

    const cameraPosition = player.position.subtract(
      playerForward.scale(playerDistance)
    );

    // Set the camera position behind the player
    camera.setPosition(cameraPosition);

    // Ensure the camera is still looking at the player
    camera.setTarget(player.position);
  } else {
    // For other types of cameras, retain the existing logic
    const currentPosition = camera.position;
    const currentTarget = camera.getTarget();
    const currentDistance = flock.BABYLON.Vector3.Distance(
      currentPosition,
      currentTarget
    );
    const currentYPosition = camera.position.y;

    // Move the camera in front of the mesh, keeping the current distance and Y position
    const frontDirection = new flock.BABYLON.Vector3(0, 0, -1);
    const newCameraPositionXZ = new flock.BABYLON.Vector3(
      newTarget.x + frontDirection.x * currentDistance,
      currentYPosition,
      newTarget.z + frontDirection.z * currentDistance
    );

    camera.position = newCameraPositionXZ;
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
  } else {
    console.log(`Block with ID ${blockId} not found.`);
  }
}

function toggleGizmo(gizmoType) {
  // Disable all gizmos
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;

  if (gizmoManager.attachedMesh) {
    gizmoManager.attachedMesh.showBoundingBox = false;
  }

  document.body.style.cursor = "default";

  gizmoManager.attachableMeshes = flock.scene?.meshes?.filter(
    (s) => s.name !== "ground"
  );

  let blockKey, blockId, canvas, onPickMesh;

  // Enable the selected gizmo
  switch (gizmoType) {
    case "delete":
      blockKey = findParentWithBlockId(gizmoManager.attachedMesh).blockKey;
      blockId = meshBlockIdMap[blockKey];

      //console.log("Delete", blockKey, meshMap);
      deleteBlockWithUndo(blockId);
      gizmoManager.attachToMesh(null);
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
          flock.scene.activeCamera
        );

        const pickResult = flock.scene.pickWithRay(
          pickRay,
          (mesh) => mesh.isPickable
        );

        if (pickResult.hit) {
          const pickedPosition = pickResult.pickedPoint;

          const workspace = Blockly.getMainWorkspace();
          const originalBlock = workspace.getBlockById(blockId);

          //console.log("Duplicate", blockKey, meshMap);
          if (originalBlock) {
            // Serialize the block and its children, including shadows

            Blockly.Events.setGroup(true);
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
              workspace
            );

            setPositionValues(
              duplicateBlock,
              pickedPosition,
              duplicateBlock.type
            );

            // Connect the new block as the next block
            if (
              originalBlock.nextConnection &&
              duplicateBlock.previousConnection
            ) {
              originalBlock.nextConnection.connect(
                duplicateBlock.previousConnection
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
    case "select":
      gizmoManager.selectGizmoEnabled = true;
      flock.scene.onPointerObservable.add((event) => {
        if (event.type === flock.BABYLON.PointerEventTypes.POINTERPICK) {
          if (gizmoManager.attachedMesh) {
            gizmoManager.attachedMesh.showBoundingBox = false;
            blockKey = findParentWithBlockId(
              gizmoManager.attachedMesh
            ).blockKey;

            //console.log("Select", blockKey, meshMap);
          }
          const pickedMesh = event.pickInfo.pickedMesh;

          if (pickedMesh && pickedMesh.name !== "ground") {
            // Attach the gizmo to the selected mesh
            gizmoManager.attachToMesh(pickedMesh);

            //console.log("Selected", pickedMesh.name, gizmoManager.attachedMesh.name);
            // Show bounding box for the selected mesh
            pickedMesh.showBoundingBox = true;
          } else {
            // Deselect if no mesh is picked
            if (gizmoManager.attachedMesh) {
              gizmoManager.attachedMesh.showBoundingBox = false;
              gizmoManager.attachToMesh(null); // Detach the gizmo
            }
          }
        }
      });
      break;
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

          //const block = meshMap[mesh.blockKey];
          //highlightBlockById(Blockly.getMainWorkspace(), block);
        }
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
              "NUM"
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
              "NUM"
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
          mesh.physics.getMotionType() !=
            flock.BABYLON.PhysicsMotionType.ANIMATED
        ) {
          mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
          mesh.physics.disablePreStep = false;
        }

        //const block = meshMap[mesh.blockKey];					//highlightBlockById(Blockly.getMainWorkspace(), block);
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
                "NUM"
              );
          } catch (e) {}
          try {
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
                "NUM"
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
        //console.log("Mesh rotated", mesh.name, mesh.blockKey, mesh.physics);
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

        //const block = meshMap[mesh.blockKey];
        //highlightBlockById(Blockly.getMainWorkspace(), block);
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
          block
            .appendStatementInput("DO")
            .setCheck(null)
            .appendField("then do");
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
            mesh.rotationQuaternion
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
      gizmoManager.gizmos.scaleGizmo.xGizmo._coloredMaterial.diffuseColor =
        blueColor;
      gizmoManager.gizmos.scaleGizmo.yGizmo._coloredMaterial.diffuseColor =
        greenColor;
      gizmoManager.gizmos.scaleGizmo.zGizmo._coloredMaterial.diffuseColor =
        orangeColor;
      gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add(function () {
        const mesh = gizmoManager.attachedMesh;
        const motionType = mesh.physics?.getMotionType();
        mesh.savedMotionType = motionType;

        if (
          mesh.physics &&
          mesh.physics.getMotionType() !=
            flock.BABYLON.PhysicsMotionType.ANIMATED
        ) {
          mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
          mesh.physics.disablePreStep = false;
        }

        //const block = meshMap[mesh.blockKey];
        //highlightBlockById(Blockly.getMainWorkspace(), block);
      });

      gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(function () {
        const mesh = gizmoManager.attachedMesh;
        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        const block = meshMap[mesh.blockKey];

        if (!block) {
          return;
        }

        if (!block.getInput("DO")) {
          block
            .appendStatementInput("DO")
            .setCheck(null)
            .appendField("then do");
        }

        // Check if the 'scale' block already exists in the 'DO' section
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

        // Create a new 'scale' block if it doesn't exist
        if (!scaleBlock) {
          scaleBlock = Blockly.getMainWorkspace().newBlock("scale");
          scaleBlock.setFieldValue(modelVariable, "BLOCK_NAME");
          scaleBlock.initSvg();
          scaleBlock.render();

          // Add shadow blocks for X, Y, Z inputs
          ["X", "Y", "Z"].forEach((axis) => {
            const input = scaleBlock.getInput(axis);

            // Create a shadow block
            const shadowBlock =
              Blockly.getMainWorkspace().newBlock("math_number");
            shadowBlock.setFieldValue("1", "NUM"); // Default value
            shadowBlock.setShadow(true); // Mark as shadow
            shadowBlock.initSvg(); // Initialize SVG
            shadowBlock.render(); // Render the shadow block

            // Connect the shadow block to the input
            input.connection.connect(shadowBlock.outputConnection);
          });

          scaleBlock.render();

          // Connect the new 'scale' block to the 'do' section
          block
            .getInput("DO")
            .connection.connect(scaleBlock.previousConnection);
        }

        // Helper to update the value of the connected block or shadow block
        function setScaleValue(inputName, value) {
          const input = scaleBlock.getInput(inputName);
          const connectedBlock = input.connection.targetBlock();

          if (connectedBlock) {
            connectedBlock.setFieldValue(String(value), "NUM");
          }
        }

        // Set the scale values (X, Y, Z)
        const scaleX = Math.round(mesh.scaling.x * 10) / 10;
        const scaleY = Math.round(mesh.scaling.y * 10) / 10;
        const scaleZ = Math.round(mesh.scaling.z * 10) / 10;

        setScaleValue("X", scaleX);
        setScaleValue("Y", scaleY);
        setScaleValue("Z", scaleZ);
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
  "Detail",
  "Shorts",
  "TShirt",
];

function updateBlockColorAndHighlight(mesh, selectedColor) {
  let block;

  const materialName = mesh?.material?.name?.replace(/_clone$/, "");

  const ultimateParent = (mesh) =>
    mesh.parent ? ultimateParent(mesh.parent) : mesh;

  if (mesh && materialName && characterMaterials.includes(materialName)) {
    block = meshMap[ultimateParent(mesh).blockKey];
    // Update the corresponding character submesh color field (e.g., HAIR_COLOR, SKIN_COLOR)
    const materialToFieldMap = {
      Hair: "HAIR_COLOR",
      Skin: "SKIN_COLOR",
      Eyes: "EYES_COLOR",
      Detail: "SLEEVES_COLOR",
      Shorts: "SHORTS_COLOR",
      TShirt: "TSHIRT_COLOR",
    };

    const fieldName = materialToFieldMap[materialName];

    if (fieldName) {
      // Update the corresponding character color field in the block
      block
        .getInput(fieldName)
        .connection.targetBlock()
        .setFieldValue(selectedColor, "COLOR");
    } else {
      console.error("No matching field for material:", materialName);
    }
  } else {
    if (!mesh) {
      block = meshMap["sky"];
    } else {
      const ultimateParent = (mesh) =>
        mesh.parent ? ultimateParent(mesh.parent) : mesh;

      block = meshMap[ultimateParent(mesh).blockKey];
    }

    if (!block) {
      console.error(
        "Block not found for mesh:",
        ultimateParent(mesh).blockKey,
        mesh
      );

      return;
    }

    block
      .getInput("COLOR")
      .connection.targetBlock()
      .setFieldValue(selectedColor, "COLOR");
  }

  block?.initSvg();

  //highlightBlockById(Blockly.getMainWorkspace(), block);
}

export function setGizmoManager(value) {
  gizmoManager = value;

  const originalAttach = gizmoManager.attachToMesh.bind(gizmoManager);
  gizmoManager.attachToMesh = (mesh) => {
    if (gizmoManager.attachedMesh)
      gizmoManager.attachedMesh
        .getChildMeshes()
        .forEach((child) => (child.showBoundingBox = false));

    while (mesh && mesh.parent && !mesh.parent.physicsImpostor) {
      mesh = mesh.parent;
    }
    originalAttach(mesh);
  };
}

export function disposeGizmoManager() {
  if (gizmoManager) {
    gizmoManager.dispose();
    gizmoManager = null; // Clear the global reference for garbage collection
  }
}
