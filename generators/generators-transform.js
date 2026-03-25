import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap, generateUniqueId } from "./mesh-state.js";
import { getFieldValue } from "./generators-utilities.js";

export function registerTransformGenerators(javascriptGenerator) {
  // -------------------------------
  // TRANSFORM
  // -------------------------------

  // Change position of object by xyz coordinates
  javascriptGenerator.forBlock["move_by_xyz"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("BLOCK_NAME"),
      Blockly.Names.NameType.VARIABLE,
    );

    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");

    return `await moveByVector(${modelName}, { x: ${x}, y: ${y}, z: ${z} });\n`;
  };

  // Change position of object by single xyz coordinate
  javascriptGenerator.forBlock["move_by_xyz_single"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("BLOCK_NAME"),
      Blockly.Names.NameType.VARIABLE,
    );

    const coordinate = block.getFieldValue("COORDINATE") || "x_coordinate";
    const value = getFieldValue(block, "VALUE", "0");

    switch (coordinate) {
      case "x_coordinate":
        return `await moveByVector(${modelName}, { x: ${value}, y: 0, z: 0 });\n`;
      case "y_coordinate":
        return `await moveByVector(${modelName}, { x: 0, y: ${value}, z: 0 });\n`;
      case "z_coordinate":
        return `await moveByVector(${modelName}, { x: 0, y: 0, z: ${value} });\n`;
    }
  };

  // Set position of object to xyz coordinates
  javascriptGenerator.forBlock["move_to_xyz"] = function (block) {
    const meshName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL"),
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

    const useY = block.getFieldValue("USE_Y") === "TRUE";

    return `await positionAt(${meshName}, { x: ${x}, y: ${y}, z: ${z}, useY: ${useY} });\n`;
  };

  // Set position of object to single xyz coordinate
  javascriptGenerator.forBlock["move_to_xyz_single"] = function (block) {
    const meshName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL"),
      Blockly.Names.NameType.VARIABLE,
    );

    const coordinate = block.getFieldValue("COORDINATE") || "x_coordinate";
    const value = getFieldValue(block, "VALUE", "0");

    return `await positionAtSingleCoordinate(${meshName}, "${coordinate}", ${value});\n`;
  };

  // Set position of object to another object's position
  javascriptGenerator.forBlock["move_to"] = function (block) {
    const meshName1 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL1"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshName2 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL2"),
      Blockly.Names.NameType.VARIABLE,
    );

    const useY = block.getFieldValue("USE_Y") === "TRUE";

    return `await moveTo(${meshName1}, { target: ${meshName2}, useY: ${useY} });\n`;
  };

  // Rotate object BY xyz coordinates
  javascriptGenerator.forBlock["rotate_model_xyz"] = function (block) {
    const meshName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL"),
      Blockly.Names.NameType.VARIABLE,
    );

    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");

    return `await rotate(${meshName}, { x: ${x}, y: ${y}, z: ${z} });\n`;
  };

  // Rotate object TO specific xyz coordinates
  javascriptGenerator.forBlock["rotate_to"] = function (block) {
    const meshName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL"),
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

    return `await rotateTo(${meshName}, { x: ${x}, y: ${y}, z: ${z} });\n`;
  };

  // Look object at another object
  javascriptGenerator.forBlock["look_at"] = function (block) {
    const meshName1 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL1"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshName2 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL2"),
      Blockly.Names.NameType.VARIABLE,
    );

    const useY = block.getFieldValue("USE_Y") === "TRUE";

    return `await lookAt(${meshName1}, { target: ${meshName2}, useY: ${useY} });\n`;
  };

  // Scale object by xyz coordinates
  javascriptGenerator.forBlock["scale"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("BLOCK_NAME"),
      Blockly.Names.NameType.VARIABLE,
    );
    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");

    // Retrieve the origin values for x, y, and z axes
    const xOrigin = block.getFieldValue("X_ORIGIN") || "'CENTRE'";
    const yOrigin = block.getFieldValue("Y_ORIGIN") || "'CENTRE'";
    const zOrigin = block.getFieldValue("Z_ORIGIN") || "'CENTRE'";

    return `await scale(${modelName}, { x: ${x}, y: ${y}, z: ${z}, xOrigin: '${xOrigin}', yOrigin: '${yOrigin}', zOrigin: '${zOrigin}' });\n`;
  };

  // Resize object by xyz coordinates
  javascriptGenerator.forBlock["resize"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("BLOCK_NAME"),
      Blockly.Names.NameType.VARIABLE,
    );
    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");

    // Retrieve the origin values for x, y, and z axes
    const xOrigin = block.getFieldValue("X_ORIGIN") || "'CENTRE'";
    const yOrigin = block.getFieldValue("Y_ORIGIN") || "'CENTRE'";
    const zOrigin = block.getFieldValue("Z_ORIGIN") || "'CENTRE'";

    return `await resize(${modelName}, { width: ${x}, height: ${y}, depth: ${z}, xOrigin: '${xOrigin}', yOrigin: '${yOrigin}', zOrigin: '${zOrigin}' });\n`;
  };

  // Set anchor of object by xyz coordinates
  javascriptGenerator.forBlock["set_pivot"] = function (block) {
    const meshVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    const xPivot =
      javascriptGenerator.valueToCode(
        block,
        "X_PIVOT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 0;
    const yPivot =
      javascriptGenerator.valueToCode(
        block,
        "Y_PIVOT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 0;
    const zPivot =
      javascriptGenerator.valueToCode(
        block,
        "Z_PIVOT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || 0;

    return `await setAnchor(${meshVar}, { xPivot: ${xPivot}, yPivot: ${yPivot}, zPivot: ${zPivot} });\n`;
  };

  // -------------------------------
  // PHYSICS
  // -------------------------------

  // Add physics to object
  javascriptGenerator.forBlock["add_physics"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const physicsType = block.getFieldValue("PHYSICS_TYPE");

    // Note: Ensure that the execution environment supports async/await at this level
    return `await setPhysics(${modelName}, "${physicsType}");\n`;
  };

  // Add physics shape to object
  javascriptGenerator.forBlock["add_physics_shape"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const shapeType = block.getFieldValue("SHAPE_TYPE");

    // Note: Ensure that the execution environment supports async/await at this level
    return `await setPhysicsShape(${modelName}, "${shapeType}");\n`;
  };

  // Apply force to object
  javascriptGenerator.forBlock["apply_force"] = function (block) {
    // Get the name of the mesh variable
    const mesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    // Get the force values
    const forceX =
      javascriptGenerator.valueToCode(
        block,
        "X",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const forceY =
      javascriptGenerator.valueToCode(
        block,
        "Y",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const forceZ =
      javascriptGenerator.valueToCode(
        block,
        "Z",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";

    // Generate the code
    return `applyForce(${mesh}, { forceX: ${forceX}, forceY: ${forceY}, forceZ: ${forceZ} });\n`;
  };

  // Show physics shapes
  javascriptGenerator.forBlock["show_physics"] = function (block) {
    const show = block.getFieldValue("SHOW") === "TRUE";
    return `showPhysics(${show});\n`;
  };

  // Move object forward
  javascriptGenerator.forBlock["move_forward"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL"),
      Blockly.Names.NameType.VARIABLE,
    );
    const speed =
      javascriptGenerator.valueToCode(
        block,
        "SPEED",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const direction = block.getFieldValue("DIRECTION");

    // Choose the appropriate helper function based on the direction
    let helperFunction;
    switch (direction) {
      case "sideways":
        helperFunction = "moveSideways";
        break;
      case "strafe":
        helperFunction = "strafe";
        break;
      default:
        helperFunction = "moveForward";
    }

    return `${helperFunction}(${modelName}, ${speed});\n`;
  };

  // -------------------------------
  // CONNECT
  // -------------------------------

  // Parent child
  javascriptGenerator.forBlock["parent"] = function (block) {
    const parentMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("PARENT_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const childMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("CHILD_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    // Establish the parent-child relationship with offset
    return `setParent(${parentMesh}, ${childMesh});\n`;
  };

  // Parent child with offset
  javascriptGenerator.forBlock["parent_child"] = function (block) {
    const parentMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("PARENT_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const childMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("CHILD_MESH"),
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

    // Establish the parent-child relationship with offset
    return `parentChild(${parentMesh}, ${childMesh}, ${xOffset}, ${yOffset}, ${zOffset});\n`;
  };

  // Remove parent from object
  javascriptGenerator.forBlock["remove_parent"] = function (block) {
    const childMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("CHILD_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    return `removeParent(${childMesh});\n`;
  };

  // Make follower follow target
  javascriptGenerator.forBlock["follow"] = function (block) {
    const followerMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("FOLLOWER_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const targetMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("TARGET_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const followPosition = block.getFieldValue("FOLLOW_POSITION");

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

    // Use the helper method makeFollow for following the target
    const code = `
                        makeFollow(${followerMesh}, ${targetMesh}, "${followPosition}", ${xOffset}, ${yOffset}, ${zOffset});
                `;
    return code;
  };

  // Stop following object
  javascriptGenerator.forBlock["stop_follow"] = function (block) {
    const followerModelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("FOLLOWER_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    // Generate code to call the stopFollow helper function
    const code = `stopFollow("${followerModelName}");\n`;
    return code;
  };

  // Attach object to target at hold
  javascriptGenerator.forBlock["attach"] = function (block) {
    const meshToAttach = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_TO_ATTACH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const targetMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("TARGET_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const boneName = block.getFieldValue("BONE_NAME");
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
    // Establish the attach action with bone name and offset
    return `await attach(${meshToAttach}, ${targetMesh}, { boneName: "${boneName}", x: ${xOffset}, y: ${yOffset}, z: ${zOffset} });
        `;
  };

  // Drop object
  javascriptGenerator.forBlock["drop"] = function (block) {
    const meshToDetach = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_TO_DETACH"),
      Blockly.Names.NameType.VARIABLE,
    );

    // Establish the drop action
    return `await drop(${meshToDetach});
        `;
  };

  // -------------------------------
  // COMBINE
  // -------------------------------

  // Add merged as merge list
  javascriptGenerator.forBlock["merge_meshes"] = function (block) {
    const resultVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("RESULT_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshList =
      javascriptGenerator.valueToCode(
        block,
        "MESH_LIST",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "[]";

    const meshId = "merged" + "_" + generateUniqueId();
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;

    // Use helper function to merge the meshes
    return `${resultVar} = await mergeMeshes("${meshId}", ${meshList});\n`;
  };

  // Add subtracted as object subtract list
  javascriptGenerator.forBlock["subtract_meshes"] = function (block) {
    const resultVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("RESULT_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const baseMesh = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("BASE_MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshList =
      javascriptGenerator.valueToCode(
        block,
        "MESH_LIST",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "[]";

    const meshId = "subtracted" + "_" + generateUniqueId();
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;

    // Use helper function to subtract meshes from the base mesh
    return `${resultVar} = await subtractMeshes("${meshId}", ${baseMesh}, ${meshList});\n`;
  };

  // Add intersection as intersect list
  javascriptGenerator.forBlock["intersection_meshes"] = function (block) {
    const resultVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("RESULT_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshList =
      javascriptGenerator.valueToCode(
        block,
        "MESH_LIST",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "[]";

    const meshId = "intersected" + "_" + generateUniqueId();
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;

    // Use helper function to intersect the meshes
    return `${resultVar} = await intersectMeshes("${meshId}", ${meshList});\n`;
  };

  // Add hull as hull list
  javascriptGenerator.forBlock["hull_meshes"] = function (block) {
    const resultVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("RESULT_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshList =
      javascriptGenerator.valueToCode(
        block,
        "MESH_LIST",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "[]";

    const meshId = "hull" + "_" + generateUniqueId();
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;

    // Use helper function to create the hull
    return `${resultVar} = await createHull("${meshId}", ${meshList});\n`;
  };
}
