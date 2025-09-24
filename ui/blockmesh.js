import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap } from "../generators";
import { flock } from "../flock.js";
import { objectColours } from "../config.js";
import { createMeshOnCanvas } from "./addmeshes.js";
import { createBlockWithShadows, highlightBlockById } from "./addmenu.js";

const characterMaterials = [
  "Hair",
  "Skin",
  "Eyes",
  "Sleeves",
  "Shorts",
  "TShirt",
];

const colorFields = {
  HAIR_COLOR: true,
  SKIN_COLOR: true,
  EYES_COLOR: true,
  TSHIRT_COLOR: true,
  SHORTS_COLOR: true,
  SLEEVES_COLOR: true,
};

export function getRootMesh(mesh) {
  if (flock.meshDebug) console.log(mesh.parent);
  if (!mesh) return null;
  if (!mesh.parent) return mesh;
  return getRootMesh(mesh.parent);
}

export function updateOrCreateMeshFromBlock(block, changeEvent) {
  
  if (flock.meshDebug)
    console.log(
      "Update or create mesh from block",
      block.type,
      changeEvent.type,
    );

  if (
    [
      "set_sky_color",
      "set_background_color",
      "create_ground",
    ].includes(block.type)
  ) {
    // Always proceed to update
    updateMeshFromBlock(null, block, changeEvent);
    return;
  }

  const mesh = getMeshFromBlock(block);

  if (flock.meshDebug) console.log(mesh);

  const isEnabledEvent =
    changeEvent?.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === "disabled" &&
    changeEvent.oldValue &&
    !changeEvent.newValue;

  const isImmediateEnabledCreate =
    changeEvent?.type === Blockly.Events.BLOCK_CREATE &&
    block.isEnabled() &&
    !mesh;

  if (window.loadingCode || block.disposed) return;

  const alreadyCreatingMesh = meshMap[block.id] !== undefined;

  if (!alreadyCreatingMesh && (isEnabledEvent || isImmediateEnabledCreate)) {
    createMeshOnCanvas(block);
    return;
  }

  if (flock.meshDebug) {
    console.log(
      changeEvent?.type === Blockly.Events.BLOCK_CHANGE ||
        changeEvent?.type === Blockly.Events.BLOCK_CREATE,
    );
  }

  if (
    (changeEvent?.type === Blockly.Events.BLOCK_CHANGE ||
      changeEvent?.type === Blockly.Events.BLOCK_CREATE) &&
    (mesh ||
      [
        "set_sky_color",
        "set_background_color",
        "create_ground",
        "create_map",
      ].includes(block.type))
  ) {
    updateMeshFromBlock(mesh, block, changeEvent);
  }
}

export function deleteMeshFromBlock(blockId) {
  const blockKey = getBlockKeyFromBlockID(blockId);

  if (!blockKey) {
    const block = Blockly.getMainWorkspace().getBlockById(blockId);
    if (block && block.type === "create_map") {
      const mesh = flock?.scene?.getMeshByName("ground");
      if (mesh) {
        flock.disposeMesh(mesh);
        return;
      }
    }
  }

  if (!blockKey) {
    return;
  }

  const mesh = getMeshFromBlockKey(blockKey);

  if (!mesh || mesh.name === "__root__") {
  } else {
    flock.disposeMesh(mesh);
  }

  // Remove mappings
  delete meshMap[blockKey];
  delete meshBlockIdMap[blockKey];
}

export function getBlockKeyFromBlock(block) {
  return Object.keys(meshMap).find((key) => meshMap[key] === block);
}

export function getBlockKeyFromBlockID(blockId) {
  return Object.keys(meshBlockIdMap).find(
    (key) => meshBlockIdMap[key] === blockId,
  );
}

export function getMeshFromBlockKey(blockKey) {
  return flock.scene?.meshes?.find(
    (mesh) => mesh.metadata?.blockKey === blockKey,
  );
}

export function getMeshFromBlock(block) {
  if (block && block.type === "create_map") {
    return flock?.scene?.getMeshByName("ground");
  }

  if (block && block.type === "rotate_to") {
    block = block.getParent();
  }

  const blockKey = getBlockKeyFromBlock(block);

  if (!blockKey) return null;
  const found = getMeshFromBlockKey(blockKey);
  return found;
}

