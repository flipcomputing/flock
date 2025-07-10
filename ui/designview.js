import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap} from "../generators";
import { flock } from "../flock.js";
import {
  objectColours,
} from "../config.js";
import "./addmenu.js";
import { createMeshOnCanvas, setPositionValues } from "./addmeshes.js";
import { 
  gizmoManager, 
  enableGizmos, 
  setGizmoManager, 
  disposeGizmoManager,
  toggleGizmo 
} from "./gizmos.js";
import { highlightBlockById } from "./addmenu.js";

export { gizmoManager };

export function updateOrCreateMeshFromBlock(block, changeEvent) {
  const mesh = getMeshFromBlock(block);

  const isEnabledEvent =
    changeEvent?.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === "disabled" &&
    changeEvent.oldValue &&
    !changeEvent.newValue;

  const isImmediateEnabledCreate =
    changeEvent?.type === Blockly.Events.BLOCK_CREATE &&
    block.isEnabled() &&
    !mesh;

  /*console.log("updateOrCreateMeshFromBlock", {
    id: block.id,
    isEnabled: block.isEnabled(),
    hasMesh: !!mesh,
    eventType: changeEvent?.type,
    element: changeEvent?.element,
    oldValue: changeEvent?.oldValue,
    newValue: changeEvent?.newValue,
    isEnabledEvent,
    isImmediateEnabledCreate,
  });*/

  if (window.loadingCode || block.disposed) return;

  const alreadyCreatingMesh = meshMap[block.id] !== undefined;

  if (!alreadyCreatingMesh && (isEnabledEvent || isImmediateEnabledCreate)) {
    createMeshOnCanvas(block);
    return;
  }

  if (
    changeEvent?.type === Blockly.Events.BLOCK_CHANGE &&
    (mesh ||
      ["set_sky_color", "set_background_color", "create_ground"].includes(
        block.type,
      ))
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

export function extractMaterialInfo(materialBlock) {
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


function getMeshFromBlockId(blockId) {
  //console.log("Get mesh from block id", blockId, meshBlockIdMap, meshMap, flock.scene?.meshes?.map((mesh) => mesh.blockKey));

  const blockKey = Object.keys(meshMap).find(
    (key) => meshBlockIdMap[key] === blockId,
  );

  return flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
}


function openAboutPage() {
  window.open("https://flockxr.com/", "_blank");
}

window.openAboutPage = openAboutPage;







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





