import * as Blockly from "blockly";
import { getFieldValue } from "./generators-utilities.js";

export function registerAnimateGenerators(javascriptGenerator) {
  // -------------------------------
  // ANIMATE
  // -------------------------------
  // Switch animation to
  javascriptGenerator.forBlock["switch_animation"] = function (block) {
    const model = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL"),
      Blockly.Names.NameType.VARIABLE,
    );
    const animationName =
      javascriptGenerator.valueToCode(
        block,
        "ANIMATION_NAME",
        javascriptGenerator.ORDER_NONE,
      ) || '"Idle"';
    const code = `switchAnimation(${model}, { animationName: ${animationName} });\n`;
    return code;
  };

  // Play animation on object
  javascriptGenerator.forBlock["play_animation"] = function (block) {
    const model = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL"),
      Blockly.Names.NameType.VARIABLE,
    );
    const animationName =
      javascriptGenerator.valueToCode(
        block,
        "ANIMATION_NAME",
        javascriptGenerator.ORDER_NONE,
      ) || '"Idle"';
    const code = `await playAnimation(${model}, { animationName: ${animationName} });\n`;
    return code;
  };

  // Animation name
  javascriptGenerator.forBlock["animation_name"] = function (block) {
    const animationName = block.getFieldValue("ANIMATION_NAME");
    return [`"${animationName}"`, javascriptGenerator.ORDER_ATOMIC];
  };

  // Glide to coordinates
  javascriptGenerator.forBlock["glide_to_seconds"] = function (block) {
    const meshName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const x = getFieldValue(block, "X", "0");
    const y = getFieldValue(block, "Y", "0");
    const z = getFieldValue(block, "Z", "0");
    const duration = getFieldValue(block, "DURATION", "0");
    const mode = block.getFieldValue("MODE");
    const reverse = block.getFieldValue("REVERSE") === "TRUE";
    const loop = block.getFieldValue("LOOP") === "TRUE";
    const easing = block.getFieldValue("EASING");

    const asyncWrapper = mode === "AWAIT" ? "await " : "";

    return `${asyncWrapper}glideTo(${meshName}, { x: ${x}, y: ${y}, z: ${z}, duration: ${duration}, reverse: ${reverse}, loop: ${loop}, easing: "${easing}" });\n`;
  };

  // Glide to object
  javascriptGenerator.forBlock["glide_to_object"] = function (block) {
    const meshName1 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL1"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshName2 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL2"),
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
    const duration = getFieldValue(block, "DURATION", "0");
    const mode = block.getFieldValue("MODE");
    const reverse = block.getFieldValue("REVERSE") === "TRUE";
    const loop = block.getFieldValue("LOOP") === "TRUE";
    const easing = block.getFieldValue("EASING");
    const asyncWrapper = mode === "AWAIT" ? "await " : "";

    return `${asyncWrapper}glideToObject(${meshName1}, ${meshName2}, { offsetX: ${xOffset}, offsetY: ${yOffset}, offsetZ: ${zOffset}, duration: ${duration}, reverse: ${reverse}, loop: ${loop}, easing: "${easing}" });\n`;
  };

  // Rotate object to coordinates
  javascriptGenerator.forBlock["rotate_anim_seconds"] = function (block) {
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

  // Rotate object towards object
  javascriptGenerator.forBlock["rotate_to_object"] = function (block) {
    const meshName1 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL1"),
      Blockly.Names.NameType.VARIABLE,
    );
    const meshName2 = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL2"),
      Blockly.Names.NameType.VARIABLE,
    );
    const rotateMode = block.getFieldValue("ROTATE_MODE");
    const apiRotateMode =
      rotateMode === "SAME_ROTATION" ? "same_rotation" : "towards";
    const duration = getFieldValue(block, "DURATION", "0");
    const mode = block.getFieldValue("MODE");
    const reverse = block.getFieldValue("REVERSE") === "TRUE";
    const loop = block.getFieldValue("LOOP") === "TRUE";
    const easing = block.getFieldValue("EASING");

    const asyncWrapper = mode === "AWAIT" ? "await " : "";

    return `${asyncWrapper}rotateToObject(${meshName1}, ${meshName2}, { mode: "${apiRotateMode}", duration: ${duration}, reverse: ${reverse}, loop: ${loop}, easing: "${easing}" });\n`;
  };

  // Stop animations on object
  javascriptGenerator.forBlock["stop_animations"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return `await stopAnimations(${modelName});\n`;
  };
  // -------------------------------
  // KEYFRAME
  // -------------------------------
  // Animate keyframes on object group
  javascriptGenerator.forBlock["animation"] = function (block) {
    const meshVariable = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const property = block.getFieldValue("PROPERTY");
    const animationGroupVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ANIMATION_GROUP"),
      Blockly.Names.NameType.VARIABLE,
    );
    const keyframesBlock = block.getInputTargetBlock("KEYFRAMES");
    const keyframesArray = [];

    if (keyframesBlock) {
      // Loop through keyframe blocks to gather data
      for (let i = 0; i < keyframesBlock.inputList.length; i++) {
        const keyframeInput = keyframesBlock.inputList[i];
        const valueBlock = keyframeInput.connection
          ? keyframeInput.connection.targetBlock()
          : null;
        let value;

        if (valueBlock) {
          // If the keyframe block is of type "colour_keyframe", treat it as a color keyframe.
          if (valueBlock.type === "colour_keyframe") {
            value = javascriptGenerator.valueToCode(
              valueBlock,
              "VALUE",
              javascriptGenerator.ORDER_NONE,
            );
          } else if (property === "color") {
            // Otherwise, if property equals "color", extract as a color.
            value = javascriptGenerator.valueToCode(
              valueBlock,
              "VALUE",
              javascriptGenerator.ORDER_NONE,
            );
          } else if (["position", "rotation", "scaling"].includes(property)) {
            // For vector keyframes, extract X, Y, and Z.
            const x =
              javascriptGenerator.valueToCode(
                valueBlock,
                "X",
                javascriptGenerator.ORDER_ATOMIC,
              ) || 0;
            const y =
              javascriptGenerator.valueToCode(
                valueBlock,
                "Y",
                javascriptGenerator.ORDER_ATOMIC,
              ) || 0;
            const z =
              javascriptGenerator.valueToCode(
                valueBlock,
                "Z",
                javascriptGenerator.ORDER_ATOMIC,
              ) || 0;
            value = `createVector3(${x}, ${y}, ${z})`;
          } else {
            // Handle alpha or other scalar properties.
            value = javascriptGenerator.valueToCode(
              valueBlock,
              "VALUE",
              javascriptGenerator.ORDER_ATOMIC,
            );
          }
        } else {
          // Default value for missing blocks.
          value =
            property === "color" || property === "colour_keyframe"
              ? '"#ffffff"'
              : `createVector3(0, 0, 0)`;
        }

        // Retrieve the duration (using the same connection as value).
        const durationBlock = keyframeInput.connection
          ? keyframeInput.connection.targetBlock()
          : null;
        const duration = durationBlock
          ? javascriptGenerator.valueToCode(
              durationBlock,
              "DURATION",
              javascriptGenerator.ORDER_ATOMIC,
            )
          : "1"; // Default duration of 1 second if not specified

        keyframesArray.push({ value, duration });
      }
    }

    const easing = block.getFieldValue("EASING") || "Linear";
    const reverse = block.getFieldValue("REVERSE") === "TRUE";
    const loop = block.getFieldValue("LOOP") === "TRUE";
    const mode = block.getFieldValue("MODE");

    const keyframesCode = keyframesArray
      .map(
        (kf) => `{
                          value: ${kf.value}, 
                          duration: ${kf.duration}
                    }`,
      )
      .join(", ");

    return `
                  ${animationGroupVar} = await createAnimation(
                    ${animationGroupVar},
                    ${meshVariable},
                    {
                          property: "${property}",
                          keyframes: [${keyframesCode}],
                          easing: "${easing}",
                          reverse: ${reverse},
                          loop: ${loop},
                          mode: "${mode}"
                    }
                  );
            `;
  };

  // Animate keyframes on object
  javascriptGenerator.forBlock["animate_keyframes"] = function (block) {
    const meshVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const keyframesBlock = block.getInputTargetBlock("KEYFRAMES");
    const keyframesArray = [];

    if (keyframesBlock) {
      // Loop through keyframe blocks to gather data
      for (let i = 0; i < keyframesBlock.inputList.length; i++) {
        const keyframeInput = keyframesBlock.inputList[i];

        const valueBlock = keyframeInput.connection
          ? keyframeInput.connection.targetBlock()
          : null;
        const durationBlock = keyframeInput.connection
          ? keyframeInput.connection.targetBlock()
          : null;

        let value;
        const property = block.getFieldValue("PROPERTY");

        if (valueBlock) {
          if (property === "color") {
            // Handle color keyframe (as a string)
            value = javascriptGenerator.valueToCode(
              valueBlock,
              "VALUE",
              javascriptGenerator.ORDER_NONE,
            );
          } else if (["position", "rotation", "scaling"].includes(property)) {
            // Handle XYZ (Vector3) keyframe for position, rotation, or scaling
            const x =
              javascriptGenerator.valueToCode(
                valueBlock,
                "X",
                javascriptGenerator.ORDER_ATOMIC,
              ) || 0;
            const y =
              javascriptGenerator.valueToCode(
                valueBlock,
                "Y",
                javascriptGenerator.ORDER_ATOMIC,
              ) || 0;
            const z =
              javascriptGenerator.valueToCode(
                valueBlock,
                "Z",
                javascriptGenerator.ORDER_ATOMIC,
              ) || 0;
            value = `createVector3(${x}, ${y}, ${z})`; // Generate the text for Vector3, not the object itself
          } else {
            // Handle alpha or other properties
            value = javascriptGenerator.valueToCode(
              valueBlock,
              "VALUE",
              javascriptGenerator.ORDER_ATOMIC,
            );
          }
        } else {
          // Default values for missing blocks
          value = property === "color" ? '"#ffffff"' : `createVector3(0, 0, 0)`; // Correct color string for colours
        }

        const duration = durationBlock
          ? javascriptGenerator.valueToCode(
              durationBlock,
              "DURATION",
              javascriptGenerator.ORDER_ATOMIC,
            )
          : "1"; // Default duration of 1 second if not specified

        keyframesArray.push({ value, duration });
      }
    }

    const easing = block.getFieldValue("EASING") || "Linear";
    const property = block.getFieldValue("PROPERTY") || "color"; // Default to "color" if no property is set

    const reverse = block.getFieldValue("REVERSE") === "TRUE";
    const loop = block.getFieldValue("LOOP") === "TRUE";
    const mode = block.getFieldValue("MODE");

    const asyncWrapper = mode === "AWAIT" ? "await " : "";

    // Generate the keyframes text for both colors and Vector3
    const keyframesCode = keyframesArray
      .map(
        (kf) => `{
                  value: ${kf.value}, 
                  duration: ${kf.duration}
            }`,
      )
      .join(", ");

    // Return the final code, passing keyframes with durations and properties
    return `${asyncWrapper}animateKeyFrames(${meshVar}, { keyframes: [${keyframesCode}], property: "${property}", easing: "${easing}", reverse: ${reverse}, loop: ${loop} });\n`;
  };

  // Animation group
  javascriptGenerator.forBlock["control_animation_group"] = function (block) {
    const animationGroupName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("GROUP_NAME"),
      Blockly.Names.NameType.VARIABLE,
    );
    const action = block.getFieldValue("ACTION");

    return `${action}AnimationGroup(${animationGroupName});\n`;
  };
  // Animate group
  javascriptGenerator.forBlock["animate_from"] = function (block) {
    const groupVariable = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("GROUP_NAME"),
      Blockly.Names.NameType.VARIABLE,
    );
    const timeInSeconds = javascriptGenerator.valueToCode(
      block,
      "TIME",
      javascriptGenerator.ORDER_ATOMIC,
    );

    return `animateFrom(${groupVariable}, ${timeInSeconds});\n`;
  };

  // Keyframe colour
  javascriptGenerator.forBlock["colour_keyframe"] = function (block) {
    const color = javascriptGenerator.valueToCode(
      block,
      "COLOR",
      javascriptGenerator.ORDER_ATOMIC,
    );
    const duration = javascriptGenerator.valueToCode(
      block,
      "DURATION",
      javascriptGenerator.ORDER_ATOMIC,
    );

    const code = `{ value: ${color}, duration: ${duration} }`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };

  // Keyframe number
  // Keyframe position
  javascriptGenerator.forBlock["xyz_keyframe"] = function (block) {
    const x = javascriptGenerator.valueToCode(
      block,
      "X",
      javascriptGenerator.ORDER_ATOMIC,
    );
    const y = javascriptGenerator.valueToCode(
      block,
      "Y",
      javascriptGenerator.ORDER_ATOMIC,
    );
    const z = javascriptGenerator.valueToCode(
      block,
      "Z",
      javascriptGenerator.ORDER_ATOMIC,
    );
    const duration = javascriptGenerator.valueToCode(
      block,
      "DURATION",
      javascriptGenerator.ORDER_ATOMIC,
    );
    const code = `{ value: createVector3(${x}, ${y}, ${z}), duration: ${duration} }`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };
}