function getMeshFromBlockId(blockId) {
  const blockKey = getBlockKeyFromBlockID(blockId);

  return getMeshFromBlockKey(blockKey);
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
 
  if (flock.meshDebug) console.log("Update", block.type, changeEvent.type);
  if (
    !mesh &&
    ![
      "set_sky_color",
      "set_background_color",
      "create_ground",
      "create_map",
    ].includes(block.type)
  )
    return;

  const changedBlock = Blockly.getMainWorkspace().getBlockById(
    changeEvent.blockId,
  );

  const parent = changedBlock.getParent() || changedBlock;
  let changed;

  // Check for direct field changes on the block itself FIRST
  if (
    changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === "field" &&
    changeEvent.blockId === block.id
  ) {
    if (block.type === "load_object" && changeEvent.name === "MODELS") {
      changed = "MODELS";
    } else if (
      block.type === "load_multi_object" &&
      changeEvent.name === "MODELS"
    ) {
      changed = "MODELS";
    } else if (
      block.type === "load_character" &&
      changeEvent.name === "MODELS"
    ) {
      changed = "MODELS";
    } else if (block.type === "create_map" && changeEvent.name === "MAP_NAME") {
      changed = "MAP_NAME";
    }
  }

  if (!changed) {
    parent.inputList.forEach((input) => {
      let value =
        input?.connection?.shadowState?.id ||
        input?.connection?.targetConnection?.sourceBlock_?.id;
      if (value === changedBlock.id) changed = input.name;
    });
  }

  if (
    !changed &&
    block.type === "create_map" &&
    block.getInputTargetBlock("MATERIAL")
  ) {
    // If the field that changed belongs to the material block, treat as change
    const materialBlock = block.getInputTargetBlock("MATERIAL");
    if (
      changeEvent.blockId === materialBlock.id ||
      (changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
        changeEvent.name &&
        materialBlock?.getField(changeEvent.name))
    ) {
      changed = "MATERIAL";
    }
  }

  if (!changed) {
    if (
      block.type === "set_sky_color" ||
      block.type === "create_ground" ||
      block.type === "create_map"
    ) {
      changed = "COLOR"; // or any value to keep going
    } else {
      return;
    }
  }

  if (!changed) return;

  const shapeType = block.type;

  // Special handling for MODELS field change - get mesh if not provided
  if (
    (block.type === "load_object" ||
      block.type === "load_multi_object" ||
      block.type === "load_character") &&
    changed === "MODELS" &&
    !mesh
  ) {
    mesh = getMeshFromBlock(block);
  }

  if (mesh && mesh.physics) mesh.physics.disablePreStep = true;

  let color;

  if (
    ![
      "load_model",
      "load_multi_object",
      "load_character",
      "create_map",
      "rotate_to",
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

    if (materialBlock) {
      const { textureSet, baseColor, alpha } =
        extractMaterialInfo(materialBlock);

      const materialOptions = {
        color: baseColor, // baseColor → color
        materialName: textureSet, // textureSet → materialName
        alpha, // unchanged
      };

      const material = flock.createMaterial(materialOptions);

      flock.createMap(map, material);
    } else {
    }
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
      if (changed === "MODELS") {
        // Handle live model replacement
        replaceMeshModel(mesh, block, changeEvent);
        return;
      }
      break;
    case "load_model":
      break;
    case "load_multi_object":
      if (changed === "MODELS") {
        // Handle live model replacement for multi objects
        replaceMeshModel(mesh, block, changeEvent);
        return;
      }
      break;
    case "load_character":
      if (changed === "MODELS") {
        // Handle live model replacement for characters
        replaceMeshModel(mesh, block, changeEvent);
        return;
      }

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

    case "rotate_to":
      // Recognised as a shape here for some reason.
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
  if (["X", "Y", "Z"].includes(changed)) {
    switch (block.type) {
      case "rotate_to":
        /* The "position" X, Y and Z values are automatically picked up from the "rotate_to"
        block and assigned as such, so we can just use those for the rotations instead of
        having to reassign them. */
        flock.rotateTo(mesh.name, {
          x: position.x,
          y: position.y,
          z: position.z,
        });
        break;

      default:
        flock.positionAt(mesh.name, {
          x: position.x,
          y: position.y,
          z: position.z,
          useY: true,
        });
        break;
    }
  } else if (!["X", "Y", "Z"].includes(changed) && changed === "SCALE") {
    for (const childBlock of block.getChildren()) {
      if (childBlock.type === "rotate_to") {
        let rotation = {
          x: childBlock.getInput("X").connection.targetBlock().getFieldValue("NUM"),
          y: childBlock.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
          z: childBlock.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
        };
        flock.rotateTo(mesh.name,{
          x: rotation.x,
          y: rotation.y,
          z: rotation.z,
        });
      }
    }
  }
  //console.log("Update physics");
  flock.updatePhysics(mesh);
}

function moveMeshToOrigin(mesh) {
  mesh.position = flock.BABYLON.Vector3.Zero();
  mesh.rotation = flock.BABYLON.Vector3.Zero();
  return mesh;
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
  mesh = moveMeshToOrigin(mesh);

  // Calculate new scaling
  const newScaleX = width / (originalSize.x * 2);
  const newScaleY = height / (originalSize.y * 2);
  const newScaleZ = depth === 0 ? 1 : depth / (originalSize.z * 2);

  // Apply scaling
  mesh.scaling = new flock.BABYLON.Vector3(newScaleX, newScaleY, newScaleZ);

  // Bake the scaling into the vertices
  mesh.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1
  mesh.scaling = flock.BABYLON.Vector3.One();

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
          flock.BABYLON.Vector3.Zero(),
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
          flock.BABYLON.Vector3.Zero(),
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
  mesh = moveMeshToOrigin(mesh);
  mesh.scaling = flock.BABYLON.Vector3.One();

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
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Ensure the world matrix is updated
  mesh.computeWorldMatrix(true);
}

function replaceMeshModel2(currentMesh, block, changeEvent) {
  if (!currentMesh || !block) {
    return;
  }

  // Calculate the current mesh's bottom position in world space (including scaling)
  currentMesh.computeWorldMatrix(true);
  currentMesh.refreshBoundingInfo();
  const currentBottomY =
    currentMesh.getBoundingInfo().boundingBox.minimumWorld.y;

  // Also store the actual mesh position (which may have been adjusted by gizmos)
  const actualMeshPosition = {
    x: currentMesh.position.x,
    y: currentMesh.position.y,
    z: currentMesh.position.z,
  };

  // Get the current block position values (which should reflect gizmo updates)
  const currentBlockPosition = {
    x: parseFloat(
      block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
    ),
    y: parseFloat(
      block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
    ),
    z: parseFloat(
      block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
    ),
  };

  // Store current mesh state including the original mesh name
  const meshState = {
    position: actualMeshPosition, // Use actual mesh position that accounts for gizmo adjustments
    currentBlockPosition: currentBlockPosition, // Current block values (updated by gizmos)
    currentBottomY: currentBottomY, // Store the current bottom position for alignment
    rotation: currentMesh.rotation ? currentMesh.rotation.clone() : null,
    rotationQuaternion: currentMesh.rotationQuaternion
      ? currentMesh.rotationQuaternion.clone()
      : null,
    scaling: currentMesh.scaling.clone(),
    physics: null,
    savedMotionType: currentMesh.savedMotionType,
    metadata: { ...currentMesh.metadata },
    blockKey: currentMesh.metadata?.blockKey,
    material: currentMesh.material,
    isVisible: currentMesh.isVisible,
    originalName: currentMesh.name, // Current mesh name
    originalBaseName:
      currentMesh.metadata?.originalBaseName || currentMesh.name.split("__")[0], // Base name for triggers
  };

  // Store physics properties if they exist
  if (currentMesh.physics) {
    meshState.physics = {
      motionType: currentMesh.physics.getMotionType(),
      mass: currentMesh.physics.getMassProperties().mass,
      friction: currentMesh.physics.shape?.friction,
      restitution: currentMesh.physics.shape?.restitution,
      disablePreStep: currentMesh.physics.disablePreStep,
    };
  }

  // Get new model information from block
  const newModelName = block.getFieldValue("MODELS");
  const scale = block
    .getInput("SCALE")
    .connection.targetBlock()
    .getFieldValue("NUM");

  // Handle color differently for different block types
  let color;
  if (block.type === "load_multi_object") {
    // Multi objects use a COLORS input with a list - get all colors
    const colorsBlock = block.getInput("COLORS").connection.targetBlock();
    let colorsArray = [];

    if (colorsBlock) {
      // Loop through the child blocks (array items) and get their values
      colorsBlock.childBlocks_.forEach((childBlock) => {
        // Get the color value from the child block
        const colorValue = childBlock.getFieldValue("COLOR");
        if (colorValue) {
          colorsArray.push(colorValue);
        }
      });
    }

    color = colorsArray;
  } else if (block.type === "load_character") {
    // Characters use multiple color inputs - match the existing structure
    color = {};
    const colorMapping = {
      HAIR_COLOR: "hair",
      SKIN_COLOR: "skin",
      EYES_COLOR: "eyes",
      TSHIRT_COLOR: "tshirt",
      SHORTS_COLOR: "shorts",
      SLEEVES_COLOR: "sleeves",
    };
    Object.entries(colorMapping).forEach(([inputName, colorKey]) => {
      const input = block.getInput(inputName);
      if (input && input.connection && input.connection.targetBlock()) {
        color[colorKey] = input.connection.targetBlock().getFieldValue("COLOR");
      }
    });
  } else {
    // Single objects use a COLOR input
    color = block
      .getInput("COLOR")
      .connection.targetBlock()
      .getFieldValue("COLOR");
  }

  // Create a temporary unique name, then rename after creation
  const tempMeshId = `${newModelName}__${block.id}__${Date.now()}`;
  const targetName = meshState.originalName;

  // Dispose of the old mesh
  if (currentMesh.name !== "__root__") {
    flock.disposeMesh(currentMesh);
  }

  // Create new mesh using the actual mesh position (since block values aren't updated yet)
  const newMesh = flock.createObject({
    modelName: newModelName,
    modelId: tempMeshId,
    color: color,
    scale: parseFloat(scale),
    position: {
      x: meshState.position.x,
      y: meshState.currentBlockPosition.y, // Use block Y as base since setupMesh will adjust it
      z: meshState.position.z,
    },
    callback: () => {
      // Get the newly loaded mesh using our lookup function
      const loadedMesh = getMeshFromBlock(block);

      // Ensure the new mesh has the correct blockKey metadata immediately
      if (loadedMesh && typeof loadedMesh === "object") {
        loadedMesh.metadata = loadedMesh.metadata || {};
        loadedMesh.metadata.blockKey = meshState.blockKey;

        // Rename the mesh to preserve the original name
        loadedMesh.name = targetName;
      } else {
        return;
      }

      if (loadedMesh && loadedMesh !== currentMesh) {
        // Restore transform state, but adjust Y position for new mesh size
        loadedMesh.position.x = meshState.position.x;
        loadedMesh.position.z = meshState.position.z;

        // Restore rotation first
        if (meshState.rotation) {
          loadedMesh.rotation.copyFrom(meshState.rotation);
        }
        if (meshState.rotationQuaternion) {
          loadedMesh.rotationQuaternion.copyFrom(meshState.rotationQuaternion);
        }

        // Check if there's a scale block in the DO section (created by gizmo)
        let scaleBlock = null;
        const modelVariable = block.getFieldValue("ID_VAR");
        const doInput = block.getInput("DO");
        if (doInput && doInput.connection && doInput.connection.targetBlock()) {
          let currentBlock = doInput.connection.targetBlock();
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

        // Check if mesh has gizmo scaling (either from mesh.scaling or scale block)
        const hasGizmoScaling =
          scaleBlock ||
          (meshState.scaling &&
            (Math.abs(meshState.scaling.x - 1) > 0.001 ||
              Math.abs(meshState.scaling.y - 1) > 0.001 ||
              Math.abs(meshState.scaling.z - 1) > 0.001)) ||
          (parseFloat(scale) === 1.0 && meshState.scaling); // Scale block case: block scale is 1 but has custom scaling

        // Use setTimeout to let setupMesh complete, then apply scaling
        setTimeout(() => {
          if (scaleBlock) {
            // Apply scale block transformation using flock.scale API
            const scaleX = parseFloat(
              scaleBlock
                .getInput("X")
                .connection.targetBlock()
                .getFieldValue("NUM"),
            );
            const scaleY = parseFloat(
              scaleBlock
                .getInput("Y")
                .connection.targetBlock()
                .getFieldValue("NUM"),
            );
            const scaleZ = parseFloat(
              scaleBlock
                .getInput("Z")
                .connection.targetBlock()
                .getFieldValue("NUM"),
            );

            // Get scale origin settings (if they exist)
            const xOrigin = scaleBlock.getFieldValue("X_ORIGIN") || "CENTRE";
            const yOrigin = scaleBlock.getFieldValue("Y_ORIGIN") || "BASE"; // BASE for bottom alignment
            const zOrigin = scaleBlock.getFieldValue("Z_ORIGIN") || "CENTRE";

            // Apply scaling using the flock.scale API (which handles positioning correctly)
            flock.scale(loadedMesh.name, {
              x: scaleX,
              y: scaleY,
              z: scaleZ,
              xOrigin: xOrigin,
              yOrigin: yOrigin,
              zOrigin: zOrigin,
            });

            // Wait for scale to complete, then align bottoms
            setTimeout(() => {
              loadedMesh.computeWorldMatrix(true);
              loadedMesh.refreshBoundingInfo();
              const newMeshCurrentBottomY =
                loadedMesh.getBoundingInfo().boundingBox.minimumWorld.y;

              // Calculate the Y adjustment needed to align bottoms
              const yAdjustment =
                meshState.currentBottomY - newMeshCurrentBottomY;
              loadedMesh.position.y += yAdjustment;
            }, 100);
          } else if (hasGizmoScaling) {
            // No scale block, apply direct mesh scaling
            loadedMesh.scaling.copyFrom(meshState.scaling);

            // Calculate bottom alignment after scaling
            loadedMesh.computeWorldMatrix(true);
            loadedMesh.refreshBoundingInfo();
            const newMeshCurrentBottomY =
              loadedMesh.getBoundingInfo().boundingBox.minimumWorld.y;

            // Calculate the Y adjustment needed to align bottoms
            const yAdjustment =
              meshState.currentBottomY - newMeshCurrentBottomY;
            loadedMesh.position.y += yAdjustment;
          }
        }, 100); // Give setupMesh time to complete

        // Apply any Y offset from metadata
        if (loadedMesh.metadata?.yOffset && loadedMesh.metadata.yOffset !== 0) {
          loadedMesh.position.y +=
            parseFloat(scale) * loadedMesh.metadata.yOffset;
        }
        loadedMesh.isVisible = meshState.isVisible;

        // Restore metadata
        if (meshState.metadata) {
          loadedMesh.metadata = { ...meshState.metadata };
          loadedMesh.metadata.blockKey = meshState.blockKey;
        }

        // Preserve the original base name for future trigger lookups
        loadedMesh.metadata.originalBaseName = meshState.originalBaseName;

        // Restore physics if it existed
        if (meshState.physics && loadedMesh.physics) {
          if (meshState.physics.motionType !== undefined) {
            loadedMesh.physics.setMotionType(meshState.physics.motionType);
          }
          loadedMesh.physics.disablePreStep = meshState.physics.disablePreStep;
          loadedMesh.savedMotionType = meshState.savedMotionType;
        }

        // Apply colors based on block type
        if (
          block.type === "load_character" &&
          color &&
          Object.keys(color).length > 0
        ) {
          flock.applyColorsToCharacter(loadedMesh, color);
        } else if (
          block.type === "load_multi_object" &&
          Array.isArray(color) &&
          color.length > 0
        ) {
          // Multi-object color application - reuse existing logic
          flock.applyColorsToMesh(loadedMesh, color);
        } else if (color && typeof color === "string") {
          // Single object color application
          flock.applyColorToMaterial(loadedMesh, null, color);
        }

        // Update physics to ensure collision detection works
        flock.updatePhysics(loadedMesh);

        // Re-apply any pending triggers using the original mesh base name
        const newMeshName = loadedMesh.name;
        const originalBaseName = meshState.originalBaseName;

        if (
          flock.pendingTriggers &&
          flock.pendingTriggers.has(originalBaseName)
        ) {
          const triggers = flock.pendingTriggers.get(originalBaseName);
          triggers.forEach(({ trigger, callback, mode }) => {
            flock.onTrigger(newMeshName, {
              trigger,
              callback,
              mode,
              applyToGroup: false,
            });
          });
        }
      }
    },
  });

  return newMesh;
}

function replaceMeshModel(currentMesh, block, changeEvent) {
  if (!currentMesh || !block) {
    return;
  }

  // Calculate the current mesh's bottom position in world space (including scaling)
  currentMesh.computeWorldMatrix(true);
  currentMesh.refreshBoundingInfo();
  const currentBottomY =
    currentMesh.getBoundingInfo().boundingBox.minimumWorld.y;

  // Also store the actual mesh position (which may have been adjusted by gizmos)
  const actualMeshPosition = {
    x: currentMesh.position.x,
    y: currentMesh.position.y,
    z: currentMesh.position.z,
  };

  // Get the current block position values (which should reflect gizmo updates)
  const currentBlockPosition = {
    x: parseFloat(
      block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
    ),
    y: parseFloat(
      block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
    ),
    z: parseFloat(
      block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
    ),
  };

  // Store current mesh state including the original mesh name
  const meshState = {
    position: actualMeshPosition, // Use actual mesh position that accounts for gizmo adjustments
    currentBlockPosition: currentBlockPosition, // Current block values (updated by gizmos)
    currentBottomY: currentBottomY, // Store the current bottom position for alignment
    rotation: currentMesh.rotation ? currentMesh.rotation.clone() : null,
    rotationQuaternion: currentMesh.rotationQuaternion
      ? currentMesh.rotationQuaternion.clone()
      : null,
    scaling: currentMesh.scaling.clone(),
    physics: null,
    savedMotionType: currentMesh.savedMotionType,
    metadata: { ...currentMesh.metadata },
    blockKey: currentMesh.metadata?.blockKey,
    material: currentMesh.material,
    isVisible: currentMesh.isVisible,
    originalName: currentMesh.name, // Current mesh name
    originalBaseName:
      currentMesh.metadata?.originalBaseName || currentMesh.name.split("__")[0], // Base name for triggers
  };

  // Store physics properties if they exist
  if (currentMesh.physics) {
    meshState.physics = {
      motionType: currentMesh.physics.getMotionType(),
      mass: currentMesh.physics.getMassProperties().mass,
      friction: currentMesh.physics.shape?.friction,
      restitution: currentMesh.physics.shape?.restitution,
      disablePreStep: currentMesh.physics.disablePreStep,
    };
  }

  // Get new model information from block
  const newModelName = block.getFieldValue("MODELS");
  const scale = block
    .getInput("SCALE")
    .connection.targetBlock()
    .getFieldValue("NUM");

  // Handle color differently for different block types
  let color;
  if (block.type === "load_multi_object") {
    // Multi objects use a COLORS input with a list - get all colors
    const colorsBlock = block.getInput("COLORS").connection.targetBlock();
    let colorsArray = [];

    if (colorsBlock) {
      // Loop through the child blocks (array items) and get their values
      colorsBlock.childBlocks_.forEach((childBlock) => {
        // Get the color value from the child block
        const colorValue = childBlock.getFieldValue("COLOR");
        if (colorValue) {
          colorsArray.push(colorValue);
        }
      });
    }

    color = colorsArray;
  } else if (block.type === "load_character") {
    // Characters use multiple color inputs - match the existing structure
    color = {};
    const colorMapping = {
      HAIR_COLOR: "hair",
      SKIN_COLOR: "skin",
      EYES_COLOR: "eyes",
      TSHIRT_COLOR: "tshirt",
      SHORTS_COLOR: "shorts",
      SLEEVES_COLOR: "sleeves",
    };
    Object.entries(colorMapping).forEach(([inputName, colorKey]) => {
      const input = block.getInput(inputName);
      if (input && input.connection && input.connection.targetBlock()) {
        color[colorKey] = input.connection.targetBlock().getFieldValue("COLOR");
      }
    });
  } else {
    // Single objects use a COLOR input
    color = block
      .getInput("COLOR")
      .connection.targetBlock()
      .getFieldValue("COLOR");
  }

  // Create a temporary unique name, then rename after creation
  const tempMeshId = `${newModelName}__${block.id}__${Date.now()}`;
  const targetName = meshState.originalName;

  // Dispose of the old mesh
  if (currentMesh.name !== "__root__") {
    flock.disposeMesh(currentMesh);
  }

  // Create new mesh using the appropriate creation method
  let newMesh;
  if (block.type === "load_character") {
    newMesh = flock.createCharacter({
      modelName: newModelName,
      modelId: tempMeshId,
      colors: color,
      scale: parseFloat(scale),
      position: {
        x: meshState.position.x,
        y: meshState.currentBlockPosition.y, // Use block Y as base since setupMesh will adjust it
        z: meshState.position.z,
      },
      callback: () => {
        // Get the newly loaded mesh using our lookup function
        const loadedMesh = getMeshFromBlock(block);

        // Ensure the new mesh has the correct blockKey metadata immediately
        if (loadedMesh && typeof loadedMesh === "object") {
          loadedMesh.metadata = loadedMesh.metadata || {};
          loadedMesh.metadata.blockKey = meshState.blockKey;

          // Rename the mesh to preserve the original name
          loadedMesh.name = targetName;
        } else {
          return;
        }

        if (loadedMesh && loadedMesh !== currentMesh) {
          // Restore transform state, but adjust Y position for new mesh size
          loadedMesh.position.x = meshState.position.x;
          loadedMesh.position.z = meshState.position.z;

          // Restore rotation first
          if (meshState.rotation) {
            loadedMesh.rotation.copyFrom(meshState.rotation);
          }
          if (meshState.rotationQuaternion) {
            loadedMesh.rotationQuaternion.copyFrom(
              meshState.rotationQuaternion,
            );
          }

          // Check if there's a scale block in the DO section (created by gizmo)
          let scaleBlock = null;
          const modelVariable = block.getFieldValue("ID_VAR");
          const doInput = block.getInput("DO");
          if (
            doInput &&
            doInput.connection &&
            doInput.connection.targetBlock()
          ) {
            let currentBlock = doInput.connection.targetBlock();
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

          // Check if mesh has gizmo scaling (either from mesh.scaling or scale block)
          const hasGizmoScaling =
            scaleBlock ||
            (meshState.scaling &&
              (Math.abs(meshState.scaling.x - 1) > 0.001 ||
                Math.abs(meshState.scaling.y - 1) > 0.001 ||
                Math.abs(meshState.scaling.z - 1) > 0.001)) ||
            (parseFloat(scale) === 1.0 && meshState.scaling); // Scale block case: block scale is 1 but has custom scaling

          // Use setTimeout to let setupMesh complete, then apply scaling
          setTimeout(() => {
            if (scaleBlock) {
              // Apply scale block transformation using flock.scale API
              const scaleX = parseFloat(
                scaleBlock
                  .getInput("X")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );
              const scaleY = parseFloat(
                scaleBlock
                  .getInput("Y")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );
              const scaleZ = parseFloat(
                scaleBlock
                  .getInput("Z")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );

              // Get scale origin settings (if they exist)
              const xOrigin = scaleBlock.getFieldValue("X_ORIGIN") || "CENTRE";
              const yOrigin = scaleBlock.getFieldValue("Y_ORIGIN") || "BASE"; // BASE for bottom alignment
              const zOrigin = scaleBlock.getFieldValue("Z_ORIGIN") || "CENTRE";

              // Apply scaling using the flock.scale API (which handles positioning correctly)
              flock.scale(loadedMesh.name, {
                x: scaleX,
                y: scaleY,
                z: scaleZ,
                xOrigin: xOrigin,
                yOrigin: yOrigin,
                zOrigin: zOrigin,
              });

              // Wait for scale to complete, then align bottoms
              setTimeout(() => {
                loadedMesh.computeWorldMatrix(true);
                loadedMesh.refreshBoundingInfo();
                const newMeshCurrentBottomY =
                  loadedMesh.getBoundingInfo().boundingBox.minimumWorld.y;

                // Calculate the Y adjustment needed to align bottoms
                const yAdjustment =
                  meshState.currentBottomY - newMeshCurrentBottomY;
                loadedMesh.position.y += yAdjustment;
              }, 100);
            } else if (hasGizmoScaling) {
              // No scale block, apply direct mesh scaling
              loadedMesh.scaling.copyFrom(meshState.scaling);

              // Calculate bottom alignment after scaling
              loadedMesh.computeWorldMatrix(true);
              loadedMesh.refreshBoundingInfo();
              const newMeshCurrentBottomY =
                loadedMesh.getBoundingInfo().boundingBox.minimumWorld.y;

              // Calculate the Y adjustment needed to align bottoms
              const yAdjustment =
                meshState.currentBottomY - newMeshCurrentBottomY;
              loadedMesh.position.y += yAdjustment;
            }
          }, 100); // Give setupMesh time to complete

          // Apply any Y offset from metadata
          if (
            loadedMesh.metadata?.yOffset &&
            loadedMesh.metadata.yOffset !== 0
          ) {
            loadedMesh.position.y +=
              parseFloat(scale) * loadedMesh.metadata.yOffset;
          }
          loadedMesh.isVisible = meshState.isVisible;

          // Restore metadata
          if (meshState.metadata) {
            loadedMesh.metadata = { ...meshState.metadata };
            loadedMesh.metadata.blockKey = meshState.blockKey;
          }

          // Preserve the original base name for future trigger lookups
          loadedMesh.metadata.originalBaseName = meshState.originalBaseName;

          // Restore physics if it existed
          if (meshState.physics && loadedMesh.physics) {
            if (meshState.physics.motionType !== undefined) {
              loadedMesh.physics.setMotionType(meshState.physics.motionType);
            }
            loadedMesh.physics.disablePreStep =
              meshState.physics.disablePreStep;
            loadedMesh.savedMotionType = meshState.savedMotionType;
          }

          // Update physics to ensure collision detection works
          flock.updatePhysics(loadedMesh);

          // Re-apply any pending triggers using the original mesh base name
          const newMeshName = loadedMesh.name;
          const originalBaseName = meshState.originalBaseName;

          if (
            flock.pendingTriggers &&
            flock.pendingTriggers.has(originalBaseName)
          ) {
            const triggers = flock.pendingTriggers.get(originalBaseName);
            triggers.forEach(({ trigger, callback, mode }) => {
              flock.onTrigger(newMeshName, {
                trigger,
                callback,
                mode,
                applyToGroup: false,
              });
            });
          }
        }
      },
    });
  } else {
    newMesh = flock.createObject({
      modelName: newModelName,
      modelId: tempMeshId,
      color: color,
      scale: parseFloat(scale),
      position: {
        x: meshState.position.x,
        y: meshState.currentBlockPosition.y, // Use block Y as base since setupMesh will adjust it
        z: meshState.position.z,
      },
      callback: () => {
        // Get the newly loaded mesh using our lookup function
        const loadedMesh = getMeshFromBlock(block);

        // Ensure the new mesh has the correct blockKey metadata immediately
        if (loadedMesh && typeof loadedMesh === "object") {
          loadedMesh.metadata = loadedMesh.metadata || {};
          loadedMesh.metadata.blockKey = meshState.blockKey;

          // Rename the mesh to preserve the original name
          loadedMesh.name = targetName;
        } else {
          return;
        }

        if (loadedMesh && loadedMesh !== currentMesh) {
          // Restore transform state, but adjust Y position for new mesh size
          loadedMesh.position.x = meshState.position.x;
          loadedMesh.position.z = meshState.position.z;

          // Restore rotation first
          if (meshState.rotation) {
            loadedMesh.rotation.copyFrom(meshState.rotation);
          }
          if (meshState.rotationQuaternion) {
            loadedMesh.rotationQuaternion.copyFrom(
              meshState.rotationQuaternion,
            );
          }

          // Check if there's a scale block in the DO section (created by gizmo)
          let scaleBlock = null;
          const modelVariable = block.getFieldValue("ID_VAR");
          const doInput = block.getInput("DO");
          if (
            doInput &&
            doInput.connection &&
            doInput.connection.targetBlock()
          ) {
            let currentBlock = doInput.connection.targetBlock();
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

          // Check if mesh has gizmo scaling (either from mesh.scaling or scale block)
          const hasGizmoScaling =
            scaleBlock ||
            (meshState.scaling &&
              (Math.abs(meshState.scaling.x - 1) > 0.001 ||
                Math.abs(meshState.scaling.y - 1) > 0.001 ||
                Math.abs(meshState.scaling.z - 1) > 0.001)) ||
            (parseFloat(scale) === 1.0 && meshState.scaling); // Scale block case: block scale is 1 but has custom scaling

          // Use setTimeout to let setupMesh complete, then apply scaling
          setTimeout(() => {
            if (scaleBlock) {
              // Apply scale block transformation using flock.scale API
              const scaleX = parseFloat(
                scaleBlock
                  .getInput("X")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );
              const scaleY = parseFloat(
                scaleBlock
                  .getInput("Y")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );
              const scaleZ = parseFloat(
                scaleBlock
                  .getInput("Z")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );

              // Get scale origin settings (if they exist)
              const xOrigin = scaleBlock.getFieldValue("X_ORIGIN") || "CENTRE";
              const yOrigin = scaleBlock.getFieldValue("Y_ORIGIN") || "BASE"; // BASE for bottom alignment
              const zOrigin = scaleBlock.getFieldValue("Z_ORIGIN") || "CENTRE";

              // Apply scaling using the flock.scale API (which handles positioning correctly)
              flock.scale(loadedMesh.name, {
                x: scaleX,
                y: scaleY,
                z: scaleZ,
                xOrigin: xOrigin,
                yOrigin: yOrigin,
                zOrigin: zOrigin,
              });

              // Wait for scale to complete, then align bottoms
              setTimeout(() => {
                loadedMesh.computeWorldMatrix(true);
                loadedMesh.refreshBoundingInfo();
                const newMeshCurrentBottomY =
                  loadedMesh.getBoundingInfo().boundingBox.minimumWorld.y;

                // Calculate the Y adjustment needed to align bottoms
                const yAdjustment =
                  meshState.currentBottomY - newMeshCurrentBottomY;
                loadedMesh.position.y += yAdjustment;
              }, 100);
            } else if (hasGizmoScaling) {
              // No scale block, apply direct mesh scaling
              loadedMesh.scaling.copyFrom(meshState.scaling);

              // Calculate bottom alignment after scaling
              loadedMesh.computeWorldMatrix(true);
              loadedMesh.refreshBoundingInfo();
              const newMeshCurrentBottomY =
                loadedMesh.getBoundingInfo().boundingBox.minimumWorld.y;

              // Calculate the Y adjustment needed to align bottoms
              const yAdjustment =
                meshState.currentBottomY - newMeshCurrentBottomY;
              loadedMesh.position.y += yAdjustment;
            }
          }, 100); // Give setupMesh time to complete

          // Apply any Y offset from metadata
          if (
            loadedMesh.metadata?.yOffset &&
            loadedMesh.metadata.yOffset !== 0
          ) {
            loadedMesh.position.y +=
              parseFloat(scale) * loadedMesh.metadata.yOffset;
          }
          loadedMesh.isVisible = meshState.isVisible;

          // Restore metadata
          if (meshState.metadata) {
            loadedMesh.metadata = { ...meshState.metadata };
            loadedMesh.metadata.blockKey = meshState.blockKey;
          }

          // Preserve the original base name for future trigger lookups
          loadedMesh.metadata.originalBaseName = meshState.originalBaseName;

          // Restore physics if it existed
          if (meshState.physics && loadedMesh.physics) {
            if (meshState.physics.motionType !== undefined) {
              loadedMesh.physics.setMotionType(meshState.physics.motionType);
            }
            loadedMesh.physics.disablePreStep =
              meshState.physics.disablePreStep;
            loadedMesh.savedMotionType = meshState.savedMotionType;
          }

          // Apply colors based on block type
          if (
            block.type === "load_character" &&
            color &&
            Object.keys(color).length > 0
          ) {
            flock.applyColorsToCharacter(loadedMesh, color);
          } else if (
            block.type === "load_multi_object" &&
            Array.isArray(color) &&
            color.length > 0
          ) {
            // Multi-object color application - reuse existing logic
            //flock.applyColorsToMesh(loadedMesh, color);
          } else if (color && typeof color === "string") {
            // Single object color application
            flock.applyColorToMaterial(loadedMesh, null, color);
          }

          // Update physics to ensure collision detection works
          flock.updatePhysics(loadedMesh);

          // Re-apply any pending triggers using the original mesh base name
          const newMeshName = loadedMesh.name;
          const originalBaseName = meshState.originalBaseName;

          if (
            flock.pendingTriggers &&
            flock.pendingTriggers.has(originalBaseName)
          ) {
            const triggers = flock.pendingTriggers.get(originalBaseName);
            triggers.forEach(({ trigger, callback, mode }) => {
              flock.onTrigger(newMeshName, {
                trigger,
                callback,
                mode,
                applyToGroup: false,
              });
            });
          }
        }
      },
    });
  }
}

export function updateBlockColorAndHighlight(mesh, selectedColor) {
  
  // ---------- helpers ----------
  const withUndoGroup = (fn) => {
    try {
      Blockly.Events.setGroup(true);
      fn();
    } finally {
      Blockly.Events.setGroup(false);
    }
  };

  const getUltimateParent = (m) =>
    m?.parent ? getUltimateParent(m.parent) : m;

  // Try to set colour on a target block (colour picker) or, failing that, on the parent block's field.
  const setColorOnTargetOrField = (targetBlock, parentBlock, colorHex) => {
    if (targetBlock) {
      if (targetBlock.getField?.("COLOR")) {
        targetBlock.setFieldValue(colorHex, "COLOR");
        return true;
      }
      if (targetBlock.getField?.("COLOUR")) {
        targetBlock.setFieldValue(colorHex, "COLOUR");
        return true;
      }
    }
    if (parentBlock) {
      if (parentBlock.getField?.("COLOR")) {
        parentBlock.setFieldValue(colorHex, "COLOR");
        return true;
      }
      if (parentBlock.getField?.("COLOUR")) {
        parentBlock.setFieldValue(colorHex, "COLOUR");
        return true;
      }
    }
    return false;
  };

  // Ensure a colour target exists on an input: connect shadow if needed, then return the target block.
  const ensureColorTargetOnInput = (input) => {
    if (!input?.connection) return null;
    let tgt = input.connection.targetBlock?.();
    const ws = input.sourceBlock_?.workspace;
    if (!tgt && ws) {
      // materialize existing shadow if present
      const shadowDom = input.connection.getShadowDom?.();
      if (shadowDom) {
        const shadowBlock = Blockly.Xml.domToBlock(shadowDom, ws);
        if (shadowBlock?.outputConnection)
          input.connection.connect(shadowBlock.outputConnection);
        tgt = input.connection.targetBlock?.();
      }
      // or create a new colour picker shadow
      if (!tgt) {
        const picker = ws.newBlock("colour_picker");
        picker.setShadow(true);
        picker.initSvg();
        picker.render();
        input.connection.connect(picker.outputConnection);
        tgt = picker;
      }
    }
    return tgt || null;
  };

  // Heuristic: is this input likely to be a color input?
  const isColorishName = (name) =>
    /(?:^|_)(MAP_)?COL(?:OU)?R$/i.test(name || "");

  // Depth-first search for a colour input/field anywhere under a block.
  // Returns { input, targetBlock, ownerBlock } where:
  //  - input: the Input that should hold a color picker (could be nested)
  //  - targetBlock: the colour picker (created if needed)
  //  - ownerBlock: the block that owns `input` (fallback for direct field set)
  const findNestedColorTarget = (rootBlock, visited = new Set()) => {
    if (!rootBlock || visited.has(rootBlock.id)) return null;
    visited.add(rootBlock.id);

    // 0) direct field on this block (rare but cheap to check)
    if (rootBlock.getField?.("COLOR") || rootBlock.getField?.("COLOUR")) {
      return { input: null, targetBlock: rootBlock, ownerBlock: rootBlock };
    }

    // 1) look for an input that is explicitly colour-ish
    for (const inp of rootBlock.inputList || []) {
      if (isColorishName(inp?.name)) {
        const targetBlock = ensureColorTargetOnInput(inp);
        return { input: inp, targetBlock, ownerBlock: rootBlock };
      }
    }

    // 2) Otherwise, traverse all connected children; many designs have a MATERIAL input → material block → colour input
    for (const inp of rootBlock.inputList || []) {
      const child = inp?.connection?.targetBlock?.();
      if (!child) continue;
      const found = findNestedColorTarget(child, visited);
      if (found) return found;
    }

    return null;
  };

  const materialToFieldMap = {
    Hair: "HAIR_COLOR",
    Skin: "SKIN_COLOR",
    Eyes: "EYES_COLOR",
    Sleeves: "SLEEVES_COLOR",
    Shorts: "SHORTS_COLOR",
    TShirt: "TSHIRT_COLOR",
  };

  // ---------- main ----------
  let block = null;

  // Special case: sky fallback
  if (!mesh) {
    block = meshMap?.["sky"];
    if (!block) {
      // Create a sky block if one doesn't exist.
      // block = Blockly.getMainWorkspace().newBlock("set_sky_color");
      // if (flock.blockDebug) console.log(selectedColor);
      // block.setFieldValue(selectedColor, "COLOR");
      // block.initSvg();
      // block.render();
      // let connection = block.getInput("DO").connection;
      // if (connection) {
      //   connection.connect(block.previousConnection);
      // }
      createBlockWithShadows(null, null, selectedColor);
      updateBlockColorAndHighlight(mesh, selectedColor);
      return;
    }
    withUndoGroup(() => {
      const found = findNestedColorTarget(block);
      if (!found) {
        console.warn("[color] No color target found on 'sky' block");
        return;
      }
      setColorOnTargetOrField(
        found.targetBlock,
        found.ownerBlock,
        selectedColor,
      );
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  // Mesh → block
  const root = getUltimateParent(mesh);
  const blockKey = root?.metadata?.blockKey;

  if (!blockKey || !meshMap?.[blockKey]) {
    console.warn("[color] Block not found for mesh", {
      mesh: mesh?.name,
      blockKey,
      root: root?.name,
    });
    return;
  }
  block = meshMap[blockKey];

  const materialName = mesh?.material?.name?.replace(/_clone$/, "");
  const colorIndex = mesh?.metadata?.materialIndex;

  // 1) Character sub-mesh path (these use fixed field inputs on the character block)
  if (
    materialName &&
    Object.prototype.hasOwnProperty.call(materialToFieldMap, materialName)
  ) {
    const fieldName = materialToFieldMap[materialName];
    const input = block.getInput(fieldName);
    if (!input) {
      console.warn(
        `[color] Character field input '${fieldName}' not found on '${block.type}'`,
      );
      return;
    }
    withUndoGroup(() => {
      const target = ensureColorTargetOnInput(input);
      setColorOnTargetOrField(target, block, selectedColor);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  // 2) Multi-object path stays as-is
  if (block.type === "load_multi_object") {
    withUndoGroup(() => {
      block.updateColorAtIndex?.(selectedColor, colorIndex);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  // 3) Generic / map / ground / load_object, including NESTED MATERIAL BLOCKS
  //    We now search recursively for a colour input under this block.
  const found = findNestedColorTarget(block);
  if (!found) {
    console.warn(
      `[color] No nested color target found under block '${block.type}' for mesh '${mesh.name}'`,
    );
    return;
  }

  // Respect your special purple → config default for load_object (only if top-level is load_object).
  const isDefaultPurple = selectedColor?.toLowerCase?.() === "#9932cc";
  let finalColor = selectedColor;
  if (
    block.type === "load_object" &&
    isDefaultPurple &&
    typeof objectColours === "object"
  ) {
    finalColor = objectColours[block.getFieldValue?.("MODELS")] || "#FFD700";
  }

  withUndoGroup(() => {
    setColorOnTargetOrField(found.targetBlock, found.ownerBlock, finalColor);
    block.initSvg?.();
    highlightBlockById(Blockly.getMainWorkspace(), block);
  });
}
