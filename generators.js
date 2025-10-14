import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import "@blockly/block-plus-minus";
import { FlowGraphLog10Block } from "babylonjs";
export let meshMap = {};
export let meshBlockIdMap = {};

let uniqueIdCounter = 0;

export function generateUniqueId(prefix = "") {
        // Increment the counter for each call
        uniqueIdCounter++;
        // Return a string with the prefix and the counter value
        return `${prefix}_${uniqueIdCounter}`;
}

function sanitizeForCode(input) {
  let s = String(input);

  // Cut from the first *real* newline (\r, \n, or Unicode line separator)
  s = s.replace(/[\r\n\u2028\u2029].*$/s, "");
  // Cut from the first *escaped* newline sequence (\n, \r, \u2028, \u2029, \x0A, \x0D)
  s = s.replace(/\\(?:n|r|u(?:2028|2029|000a|000d)|x0(?:a|d)).*$/i, "");

  // Remove any trailing backslashes that could remain (edge cases)
  s = s.replace(/\\+$/, "");

  // Neutralize comment and template literal markers
  s = s.replace(/\*\//g, "*∕")
       .replace(/\/\//g, "∕∕")
       .replace(/`/g, "ˋ");

  // Strip control characters (optional, keeps tabs/spaces)
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");

  return s;
}


function emitSafeTextArg(code) {
  if (!code) return '""';
  const m = code.match(/^(['"`])(.*)\1$/s);
  if (!m) return code;

  const q = m[1];
  const body = m[2];

  // Decode literal safely (handles \', \\ , \n, \uXXXX, etc.)
  let decoded;
  try { decoded = JSON.parse(q + body + q); }
  catch {
    decoded = body.replace(/\\\\/g, "\\").replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  return JSON.stringify(sanitizeForCode(decoded));
}

export function defineGenerators() {
        // Force re-initialization of animation generators
        delete javascriptGenerator.forBlock["play_animation"];
        delete javascriptGenerator.forBlock["switch_animation"];

        javascriptGenerator.forBlock["show"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return `await show(${modelName});\n`;
        };

        javascriptGenerator.forBlock["hide"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return `await hide(${modelName});\n`;
        };

        function getFieldValue(block, fieldName, defaultValue) {
                return (
                        javascriptGenerator.valueToCode(
                                block,
                                fieldName,
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || defaultValue
                );
        }

        javascriptGenerator.forBlock["wait"] = function (block) {
                const duration =
                        javascriptGenerator.valueToCode(
                                block,
                                "DURATION",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                return `await wait(${duration} / 1000);\n`;
        };

        javascriptGenerator.forBlock["wait_seconds"] = function (block) {
                const duration =
                        javascriptGenerator.valueToCode(
                                block,
                                "DURATION",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                return `await wait(${duration});\n`;
        };

        javascriptGenerator.forBlock["wait_until"] = function (block) {
                const condition =
                        javascriptGenerator.valueToCode(
                                block,
                                "CONDITION",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "false"; // Default to false if no condition is connected

                return `await waitUntil(() => ${condition});\n`;
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
                        for (
                                let i = 0;
                                i < keyframesBlock.inputList.length;
                                i++
                        ) {
                                const keyframeInput =
                                        keyframesBlock.inputList[i];
                                const valueBlock = keyframeInput.connection
                                        ? keyframeInput.connection.targetBlock()
                                        : null;
                                let value;

                                if (valueBlock) {
                                        // If the keyframe block is of type "colour_keyframe", treat it as a color keyframe.
                                        if (
                                                valueBlock.type ===
                                                "colour_keyframe"
                                        ) {
                                                value =
                                                        javascriptGenerator.valueToCode(
                                                                valueBlock,
                                                                "VALUE",
                                                                javascriptGenerator.ORDER_NONE,
                                                        );
                                        } else if (property === "color") {
                                                // Otherwise, if property equals "color", extract as a color.
                                                value =
                                                        javascriptGenerator.valueToCode(
                                                                valueBlock,
                                                                "VALUE",
                                                                javascriptGenerator.ORDER_NONE,
                                                        );
                                        } else if (
                                                [
                                                        "position",
                                                        "rotation",
                                                        "scaling",
                                                ].includes(property)
                                        ) {
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
                                                value =
                                                        javascriptGenerator.valueToCode(
                                                                valueBlock,
                                                                "VALUE",
                                                                javascriptGenerator.ORDER_ATOMIC,
                                                        );
                                        }
                                } else {
                                        // Default value for missing blocks.
                                        value =
                                                property === "color" ||
                                                property === "colour_keyframe"
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
                const loop = block.getFieldValue("LOOP") === "TRUE";
                const reverse = block.getFieldValue("REVERSE") === "TRUE";
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
                        loop: ${loop},
                        reverse: ${reverse},
                        mode: "${mode}"
                  }
                );
          `;
        };

        javascriptGenerator.forBlock["animate_keyframes"] = function (block) {
                const meshVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const keyframesBlock = block.getInputTargetBlock("KEYFRAMES");
                const keyframesArray = [];

                if (keyframesBlock) {
                        // Loop through keyframe blocks to gather data
                        for (
                                let i = 0;
                                i < keyframesBlock.inputList.length;
                                i++
                        ) {
                                const keyframeInput =
                                        keyframesBlock.inputList[i];

                                const valueBlock = keyframeInput.connection
                                        ? keyframeInput.connection.targetBlock()
                                        : null;
                                const durationBlock = keyframeInput.connection
                                        ? keyframeInput.connection.targetBlock()
                                        : null;

                                let value;
                                const property =
                                        block.getFieldValue("PROPERTY");

                                if (valueBlock) {
                                        if (property === "color") {
                                                // Handle color keyframe (as a string)
                                                value =
                                                        javascriptGenerator.valueToCode(
                                                                valueBlock,
                                                                "VALUE",
                                                                javascriptGenerator.ORDER_NONE,
                                                        );
                                        } else if (
                                                [
                                                        "position",
                                                        "rotation",
                                                        "scaling",
                                                ].includes(property)
                                        ) {
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
                                                value =
                                                        javascriptGenerator.valueToCode(
                                                                valueBlock,
                                                                "VALUE",
                                                                javascriptGenerator.ORDER_ATOMIC,
                                                        );
                                        }
                                } else {
                                        // Default values for missing blocks
                                        value =
                                                property === "color"
                                                        ? '"#ffffff"'
                                                        : `createVector3(0, 0, 0)`; // Correct color string for colours
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

                const loop = block.getFieldValue("LOOP") === "TRUE";
                const reverse = block.getFieldValue("REVERSE") === "TRUE";
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
                return `${asyncWrapper}animateKeyFrames(${meshVar}, { keyframes: [${keyframesCode}], property: "${property}", easing: "${easing}", loop: ${loop}, reverse: ${reverse} });\n`;
        };

        javascriptGenerator.forBlock["stop_animations"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return `await stopAnimations(${modelName});\n`;
        };

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

        javascriptGenerator.forBlock["min_centre_max"] = function (block) {
                const pivotOption = block.getFieldValue("PIVOT_OPTION");

                // Return the string value as a quoted literal
                return [`"${pivotOption}"`, javascriptGenerator.ORDER_ATOMIC];
        };

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

                return `await setPivotPoint(${meshVar}, { xPivot: ${xPivot}, yPivot: ${yPivot}, zPivot: ${zPivot} });\n`;
        };

        javascriptGenerator.forBlock["start"] = function (block) {
                const branch = javascriptGenerator.statementToCode(block, "DO");
                return `(async () => {\n${branch}})();\n`;
        };

        javascriptGenerator.forBlock["start2"] = function (block) {
                const branch = javascriptGenerator.statementToCode(block, "DO");
                return `start(async function() {\n${branch}});\n`;
        };

        javascriptGenerator.forBlock["create_ground"] = function (block) {
                const meshId = "ground";
                meshMap[meshId] = block;
                meshBlockIdMap[meshId] = block.id;
                const color = getFieldValue(block, "COLOR", "#6495ED");
                return `createGround(${color}, "${meshId}");\n`;
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

        javascriptGenerator.forBlock["logic_placeholder"] = function (block) {
                return "";
        };
        javascriptGenerator.forBlock["set_sky_color"] = function (block) {
                const meshId = "sky";
                meshMap[meshId] = block;
                meshBlockIdMap[meshId] = block.id;
                const color = getFieldValue(block, "COLOR", "#6495ED");
                return `setSky(${color});\n`;
        };

        javascriptGenerator.forBlock["light_intensity"] = function (block) {
                const intensity =
                        javascriptGenerator.valueToCode(
                                block,
                                "INTENSITY",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1.0";

                return `lightIntensity(${intensity});\n`;
        };

        javascriptGenerator.forBlock["button_controls"] = function (block) {
                const color = getFieldValue(block, "COLOR", "#6495ED");
                const control = block.getFieldValue("CONTROL");
                const enabled = block.getFieldValue("ENABLED") == "TRUE";
                return `buttonControls("${control}", ${enabled}, ${color});\n`;
        };

        // Assumes sanitizeForCode(text) is defined and in scope.

        /**
         * comment block -> single-line JS comment.
         * Sanitizes the displayed text so it cannot break out of comment context.
         */
        javascriptGenerator.forBlock["comment"] = function (block) {
                let raw =
                        javascriptGenerator.valueToCode(
                                block,
                                "COMMENT",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "''";

                const m = raw.match(/^(['"`])(.*)\1$/s);
                const content = m ? m[2] : raw;

                const safe = sanitizeForCode(content);
                return `// ${safe}\n`;
        };

        javascriptGenerator.forBlock["print_text"] = function (block) {
          const textCode =
            javascriptGenerator.valueToCode(block, "TEXT", javascriptGenerator.ORDER_NONE) || "''";
          const durationCode =
            javascriptGenerator.valueToCode(block, "DURATION", javascriptGenerator.ORDER_NONE) || "0";

          const color = getFieldValue(block, "COLOR", "#9932CC");

          const safeTextArg = emitSafeTextArg(textCode);

          const n = `(Number(${durationCode}))`;
          const safeDuration = `(isFinite(${n}) && ${n} >= 0 ? ${n} : 0)`;

          return `printText({ text: ${safeTextArg}, duration: ${safeDuration}, color: ${color} });\n`;
        };

        javascriptGenerator.forBlock["set_fog"] = function (block) {
                const fogColorHex = getFieldValue(
                        block,
                        "FOG_COLOR",
                        "#9932CC",
                );
                const fogMode = block.getFieldValue("FOG_MODE");
                const fogDensity =
                        javascriptGenerator.valueToCode(
                                block,
                                "DENSITY",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "0.1"; // Default density

                return `setFog({ fogColorHex: ${fogColorHex}, fogMode: "${fogMode}", fogDensity: ${fogDensity} });\n`;
        };

        javascriptGenerator.forBlock["ui_text"] = function (block) {
          const textCode =
            javascriptGenerator.valueToCode(block, "TEXT", javascriptGenerator.ORDER_ATOMIC) || '""';
          const xCode = javascriptGenerator.valueToCode(block, "X", javascriptGenerator.ORDER_ATOMIC) || "0";
          const yCode = javascriptGenerator.valueToCode(block, "Y", javascriptGenerator.ORDER_ATOMIC) || "0";
          const fontSizeCode =
            javascriptGenerator.valueToCode(block, "FONT_SIZE", javascriptGenerator.ORDER_ATOMIC) || "24";
          const durationCode =
            javascriptGenerator.valueToCode(block, "DURATION", javascriptGenerator.ORDER_ATOMIC) || "0";
          const colorCode =
            javascriptGenerator.valueToCode(block, "COLOR", javascriptGenerator.ORDER_ATOMIC) || '""';

          const textBlockVar = javascriptGenerator.nameDB_.getName(
            block.getFieldValue("TEXTBLOCK_VAR"),
            Blockly.VARIABLE_CATEGORY_NAME
          );

          const safeTextArg = emitSafeTextArg(textCode);

          return `${textBlockVar} = UIText({
          text: ${safeTextArg},
          x: ${xCode},
          y: ${yCode},
          fontSize: ${fontSizeCode},
          color: ${colorCode},
          duration: ${durationCode},
          id: ${textBlockVar}
        });\n`;
        };


        javascriptGenerator.forBlock["ui_input"] = function (block) {
          const varName = javascriptGenerator.nameDB_.getName(
            block.getFieldValue("INPUT_VAR"),
            Blockly.VARIABLE_CATEGORY_NAME
          );

          const textCode =
            javascriptGenerator.valueToCode(block, "TEXT", javascriptGenerator.ORDER_ATOMIC) || '""';
          const xCode = javascriptGenerator.valueToCode(block, "X", javascriptGenerator.ORDER_ATOMIC) || "0";
          const yCode = javascriptGenerator.valueToCode(block, "Y", javascriptGenerator.ORDER_ATOMIC) || "0";
          const fontSizeCode =
            javascriptGenerator.valueToCode(block, "TEXT_SIZE", javascriptGenerator.ORDER_ATOMIC) || "24";
          const textColorCode =
            javascriptGenerator.valueToCode(block, "TEXT_COLOR", javascriptGenerator.ORDER_ATOMIC) ||
            '"#000000"';
          const backgroundColorCode =
            javascriptGenerator.valueToCode(block, "BACKGROUND_COLOR", javascriptGenerator.ORDER_ATOMIC) ||
            '"#ffffff"';

          const size = block.getFieldValue("SIZE") || "medium";

          const safeTextArg = emitSafeTextArg(textCode);

          return `${varName} = await UIInput({
            text: ${safeTextArg},
            x: ${xCode},
            y: ${yCode},
            size: "${size}",
            fontSize: ${fontSizeCode},
            textColor: ${textColorCode},
            backgroundColor: ${backgroundColorCode},
            id: ${varName}
          });\n`;
        };


        javascriptGenerator.forBlock["ui_slider"] = function (block) {
                const varName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("SLIDER_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const min =
                        javascriptGenerator.valueToCode(
                                block,
                                "MIN",
                                javascriptGenerator.ORDER_NONE,
                        ) || 0;
                const max =
                        javascriptGenerator.valueToCode(
                                block,
                                "MAX",
                                javascriptGenerator.ORDER_NONE,
                        ) || 100;
                const value =
                        javascriptGenerator.valueToCode(
                                block,
                                "VALUE",
                                javascriptGenerator.ORDER_NONE,
                        ) || 50;
                const x =
                        javascriptGenerator.valueToCode(
                                block,
                                "X",
                                javascriptGenerator.ORDER_NONE,
                        ) || 100;
                const y =
                        javascriptGenerator.valueToCode(
                                block,
                                "Y",
                                javascriptGenerator.ORDER_NONE,
                        ) || 50;
                const color =
                        javascriptGenerator.valueToCode(
                                block,
                                "COLOR",
                                javascriptGenerator.ORDER_NONE,
                        ) || '"#000000"';
                const background =
                        javascriptGenerator.valueToCode(
                                block,
                                "BACKGROUND",
                                javascriptGenerator.ORDER_NONE,
                        ) || '"#ffffff"';
                const size = `"${block.getFieldValue("SIZE") || "MEDIUM"}"`;

                const id = `"${varName}_slider"`;
                const code = `
                ${varName} = ${value};
                const ${varName}_slider = UISlider({
                  id: ${id},
                  min: ${min},
                  max: ${max},
                  value: ${value},
                  x: ${x},
                  y: ${y},
                  size: ${size},
                  textColor: ${color},
                  backgroundColor: ${background}
                });
                ${varName}_slider.onValueChangedObservable.add(value => {
                  try { ${varName} = Math.round(value * 100) / 100; } catch (e) { console.warn('Variable not declared:', '${varName}'); }
                });
                `;

                return code;
        };

        javascriptGenerator.forBlock["ui_button"] = function (block) {
                // Retrieve values from the block
                const text = javascriptGenerator.valueToCode(
                        block,
                        "TEXT",
                        javascriptGenerator.ORDER_ATOMIC,
                );
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
                const width = `"${block.getFieldValue("SIZE")}"`; // Fix: Use "SIZE" instead of "WIDTH"
                const textSize = `"${block.getFieldValue("TEXT_SIZE")}"`; // Fix: Add text size support
                const textColor = javascriptGenerator.valueToCode(
                        block,
                        "TEXT_COLOR",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const backgroundColor = javascriptGenerator.valueToCode(
                        block,
                        "BACKGROUND_COLOR",
                        javascriptGenerator.ORDER_ATOMIC,
                );

                // Get the button variable
                const buttonVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("BUTTON_VAR"),
                        Blockly.VARIABLE_CATEGORY_NAME,
                );

                const buttonId = `Button_${generateUniqueId()}`;

                const code = `${buttonVar} = UIButton({
                  text: ${text},
                  x: ${x},
                  y: ${y},
                  width: ${width},
                  textSize: ${textSize},
                  textColor: ${textColor},
                  backgroundColor: ${backgroundColor},
                  buttonId: "${buttonId}"
                });\n`;
                return code;
        };

        javascriptGenerator.forBlock["say"] = function (block) {
          const textCode =
            javascriptGenerator.valueToCode(block, "TEXT", javascriptGenerator.ORDER_ATOMIC) || '""';
          const durationCode =
            javascriptGenerator.valueToCode(block, "DURATION", javascriptGenerator.ORDER_ATOMIC) || "0";
          const alphaCode =
            javascriptGenerator.valueToCode(block, "ALPHA", javascriptGenerator.ORDER_ATOMIC) || "1";
          const sizeCode =
            javascriptGenerator.valueToCode(block, "SIZE", javascriptGenerator.ORDER_ATOMIC) || "24";

          const meshVariable = javascriptGenerator.nameDB_.getName(
            block.getFieldValue("MESH_VAR"),
            Blockly.Names.NameType.VARIABLE
          );

          const textColor = getFieldValue(block, "TEXT_COLOR", "#000000");
          const backgroundColor = getFieldValue(block, "BACKGROUND_COLOR", "#ffffff");

          const mode = block.getFieldValue("MODE") || "";
          const asyncMode = block.getFieldValue("ASYNC");
          const asyncWrapper = asyncMode === "AWAIT" ? "await " : "";

          const safeTextArg = emitSafeTextArg(textCode);

          const d = `(Number(${durationCode}))`;
          const safeDuration = `(isFinite(${d}) && ${d} >= 0 ? ${d} : 0)`;
          const a = `(Number(${alphaCode}))`;
          const safeAlpha = `(isFinite(${a}) ? Math.min(Math.max(${a}, 0), 1) : 1)`;
          const s = `(Number(${sizeCode}))`;
          const safeSize = `(isFinite(${s}) && ${s} > 0 ? ${s} : 24)`;

          return `${asyncWrapper}say(${meshVariable}, { text: ${safeTextArg}, duration: ${safeDuration}, textColor: ${textColor}, backgroundColor: ${backgroundColor}, alpha: ${safeAlpha}, size: ${safeSize}, mode: ${JSON.stringify(mode)} });\n`;
        };


        javascriptGenerator.forBlock["load_model"] = function (block) {
                const modelName = block.getFieldValue("MODELS");
                const scale = getFieldValue(block, "SCALE", "1");
                const x = getFieldValue(block, "X", "0");
                const y = getFieldValue(block, "Y", "0");
                const z = getFieldValue(block, "Z", "0");
                const variableName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const meshId = `${variableName}__${block.id}`;
                meshMap[block.id] = block;
                meshBlockIdMap[block.id] = block.id;

                let doCode = "";
                if (block.getInput("DO")) {
                        doCode =
                                javascriptGenerator.statementToCode(
                                        block,
                                        "DO",
                                ) || "";
                }
                doCode = doCode ? `async function() {\n${doCode}\n}` : "";

                return `${variableName} = createModel({
                        modelName: '${modelName}',
                        modelId: '${meshId}',
                        scale: ${scale},
                        position: { x: ${x}, y: ${y}, z: ${z} }${doCode ? `,\ncallback: ${doCode}` : ""}
                });\n`;
        };

        javascriptGenerator.forBlock["load_character"] = function (block) {
                const modelName = block.getFieldValue("MODELS");
                const scale = getFieldValue(block, "SCALE", "1");
                const x = getFieldValue(block, "X", "0");
                const y = getFieldValue(block, "Y", "0");
                const z = getFieldValue(block, "Z", "0");
                const hairColor = getFieldValue(block, "HAIR_COLOR", "#000000");
                const skinColor = getFieldValue(block, "SKIN_COLOR", "#FFE0BD");
                const eyesColor = getFieldValue(block, "EYES_COLOR", "#0000FF");
                const sleevesColor = getFieldValue(
                        block,
                        "SLEEVES_COLOR",
                        "#FFFFFF",
                );
                const shortsColor = getFieldValue(
                        block,
                        "SHORTS_COLOR",
                        "#000000",
                );
                const tshirtColor = getFieldValue(
                        block,
                        "TSHIRT_COLOR",
                        "#FF0000",
                );
                const variableName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const meshId = `${variableName}__${block.id}`;
                meshMap[block.id] = block;
                meshBlockIdMap[block.id] = block.id;
                // Generate the code for the "do" part (if present)
                let doCode = "";

                if (block.getInput("DO")) {
                        doCode =
                                javascriptGenerator.statementToCode(
                                        block,
                                        "DO",
                                ) || "";
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

        javascriptGenerator.forBlock["load_object"] = function (block) {
                const modelName = block.getFieldValue("MODELS");
                const scale = getFieldValue(block, "SCALE", "1");
                const x = getFieldValue(block, "X", "0");
                const y = getFieldValue(block, "Y", "0");
                const z = getFieldValue(block, "Z", "0");
                const color = getFieldValue(block, "COLOR", "#000000");
                const variableName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const meshId = `${variableName}__${block.id}`;
                meshMap[block.id] = block;
                meshBlockIdMap[block.id] = block.id;
                //```text
                // Generate the code for the "do" part (if present)
                let doCode = "";

                if (block.getInput("DO")) {
                        doCode =
                                javascriptGenerator.statementToCode(
                                        block,
                                        "DO",
                                ) || "";
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

        javascriptGenerator.forBlock["load_object2"] = function (block) {
                const modelName = block.getFieldValue("MODELS");
                const scale = getFieldValue(block, "SCALE", "1");
                const x = getFieldValue(block, "X", "0");
                const y = getFieldValue(block, "Y", "0");
                const z = getFieldValue(block, "Z", "0");
                const color = getFieldValue(block, "COLOR", "#000000");
                const variableName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                //const meshId = modelName + "_" + generateUniqueId();
                const meshId = `${variableName}__${block.id}`;
                meshMap[block.id] = block;
                meshBlockIdMap[block.id] = block.id;
                // Generate the code for the "do" part (if present)
                let doCode = "";

                if (block.getInput("DO")) {
                        doCode =
                                javascriptGenerator.statementToCode(
                                        block,
                                        "DO",
                                ) || "";
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

        javascriptGenerator.forBlock["load_multi_object"] = function (block) {
                const modelName = block.getFieldValue("MODELS");
                const scale = getFieldValue(block, "SCALE", "1");
                const x = getFieldValue(block, "X", "0");
                const y = getFieldValue(block, "Y", "0");
                const z = getFieldValue(block, "Z", "0");
                const color = getFieldValue(block, "COLORS", "#000000");

                const variableName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const meshId = `${variableName}__${block.id}`;
                meshMap[block.id] = block;
                meshBlockIdMap[block.id] = block.id;
                // Generate the code for the "do" part (if present)
                let doCode = "";

                if (block.getInput("DO")) {
                        doCode =
                                javascriptGenerator.statementToCode(
                                        block,
                                        "DO",
                                ) || "";
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
                        doCode =
                                javascriptGenerator.statementToCode(
                                        block,
                                        "DO",
                                ) || "";
                }

                // Wrap "DO" code in an async function if it exists
                doCode = doCode ? `async function() {\n${doCode}\n}` : "";

                // Return the code to clone the mesh
                return `${cloneVariableName} = cloneMesh({
                        sourceMeshName: ${sourceMeshName},
                        cloneId: '${cloneId}'${doCode ? `,\ncallback: ${doCode}` : ""}
                });\n`;
        };

        javascriptGenerator.forBlock["create_3d_text"] = function (block) {
          const variableName = javascriptGenerator.nameDB_.getName(
            block.getFieldValue("ID_VAR"),
            Blockly.Names.NameType.VARIABLE
          );

          let rawText = getFieldValue(block, "TEXT", "Hello World");
          if (typeof rawText !== "string") rawText = String(rawText ?? "");
          const m = rawText.match(/^(['"`])(.*)\1$/s);
          const textLiteral = JSON.stringify(sanitizeForCode(m ? m[2] : rawText));

          const fontKey = block.getFieldValue("FONT") || "__fonts_FreeSans_Bold_json";
          const size = getFieldValue(block, "SIZE", "50");
          const depth = getFieldValue(block, "DEPTH", "1.0");
          const x = getFieldValue(block, "X", "0");
          const y = getFieldValue(block, "Y", "0");
          const z = getFieldValue(block, "Z", "0");
          const color = getFieldValue(block, "COLOR", "#FFFFFF");

          let font = "./fonts/FreeSans_Bold.json";
          if (fontKey === "__fonts_FreeSans_Bold_json") font = "./fonts/FreeSans_Bold.json";

          const meshId = "text_" + generateUniqueId();
          meshMap[meshId] = block;
          meshBlockIdMap[meshId] = block.id;

          let doCode = "";
          if (block.getInput("DO")) {
            doCode = javascriptGenerator.statementToCode(block, "DO") || "";
          }
          doCode = doCode ? `async function() {\n${doCode}\n}` : "";

          return `${variableName} = create3DText({
          text: ${textLiteral},
          font: '${font}',
          color: ${color},
          size: ${size},
          depth: ${depth},
          position: { x: ${x}, y: ${y}, z: ${z} },
          modelId: '${meshId}'${doCode ? `,\n  callback: ${doCode}` : ""}
        });\n`;
        };


        javascriptGenerator.forBlock["create_particle_effect"] = function (
                block,
        ) {
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

        javascriptGenerator.forBlock["control_particle_system"] = function (
                block,
        ) {
                const systemName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("SYSTEM_NAME"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const action = block.getFieldValue("ACTION");

                return `${action}ParticleSystem(${systemName});\n`;
        };

        function createMesh(block, meshType, params) {
                const variableName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const meshId = `${variableName}__${block.id}`;

                meshMap[block.id] = block;
                meshBlockIdMap[block.id] = block.id;

                const doCode = block.getInput("DO")
                        ? javascriptGenerator.statementToCode(block, "DO") || ""
                        : "";

                const options = [...params];

                return `${variableName} = create${meshType}("${meshId}", { ${options.join(", ")} });\n${doCode}`;
        }

        function getPositionTuple(block) {
                const posX = getFieldValue(block, "X", "0");
                const posY = getFieldValue(block, "Y", "0");
                const posZ = getFieldValue(block, "Z", "0");

                return `[${posX}, ${posY}, ${posZ}]`;
        }

        javascriptGenerator.forBlock["create_box"] = function (block) {
                const color = getFieldValue(block, "COLOR", "#9932CC");
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

        javascriptGenerator.forBlock["create_sphere"] = function (block) {
                const color = getFieldValue(block, "COLOR", "#9932CC");
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

        javascriptGenerator.forBlock["create_cylinder"] = function (block) {
                const color = getFieldValue(block, "COLOR", "#9932CC");
                const height = getFieldValue(block, "HEIGHT", "2");
                const diameterTop = getFieldValue(block, "DIAMETER_TOP", "1");
                const diameterBottom = getFieldValue(
                        block,
                        "DIAMETER_BOTTOM",
                        "1",
                );
                const tessellations = getFieldValue(
                        block,
                        "TESSELLATIONS",
                        "12",
                );

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

        javascriptGenerator.forBlock["create_capsule"] = function (block) {
                const color = getFieldValue(block, "COLOR", "#9932CC");
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

        javascriptGenerator.forBlock["create_plane"] = function (block) {
                const color = getFieldValue(block, "COLOR", "#9932CC");
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

        javascriptGenerator.forBlock["set_background_color"] = function (
                block,
        ) {
                const color = getFieldValue(block, "COLOR", "#6495ED");
                const meshId = "sky";
                meshMap[meshId] = block;
                meshBlockIdMap[meshId] = block.id;
                return `setSky(${color});\n`;
        };

        javascriptGenerator.forBlock["create_wall"] = function (block) {
                const color = getFieldValue(block, "COLOR", "#9932CC");
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

                //return `await lookAt(${meshName1}, ${meshName2}, ${useY});\n`;

                return `await lookAt(${meshName1}, { target: ${meshName2}, useY: ${useY} });\n`;
        };

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

        javascriptGenerator.forBlock["distance_to"] = function (block) {
                c;
                const meshName1 = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL1"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const meshName2 = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL2"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const code = `distanceTo(${meshName1}, ${meshName2})`;
                return [code, javascriptGenerator.ORDER_NONE];
        };

        javascriptGenerator.forBlock["time"] = function (block) {
                let code = `Math.floor(new Date().getTime()) / 1000`;
                return [code, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock["get_property"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const propertyName = block.getFieldValue("PROPERTY");

                const code = `getProperty(${modelName}, '${propertyName}')`;
                return [code, javascriptGenerator.ORDER_NONE];
        };

        javascriptGenerator.forBlock["play_sound"] = function (block) {
                const idVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const meshNameField = block.getFieldValue("MESH_NAME");
                const meshName = `"${meshNameField}"`; // Always quoted

                const soundName = block.getFieldValue("SOUND_NAME");

                const speedCode =
                        javascriptGenerator.valueToCode(
                                block,
                                "SPEED",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const volumeCode =
                        javascriptGenerator.valueToCode(
                                block,
                                "VOLUME",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const loop = block.getFieldValue("MODE") === "LOOP";
                const asyncMode = block.getFieldValue("ASYNC");

                // Build the final code line
                const code = `${idVar} = ${asyncMode === "AWAIT" ? "await " : ""}playSound(${meshName}, { soundName: "${soundName}", loop: ${loop}, volume: ${volumeCode}, playbackRate: ${speedCode} });\n`;

                return code;
        };

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

        javascriptGenerator.forBlock["forever"] = function (block) {
                const branch = javascriptGenerator.statementToCode(block, "DO");

                const code = `forever(async function(){\n${branch}});\n`;
                return code;
        };

        javascriptGenerator.forBlock["play_animation"] = function (block) {
                var model = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL"),
                        Blockly.Names.NameType.VARIABLE,
                );
                var animationName = block.getFieldValue("ANIMATION_NAME");
                var code = `await playAnimation(${model}, { animationName: "${animationName}" });\n`;
                return code;
        };

        javascriptGenerator.forBlock["stop_all_sounds"] = function (block) {
                // JavaScript code to stop all sounds in a Babylon.js scene
                return "stopAllSounds();\n";
        };

        javascriptGenerator.forBlock["midi_note"] = function (block) {
                const note = block.getFieldValue("NOTE");
                return [note, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock["rest"] = function () {
                // Rest is represented as null in sequences
                return ["null", javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock["play_notes"] = function (block) {
                const meshVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const notes =
                        javascriptGenerator.valueToCode(
                                block,
                                "NOTES",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "[]";
                const durations =
                        javascriptGenerator.valueToCode(
                                block,
                                "DURATIONS",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "[]";
                const instrument = javascriptGenerator.valueToCode(
                        block,
                        "INSTRUMENT",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const asyncMode = block.getFieldValue("ASYNC");

                // Use the appropriate function based on the async mode
                if (asyncMode === "AWAIT") {
                        return `await playNotes(${meshVar}, { notes: ${notes}, durations: ${durations}, instrument: ${instrument} });\n`;
                } else {
                        return `playNotes(${meshVar}, { notes: ${notes}, durations: ${durations}, instrument: ${instrument} });\n`;
                }
        };

        javascriptGenerator.forBlock["create_instrument"] = function (block) {
                const instrumentVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("INSTRUMENT"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const type = block.getFieldValue("TYPE");
                const frequency = block.getFieldValue("FREQUENCY");
                const attack = block.getFieldValue("ATTACK");
                const decay = block.getFieldValue("DECAY");
                const sustain = block.getFieldValue("SUSTAIN");
                const release = block.getFieldValue("RELEASE");

                // Assign the instrument to a variable
                return `${instrumentVar} = createInstrument('${type}', { frequency: ${frequency}, attack: ${attack}, decay: ${decay}, sustain: ${sustain}, release: ${release} });\n`;
        };

        javascriptGenerator.forBlock["instrument"] = function (block) {
                const instrumentType = block.getFieldValue("INSTRUMENT_TYPE");

                let instrumentCode;
                switch (instrumentType) {
                        case "piano":
                                instrumentCode = `createInstrument("square", { frequency: 440, attack: 0.1, decay: 0.3, sustain: 0.7, release: 1.0 })`; // Example settings for piano
                                break;
                        case "guitar":
                                instrumentCode = `createInstrument("sawtooth", { frequency: 440, attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.9 })`; // Example settings for guitar
                                break;
                        case "violin":
                                instrumentCode = `createInstrument("triangle", { frequency: 440, attack: 0.15, decay: 0.5, sustain: 0.8, release: 1.2 })`; // Example settings for violin
                                break;
                        default:
                                instrumentCode = `null`; // Default instrument (or could throw an error)
                }

                return [instrumentCode, javascriptGenerator.ORDER_ATOMIC];
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
                const meshNameField =
                        block.getFieldValue("MESH") || "__everywhere__";
                const meshName = `"${meshNameField}"`; // Always quoted

                const bpm =
                        javascriptGenerator.valueToCode(
                                block,
                                "BPM",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "120"; // Default BPM if not connected

                return `await setBPM(${meshName}, ${bpm});\n`;
        };

        javascriptGenerator.forBlock["speak"] = function (block) {
                const text =
                        javascriptGenerator.valueToCode(
                                block,
                                "TEXT",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || '""';

                const voice = block.getFieldValue("VOICE") || "default";

                const rate =
                        javascriptGenerator.valueToCode(
                                block,
                                "RATE",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const pitch =
                        javascriptGenerator.valueToCode(
                                block,
                                "PITCH",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const volume =
                        javascriptGenerator.valueToCode(
                                block,
                                "VOLUME",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const language = block.getFieldValue("LANGUAGE") || "en-US";
                const asyncMode = block.getFieldValue("ASYNC") || "START";

                // Get the mesh variable name from the dynamic dropdown - same approach as play_sound block
                const meshInput = block.getInput("MESH_INPUT");
                console.log(`[SPEAK GENERATOR DEBUG] meshInput:`, meshInput);
                console.log(
                        `[SPEAK GENERATOR DEBUG] meshInput.fieldRow:`,
                        meshInput ? meshInput.fieldRow : "null",
                );

                const meshDropdownField = meshInput
                        ? meshInput.fieldRow.find(
                                  (field) => field.name === "MESH_NAME",
                          )
                        : null;
                console.log(
                        `[SPEAK GENERATOR DEBUG] meshDropdownField:`,
                        meshDropdownField,
                );

                const meshValue = meshDropdownField
                        ? meshDropdownField.getValue()
                        : "__everywhere__";
                console.log(`[SPEAK GENERATOR DEBUG] meshValue:`, meshValue);

                const meshVariable = `"${meshValue}"`;
                console.log(
                        `[SPEAK GENERATOR DEBUG] Final meshVariable:`,
                        meshVariable,
                );

                // Safely handle asyncMode - ensure it's not null
                const safeAsyncMode = asyncMode || "START";
                const asyncWrapper = safeAsyncMode === "AWAIT" ? "await " : "";

                return `${asyncWrapper}speak(${meshVariable}, ${text}, { voice: "${voice}", rate: ${rate}, pitch: ${pitch}, volume: ${volume}, language: "${language}", mode: "${safeAsyncMode.toLowerCase()}" });\n`;
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
                        console.error(
                                "Invalid trigger type for 'when_touches' block:",
                                trigger,
                        );
                        return "";
                }
        };

        javascriptGenerator.forBlock["on_collision"] = function (block) {
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
                        console.error(
                                "Invalid trigger type for 'on_collision' block:",
                                trigger,
                        );
                        return "";
                }
        };

        javascriptGenerator.forBlock["when_clicked"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const trigger = block.getFieldValue("TRIGGER");
                const mode = block.getFieldValue("MODE") || "wait";

                const doCode = javascriptGenerator
                        .statementToCode(block, "DO")
                        .trim();
                const thenCodes = [];

                for (let i = 0; i < block.thenCount_; i++) {
                        const thenCode = javascriptGenerator
                                .statementToCode(block, "THEN" + i)
                                .trim();
                        if (thenCode) {
                                thenCodes.push(thenCode);
                        }
                }

                const allActions = [doCode, ...thenCodes].filter(
                        (code) => code,
                );
                const actionFunctions = allActions.map(
                        (code) => `async function(${modelName}) {\n${code}\n}`,
                );

                // Determine if this is a top-level block (not nested)
                const isTopLevel = !block.getSurroundParent();

                const code =
                        `onTrigger(${modelName}, {\n` +
                        `  trigger: "${trigger}",\n` +
                        `  callback: [\n${actionFunctions.join(",\n")}\n],\n` +
                        `  mode: "${mode}"` +
                        (isTopLevel ? `,\n  applyToGroup: true` : "") +
                        `\n});\n`;

                return code;
        };

        javascriptGenerator.forBlock["local_variable"] = function (
                block,
                generator,
        ) {
                // Retrieve the variable selected by the user
                const variable = generator.nameDB_.getName(
                        block.getFieldValue("VAR"),
                        Blockly.VARIABLE_CATEGORY_NAME,
                );

                // Generate a local 'let' declaration for the selected variable
                const code = `let ${variable};\n`;
                return code;
        };

        javascriptGenerator.forBlock["when_key_event"] = function (block) {
                const key = block.getFieldValue("KEY");
                const event = block.getFieldValue("EVENT"); // "pressed" or "released"
                const statements_do = javascriptGenerator.statementToCode(
                        block,
                        "DO",
                );

                // Pass "true" if event is "released" for the whenKeyPressed helper function
                return `whenKeyEvent("${key}", async () => {${statements_do}}, ${event === "released"});\n`;
        };

        // JavaScript generator for broadcast_event
        javascriptGenerator.forBlock["broadcast_event"] = function (block) {
                const eventName =
                        javascriptGenerator.valueToCode(
                                block,
                                "EVENT_NAME",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || '"go"';

                return `broadcastEvent(${eventName});\n`;
        };

        // JavaScript generator for on_event
        javascriptGenerator.forBlock["on_event"] = function (block) {
                const eventName =
                        javascriptGenerator.valueToCode(
                                block,
                                "EVENT_NAME",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || '"go"';
                const statements_do = javascriptGenerator.statementToCode(
                        block,
                        "DO",
                );

                return `onEvent(${eventName}, async function() {\n${statements_do}});\n`;
        };
        javascriptGenerator.forBlock["highlight"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const color = getFieldValue(block, "COLOR", "#FFD700");
                return `await highlight(${modelName}, { color: ${color} });\n`;
        };

        javascriptGenerator.forBlock["glow"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                return `await glow(${modelName});\n`;
        };

        javascriptGenerator.forBlock["tint"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const color = getFieldValue(block, "COLOR", "#AA336A");

                return `await tint(${modelName}, { color: ${color} });\n`;
        };

        javascriptGenerator.forBlock["change_color"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const color = getFieldValue(block, "COLOR", "#ffffff");

                return `await changeColor(${modelName}, { color: ${color} });\n`;
        };

        javascriptGenerator.forBlock["change_material"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("ID_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const material = block.getFieldValue("MATERIALS");
                const color = getFieldValue(block, "COLOR", "#ffffff");

                return `await changeMaterial(${modelName}, "${material}", ${color});\n`;
        };

        javascriptGenerator.forBlock["set_alpha"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const alphaValue = javascriptGenerator.valueToCode(
                        block,
                        "ALPHA",
                        javascriptGenerator.ORDER_ATOMIC,
                );

                return `await setAlpha(${modelName}, { value: ${alphaValue} });\n`;
        };

        javascriptGenerator.forBlock["clear_effects"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return `await clearEffects(${modelName});\n`;
        };

        javascriptGenerator.forBlock["switch_animation"] = function (block) {
                var model = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL"),
                        Blockly.Names.NameType.VARIABLE,
                );
                var animationName = block.getFieldValue("ANIMATION_NAME");
                var code = `switchAnimation(${model}, { animationName: "${animationName}" });\n`;
                return code;
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

        javascriptGenerator.forBlock["control_animation_group"] = function (
                block,
        ) {
                const animationGroupName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("GROUP_NAME"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const action = block.getFieldValue("ACTION");

                return `${action}AnimationGroup(${animationGroupName});\n`;
        };

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

        javascriptGenerator.forBlock["up"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const upForce = getFieldValue(block, "UP_FORCE", "1"); // Default up force

                return `up(${modelName}, ${upForce});\n`;
        };

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

        javascriptGenerator.forBlock["touching_surface"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return [
                        `isTouchingSurface(${modelName})`,
                        javascriptGenerator.ORDER_NONE,
                ];
        };

        javascriptGenerator.forBlock["mesh_exists"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return [
                        `meshExists(${modelName})`,
                        javascriptGenerator.ORDER_NONE,
                ];
        };

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

        javascriptGenerator.forBlock["get_camera"] = function (block) {
                const variableName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return `${variableName} = getCamera();\n`;
        };

        javascriptGenerator.forBlock["rotate_camera"] = function (block) {
                const degrees =
                        javascriptGenerator.valueToCode(
                                block,
                                "DEGREES",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "0";

                return `rotateCamera(${degrees});\n`;
        };

        javascriptGenerator.forBlock["export_mesh"] = function (block) {
                const meshVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const format = block.getFieldValue("FORMAT");

                // Generate the code that calls the helper function
                return `exportMesh(${meshVar}, "${format}");\n`;
        };

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

        javascriptGenerator.forBlock["remove_parent"] = function (block) {
                const childMesh = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("CHILD_MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );

                return `removeParent(${childMesh});\n`;
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

        javascriptGenerator.forBlock["drop"] = function (block) {
                const meshToDetach = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH_TO_DETACH"),
                        Blockly.Names.NameType.VARIABLE,
                );

                // Establish the drop action
                return `await drop(${meshToDetach});
        `;
        };

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

        javascriptGenerator.forBlock["stop_follow"] = function (block) {
                const followerModelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("FOLLOWER_MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );

                // Generate code to call the stopFollow helper function
                const code = `stopFollow("${followerModelName}");\n`;
                return code;
        };

        javascriptGenerator.forBlock["add_physics"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const physicsType = block.getFieldValue("PHYSICS_TYPE");

                // Note: Ensure that the execution environment supports async/await at this level
                return `await setPhysics(${modelName}, "${physicsType}");\n`;
        };
        javascriptGenerator.forBlock["add_physics_shape"] = function (block) {
                const modelName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MODEL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const shapeType = block.getFieldValue("SHAPE_TYPE");

                // Note: Ensure that the execution environment supports async/await at this level
                return `await setPhysicsShape(${modelName}, "${shapeType}");\n`;
        };

        javascriptGenerator.forBlock["show_physics"] = function (block) {
                const show = block.getFieldValue("SHOW") === "TRUE";
                return `showPhysics(${show});\n`;
        };

        javascriptGenerator.forBlock["canvas_controls"] = function (block) {
                const controls = block.getFieldValue("CONTROLS") == "TRUE";
                return `canvasControls(${controls});\n`;
        };

        javascriptGenerator.forBlock["key_pressed"] = function (block) {
                const key = block.getFieldValue("KEY");
                return [`keyPressed("${key}")`, javascriptGenerator.ORDER_NONE];
        };

        // Blockly code generator for checking if two meshes are touching
        javascriptGenerator.forBlock["meshes_touching"] = function (block) {
                const mesh1VarName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH1"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const mesh2VarName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH2"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const code = `checkMeshesTouching(${mesh1VarName}, ${mesh2VarName})`;
                return [code, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock["random_colour"] = function (block) {
                const code = `randomColour()`;
                return [code, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock["random_seeded_int"] = function (block) {
                const value_from = getFieldValue(block, "FROM", 0);
                const value_to = getFieldValue(
                        block,
                        "TO",
                        FlowGraphLog10Block,
                );
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

        javascriptGenerator.forBlock["colour"] = function (block) {
                const colour = block.getFieldValue("COLOR");
                const code = `"${colour}"`;
                return [code, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock["material"] = function (block) {
                const baseColor =
                        javascriptGenerator.valueToCode(
                                block,
                                "BASE_COLOR",

                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const textureSet = block.getFieldValue("TEXTURE_SET");
                const alpha =
                        javascriptGenerator.valueToCode(
                                block,
                                "ALPHA",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                function findSetMaterial(currentBlock) {
                        if (currentBlock.type === "set_material") return true;
                        if (currentBlock.parentBlock_ === null) return false;
                        return findSetMaterial(currentBlock.parentBlock_);
                }

                const isInSetMaterial = findSetMaterial(block);

                // Generate the code to call the createMaterial helper function
                const code = isInSetMaterial
                        ? `{ color: ${baseColor}, materialName: "${textureSet}", alpha: ${alpha} }`
                        : `createMaterial({ color: ${baseColor}, materialName: "${textureSet}", alpha: ${alpha} })`;
                return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
        };

        javascriptGenerator.forBlock["gradient_material"] = function (block) {
                const color =
                        javascriptGenerator.valueToCode(
                                block,
                                "COLOR",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const alpha =
                        javascriptGenerator.valueToCode(
                                block,
                                "ALPHA",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                const code = `createMaterial(${color}, null, ${alpha})`;
                return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
        };

        javascriptGenerator.forBlock["material2"] = function (block) {
                const baseColor =
                        javascriptGenerator.valueToCode(
                                block,
                                "BASE_COLOR",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";
                const emissiveColor =
                        javascriptGenerator.valueToCode(
                                block,
                                "EMISSIVE_COLOR",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";
                const textureSet = block.getFieldValue("TEXTURE_SET");
                const metallic =
                        javascriptGenerator.valueToCode(
                                block,
                                "METALLIC",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";
                const roughness =
                        javascriptGenerator.valueToCode(
                                block,
                                "ROUGHNESS",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";
                const alpha =
                        javascriptGenerator.valueToCode(
                                block,
                                "ALPHA",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "1";

                // Generate the code to call the createMaterial helper function
                const code = `createMaterial(${baseColor}, ${emissiveColor}, "${textureSet}", ${metallic}, ${roughness}, ${alpha})`;
                return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
        };

        javascriptGenerator.forBlock["text_material"] = function (block) {
                const variable = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MATERIAL_VAR"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const text =
                        javascriptGenerator.valueToCode(
                                block,
                                "TEXT",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "'Text'";
                const color =
                        javascriptGenerator.valueToCode(
                                block,
                                "COLOR",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "'#FFFFFF'";
                const backgroundColor =
                        javascriptGenerator.valueToCode(
                                block,
                                "BACKGROUND_COLOR",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || "'transparent'";
                const width =
                        javascriptGenerator.valueToCode(
                                block,
                                "WIDTH",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || 512;
                const height =
                        javascriptGenerator.valueToCode(
                                block,
                                "HEIGHT",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || 512;
                const textSize =
                        javascriptGenerator.valueToCode(
                                block,
                                "TEXT_SIZE",
                                javascriptGenerator.ORDER_ATOMIC,
                        ) || 120;

                return `${variable} = textMaterial(${text}, ${color}, ${backgroundColor}, ${width}, ${height}, ${textSize});\n`;
        };

        javascriptGenerator.forBlock["decal"] = function (block) {
                const mesh = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const positionX = javascriptGenerator.valueToCode(
                        block,
                        "POSITION_X",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const positionY = javascriptGenerator.valueToCode(
                        block,
                        "POSITION_Y",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const positionZ = javascriptGenerator.valueToCode(
                        block,
                        "POSITION_Z",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const normalX = javascriptGenerator.valueToCode(
                        block,
                        "NORMAL_X",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const normalY = javascriptGenerator.valueToCode(
                        block,
                        "NORMAL_Y",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const normalZ = javascriptGenerator.valueToCode(
                        block,
                        "NORMAL_Z",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const sizeX = javascriptGenerator.valueToCode(
                        block,
                        "SIZE_X",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const sizeY = javascriptGenerator.valueToCode(
                        block,
                        "SIZE_Y",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const sizeZ = javascriptGenerator.valueToCode(
                        block,
                        "SIZE_Z",
                        javascriptGenerator.ORDER_ATOMIC,
                );
                const materialVar = javascriptGenerator.valueToCode(
                        block,
                        "MATERIAL",
                        javascriptGenerator.ORDER_ATOMIC,
                );

                const code = `createDecal(${mesh}, ${positionX}, ${positionY}, ${positionZ}, ${normalX}, ${normalY}, ${normalZ}, ${sizeX}, ${sizeY}, ${sizeZ}, ${materialVar});\n`;
                return code;
        };

        javascriptGenerator.forBlock["place_decal"] = function (block) {
                const materialVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MATERIAL"),
                        Blockly.Names.NameType.VARIABLE,
                );
                const angle = javascriptGenerator.valueToCode(
                        block,
                        "ANGLE",
                        javascriptGenerator.ORDER_ATOMIC,
                );

                // Use a helper function for placing the decal
                return `placeDecal(${materialVar}, ${angle} );\n`;
        };

        javascriptGenerator.forBlock["set_material"] = function (block) {
                const meshVar = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("MESH"),
                        Blockly.Names.NameType.VARIABLE,
                );

                const material = javascriptGenerator.valueToCode(
                        block,
                        "MATERIAL",
                        javascriptGenerator.ORDER_ATOMIC,
                );

                // Ensure the MATERIAL input is wrapped in an array if not already one
                const code = `setMaterial(${meshVar}, Array.isArray(${material}) ? ${material} : [${material}]);\n`;
                return code;
                /*
                // Generate a unique temporary variable name
                const tempVar = javascriptGenerator.nameDB_.getDistinctName(
                        "material_temp",
                        Blockly.Names.NameType.VARIABLE,
                );
                const code = `const ${tempVar} = [${materials}];\nsetMaterial(${meshVar}, ${tempVar});\n`;
                return code;*/
        };

        javascriptGenerator.forBlock["skin_colour"] = function (block) {
                const colour = block.getFieldValue("COLOR");
                const code = `"${colour}"`;
                return [code, javascriptGenerator.ORDER_ATOMIC];
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

        javascriptGenerator.forBlock["colour_from_string"] = function (block) {
                const colourValue = block.getFieldValue("COLOR") || "#000000";
                return [`"${colourValue}"`, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock["procedures_defnoreturn"] = function (
                block,
        ) {
                const functionName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("NAME"),
                        Blockly.PROCEDURE_CATEGORY_NAME,
                );
                const args = block.argData_.map((elem) => elem.model.name);
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

        javascriptGenerator.forBlock["procedures_callnoreturn"] = function (
                block,
        ) {
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

        javascriptGenerator.forBlock["procedures_defreturn"] = function (
                block,
        ) {
                const functionName = javascriptGenerator.nameDB_.getName(
                        block.getFieldValue("NAME"),
                        Blockly.PROCEDURE_CATEGORY_NAME,
                );
                const args = block.argData_.map((elem) => elem.model.name);
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

        javascriptGenerator.forBlock["procedures_callreturn"] = function (
                block,
        ) {
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
                meshMap = {};
                meshBlockIdMap = {};
                console.log("Initializing JavaScript generator...");
                if (!javascriptGenerator.nameDB_) {
                        javascriptGenerator.nameDB_ = new Blockly.Names(
                                javascriptGenerator.RESERVED_WORDS_,
                        );
                } else {
                        javascriptGenerator.nameDB_.reset();
                }
                javascriptGenerator.nameDB_.setVariableMap(
                        workspace.getVariableMap(),
                );
                javascriptGenerator.nameDB_.populateVariables(workspace);
                javascriptGenerator.nameDB_.populateProcedures(workspace);

                const defvars = [];
                // Add developer variables (not created or named by the user).
                const devVarList =
                        Blockly.Variables.allDeveloperVariables(workspace);
                for (let i = 0; i < devVarList.length; i++) {
                        defvars.push(
                                javascriptGenerator.nameDB_.getName(
                                        devVarList[i],
                                        Blockly.Names.NameType
                                                .DEVELOPER_VARIABLE,
                                ),
                        );
                }

                // Add user variables, but only ones that are being used.
                const variables = Blockly.Variables.allUsedVarModels(workspace);
                for (let i = 0; i < variables.length; i++) {
                        defvars.push(
                                javascriptGenerator.nameDB_.getName(
                                        variables[i].getId(),
                                        Blockly.Names.NameType.VARIABLE,
                                ),
                        );
                }

                // Declare all of the variables.
                if (defvars.length) {
                        let defvarsmesh = defvars.map(function (name) {
                                return `let ${name} = '${name}';`;
                        });
                        javascriptGenerator.definitions_["variables"] =
                                `// Made with Flock XR\n` +
                                defvarsmesh.join(" ") +
                                "\n";
                }

                javascriptGenerator.isInitialized = true;
        };

        javascriptGenerator.init2 = function (workspace) {
                meshMap = {};
                meshBlockIdMap = {};
                console.log("Initializing JavaScript generator...");

                if (!javascriptGenerator.nameDB_) {
                        javascriptGenerator.nameDB_ = new Blockly.Names(
                                javascriptGenerator.RESERVED_WORDS_,
                        );
                } else {
                        javascriptGenerator.nameDB_.reset();
                }
                javascriptGenerator.nameDB_.setVariableMap(
                        workspace.getVariableMap(),
                );
                javascriptGenerator.nameDB_.populateVariables(workspace);
                javascriptGenerator.nameDB_.populateProcedures(workspace);

                const defvars = [];

                // Add developer variables
                const devVarList =
                        Blockly.Variables.allDeveloperVariables(workspace);
                for (let i = 0; i < devVarList.length; i++) {
                        defvars.push(
                                javascriptGenerator.nameDB_.getName(
                                        devVarList[i],
                                        Blockly.Names.NameType
                                                .DEVELOPER_VARIABLE,
                                ),
                        );
                }

                // Add user variables (used only)
                const variables = Blockly.Variables.allUsedVarModels(workspace);
                for (let i = 0; i < variables.length; i++) {
                        defvars.push(
                                javascriptGenerator.nameDB_.getName(
                                        variables[i].getId(),
                                        Blockly.Names.NameType.VARIABLE,
                                ),
                        );
                }

                // Declare all of the variables.
                if (defvars.length) {
                        let defvarsmesh = defvars.map(function (name) {
                                return `let ${name} = '${name}';`;
                        });
                        javascriptGenerator.definitions_["variables"] =
                                `// Made with Flock XR\n` +
                                defvarsmesh.join(" ") +
                                "\n";
                }

                // Order blocks: triggers first
                const topBlocks = workspace.getTopBlocks(true);
                const triggerBlockTypes = new Set([
                        "on_event",
                        "on_collision",
                        "when_touching",
                        "when_clicked",
                        "when_key_pressed",
                ]);

                const triggerBlocks = [];
                const nonTriggerBlocks = [];

                for (const block of topBlocks) {
                        if (triggerBlockTypes.has(block.type)) {
                                triggerBlocks.push(block);
                        } else {
                                nonTriggerBlocks.push(block);
                        }
                }

                javascriptGenerator._orderedBlocks = [
                        ...triggerBlocks,
                        ...nonTriggerBlocks,
                ];
                javascriptGenerator.isInitialized = true;
        };

        javascriptGenerator.workspaceToCode2 = function (workspace) {
                javascriptGenerator.init(workspace);

                let code = javascriptGenerator.definitions_["variables"] || "";

                const blocks =
                        javascriptGenerator._orderedBlocks ||
                        workspace.getTopBlocks(true);
                for (const block of blocks) {
                        const blockCode =
                                javascriptGenerator.blockToCode(block);
                        if (typeof blockCode === "string") {
                                code += blockCode;
                        } else if (Array.isArray(blockCode)) {
                                code += blockCode.join("\n");
                        }
                }
                return code;
        };
        javascriptGenerator.forBlock["device_camera_background"] = function (
                block,
        ) {
                const cameraType = block.getFieldValue("CAMERA");

                return `setCameraBackground("${cameraType}");\n`;
        };

        javascriptGenerator.forBlock["set_xr_mode"] = function (block) {
                const mode = block.getFieldValue("MODE");

                return `await setXRMode("${mode}");\n`;
        };

        javascriptGenerator.forBlock["camera_control"] = function (block) {
                const key = block.getFieldValue("KEY");
                const action = block.getFieldValue("ACTION");

                return `cameraControl(${key}, "${action}");\n`;
        };

        javascriptGenerator.forBlock["keyword_block"] = function (block) {
                // Since this block is replaced with another block, we return an empty string.
                return "";
        };
}

javascriptGenerator.forBlock["controls_whileUntil"] = function (block) {
        const until = block.getFieldValue("MODE") === "UNTIL";
        let argument0 =
                javascriptGenerator.valueToCode(
                        block,
                        "BOOL",
                        until
                                ? javascriptGenerator.ORDER_LOGICAL_NOT
                                : javascriptGenerator.ORDER_NONE,
                ) || "false";
        let branch = javascriptGenerator.statementToCode(block, "DO");
        if (until) {
                argument0 = "!" + argument0;
        }
        return (
                "while (" +
                argument0 +
                ") {\n" +
                branch +
                `\nawait wait(0);\n` +
                "}\n"
        );
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

javascriptGenerator.forBlock["controls_repeat_ext"] = function (
        block,
        generator,
) {
        let repeats;
        if (block.getField("TIMES")) {
                repeats = String(Number(block.getFieldValue("TIMES")));
        } else {
                repeats =
                        generator.valueToCode(
                                block,
                                "TIMES",
                                generator.ORDER_ASSIGNMENT,
                        ) || "0";
        }

        let branch = generator.statementToCode(block, "DO");

        let code = "";
        const loopVar = generator.nameDB_.getDistinctName(
                "count",
                Blockly.Names.NameType.VARIABLE,
        );
        let endVar = repeats;

        if (!/^\w+$/.test(repeats) && isNaN(repeats)) {
                endVar = generator.nameDB_.getDistinctName(
                        "repeat_end",
                        Blockly.Names.NameType.VARIABLE,
                );
                code += "let " + endVar + " = " + repeats + ";\n";
        }

        code +=
                "for (let " +
                loopVar +
                " = 0; " +
                loopVar +
                " < " +
                endVar +
                "; " +
                loopVar +
                "++) {\n" +
                branch +
                "await wait(0);\n" +
                "}\n";

        return code;
};

javascriptGenerator.forBlock["controls_for"] = function (block, generator) {
        const variable0 = generator.getVariableName(block.getFieldValue("VAR"));

        const argument0 =
                generator.valueToCode(
                        block,
                        "FROM",
                        generator.ORDER_ASSIGNMENT,
                ) || "0";
        const argument1 =
                generator.valueToCode(
                        block,
                        "TO",
                        generator.ORDER_ASSIGNMENT,
                ) || "0";
        const increment =
                generator.valueToCode(
                        block,
                        "BY",
                        generator.ORDER_ASSIGNMENT,
                ) || "1";

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

javascriptGenerator.forBlock["for_loop"] = function (block, generator) {
        const variable0 = generator.getVariableName(block.getFieldValue("VAR"));

        const argument0 =
                generator.valueToCode(
                        block,
                        "FROM",
                        generator.ORDER_ASSIGNMENT,
                ) || "0";
        const argument1 =
                generator.valueToCode(
                        block,
                        "TO",
                        generator.ORDER_ASSIGNMENT,
                ) || "0";
        const increment =
                generator.valueToCode(
                        block,
                        "BY",
                        generator.ORDER_ASSIGNMENT,
                ) || "1";

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
javascriptGenerator.forBlock["get_lexical_variable"] = function (block) {
        const variableName = block.getFieldValue("VAR");
        const code = variableName;
        return [code, javascriptGenerator.ORDER_ATOMIC];
};

javascriptGenerator.forBlock["controls_forEach"] = function (block, generator) {
        // For each loop.
        const variable0 = generator.getVariableName(block.getFieldValue("VAR"));

        // Use correct ORDER constant from the generator
        const argument0 =
                generator.valueToCode(
                        block,
                        "LIST",
                        generator.ORDER_ASSIGNMENT,
                ) || "[]";

        let branch = generator.statementToCode(block, "DO");
        let code = "";
        let listVar = argument0;

        if (!/^\w+$/.test(argument0)) {
                listVar = generator.nameDB_.getDistinctName(
                        variable0 + "_list",
                        Blockly.Names.NameType.VARIABLE,
                );
                code += "var " + listVar + " = " + argument0 + ";\n";
        }

        const indexVar = generator.nameDB_.getDistinctName(
                variable0 + "_index",
                Blockly.Names.NameType.VARIABLE,
        );

        // Construct the loop body
        branch =
                generator.INDENT +
                variable0 +
                " = " +
                listVar +
                "[" +
                indexVar +
                "];\n" +
                branch;

        code +=
                "for (var " +
                indexVar +
                " in " +
                listVar +
                ") {\n" +
                branch +
                "\n  await wait(0);\n" +
                "}\n";

        return code;
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

javascriptGenerator.forBlock["microbit_input"] = function (block) {
        const event = block.getFieldValue("EVENT");
        const statements_do = javascriptGenerator.statementToCode(block, "DO");

        return `whenKeyEvent("${event}", async () => {${statements_do}});\n`;
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

/*javascriptGenerator.forBlock["text_join"] = function (
  block,
  generator
) {
  const joinBlock = block;
  switch (joinBlock.itemCount) {
        case 0:
          return ["''", javascriptGenerator.ORDER_ATOMIC];
        case 1: {
          const element =
                generator.valueToCode(joinBlock, "ADD0", javascriptGenerator.ORDER_NONE) || "''";
          const codeAndOrder = forceString(element);
          return codeAndOrder;
        }
        case 2: {
          const element0 =
                generator.valueToCode(joinBlock, "ADD0", javascriptGenerator.ORDER_NONE) || "''";
          const element1 =
                generator.valueToCode(joinBlock, "ADD1", javascriptGenerator.ORDER_NONE) || "''";
          const code = forceString(element0)[0] + " + " + forceString(element1)[0];
          return [code, javascriptGenerator.ORDER_ADDITION];
        }
        default: {
          const elements = new Array(joinBlock.itemCount);
          for (let i = 0; i < joinBlock.itemCount; i++) {
                elements[i] =
                  generator.valueToCode(joinBlock, "ADD" + i, javascriptGenerator.ORDER_NONE) || "''";
          }
          const code = "[" + elements.join(",") + "].join('')";
          return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
        }
  }
};
javascriptGenerator.forBlock["lists_create_with"] = function (
  block,
  generator
) {
  const createWithBlock = block;
  const elements = new Array(createWithBlock.itemCount);
  for (let i = 0; i < createWithBlock.itemCount; i++) {
        elements[i] = generator.valueToCode(block, "ADD" + i, javascriptGenerator.ORDER_NONE) || "null";
  }
  const code = "[" + elements.join(", ") + "]";
  return [code, javascriptGenerator.ORDER_ATOMIC];
};*/

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
