import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import "@blockly/block-plus-minus";
import {
  clearMeshMaps,
  meshMap,
  meshBlockIdMap,
  generateUniqueId,
} from "./mesh-state.js";
import { getFieldValue } from "./generators-utilities.js";

// Import the generator registration functions for different categories of blocks
import { registerSceneGenerators } from "./generators-scene.js";
import { registerEventsGenerators } from "./generators-events.js";
import { registerTransformGenerators } from "./generators-transform.js";
import { registerAnimateGenerators } from "./generators-animate.js";
import { registerControlGenerators } from "./generators-control.js";
import { registerConditionGenerators } from "./generators-condition.js";
import { registerSensingGenerators } from "./generators-sensing.js";
import { registerTextGenerators } from "./generators-text.js";
import { registerMaterialGenerators } from "./generators-material.js";
import { registerSoundGenerators } from "./generators-sound.js";
import { registerDataGenerators } from "./generators-data.js";
import { registerMathGenerators } from "./generators-math.js";
import { registerFunctionsGenerators } from "./generators-functions.js";

// Used outside of this file
export * from "./mesh-state.js";

function sanitizeForCode(input) {
  let s = String(input);

  // Cut from the first *real* newline (\r, \n, or Unicode line separator)
  s = s.replace(/[\r\n\u2028\u2029].*$/s, "");
  // Cut from the first *escaped* newline sequence (\n, \r, \u2028, \u2029, \x0A, \x0D)
  s = s.replace(/\\(?:n|r|u(?:2028|2029|000a|000d)|x0(?:a|d)).*$/i, "");

  // Remove any trailing backslashes that could remain (edge cases)
  s = s.replace(/\\+$/, "");

  // Neutralize comment and template literal markers
  s = s.replace(/\*\//g, "*∕").replace(/\/\//g, "∕∕").replace(/`/g, "ˋ");

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
  try {
    decoded = JSON.parse(q + body + q);
  } catch {
    decoded = body
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }

  return JSON.stringify(sanitizeForCode(decoded));
}

const RESERVED_IDENTIFIERS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "arguments",
  "eval",
]);

function emitSafeIdentifierLiteral(code) {
  if (!code) {
    return "undefined";
  }

  // Match single, double, or template quoted literals
  const m = code.match(/^(['"`])(.*)\1$/s);
  if (!m) {
    return "undefined";
  }

  const rawBody = m[2];

  // Reject escapes entirely
  if (rawBody.includes("\\")) {
    return "undefined";
  }

  // Replace spaces and other whitespace with underscores
  const normalized = rawBody.replace(/\s+/g, "_");

  // Validate identifier
  if (!/^[A-Za-z$_][A-Za-z0-9$_]*$/.test(normalized)) {
    return "undefined";
  }

  // Check reserved keywords
  if (RESERVED_IDENTIFIERS.has(normalized)) {
    return "undefined";
  }

  return JSON.stringify(normalized);
}

export function defineGenerators() {
  // Register generators for each category of blocks
  registerSceneGenerators(javascriptGenerator);
  registerEventsGenerators(javascriptGenerator);
  registerTransformGenerators(javascriptGenerator);
  registerAnimateGenerators(javascriptGenerator);
  registerControlGenerators(javascriptGenerator);
  registerConditionGenerators(javascriptGenerator);
  registerSensingGenerators(javascriptGenerator);
  registerTextGenerators(javascriptGenerator);
  registerMaterialGenerators(javascriptGenerator);
  registerSoundGenerators(javascriptGenerator);
  registerDataGenerators(javascriptGenerator);
  registerMathGenerators(javascriptGenerator);
  registerFunctionsGenerators(javascriptGenerator);

  const reservedWordsWithoutName = javascriptGenerator.RESERVED_WORDS_.split(
    ",",
  )
    .map((word) => word.trim())
    .filter((word) => word && word !== "name")
    .join(",");

  // Force re-initialization of animation generators
  delete javascriptGenerator.forBlock["play_animation"];
  delete javascriptGenerator.forBlock["switch_animation"];

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

  javascriptGenerator.forBlock["start"] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, "DO");
    return `(async () => {\n${branch}})();\n`;
  };

  javascriptGenerator.forBlock["start2"] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, "DO");
    return `start(async function() {\n${branch}});\n`;
  };

  javascriptGenerator.forBlock["logic_placeholder"] = function (block) {
    return "";
  };

  javascriptGenerator.forBlock["button_controls"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#ffffff"');
    const control = block.getFieldValue("CONTROL");
    const mode = block.getFieldValue("ENABLED");
    return `buttonControls("${control}", "${mode}", ${color});\n`;
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

  javascriptGenerator.forBlock["describe"] = function (block) {
    const textCode =
      javascriptGenerator.valueToCode(
        block,
        "TEXT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '""';

    const meshVariable = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const safeTextArg = emitSafeTextArg(textCode);

    return `await describeMesh(${meshVariable}, ${safeTextArg});\n`;
  };

  javascriptGenerator.forBlock["print_text"] = function (block) {
    const textCode =
      javascriptGenerator.valueToCode(
        block,
        "TEXT",
        javascriptGenerator.ORDER_NONE,
      ) || "''";
    const durationCode =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_NONE,
      ) || "0";

    const color = getFieldValue(block, "COLOR", '"#9932CC"');

    const safeTextArg = emitSafeTextArg(textCode);

    return `printText({ text: ${safeTextArg}, duration: ${durationCode}, color: ${color} });\n`;
  };

  javascriptGenerator.forBlock["ui_text"] = function (block) {
    const textCode =
      javascriptGenerator.valueToCode(
        block,
        "TEXT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '""';
    const xCode =
      javascriptGenerator.valueToCode(
        block,
        "X",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const yCode =
      javascriptGenerator.valueToCode(
        block,
        "Y",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const fontSizeCode =
      javascriptGenerator.valueToCode(
        block,
        "FONT_SIZE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "24";
    const durationCode =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const colorCode =
      javascriptGenerator.valueToCode(
        block,
        "COLOR",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '""';

    const textBlockVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("TEXTBLOCK_VAR"),
      Blockly.VARIABLE_CATEGORY_NAME,
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
      Blockly.VARIABLE_CATEGORY_NAME,
    );

    const textCode =
      javascriptGenerator.valueToCode(
        block,
        "TEXT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '""';
    const xCode =
      javascriptGenerator.valueToCode(
        block,
        "X",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const yCode =
      javascriptGenerator.valueToCode(
        block,
        "Y",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const fontSizeCode =
      javascriptGenerator.valueToCode(
        block,
        "TEXT_SIZE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "24";
    const textColorCode =
      javascriptGenerator.valueToCode(
        block,
        "TEXT_COLOR",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '"#000000"';
    const backgroundColorCode =
      javascriptGenerator.valueToCode(
        block,
        "BACKGROUND_COLOR",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '"#ffffff"';

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
      javascriptGenerator.valueToCode(
        block,
        "TEXT",
        javascriptGenerator.ORDER_ATOMIC,
      ) || '""';
    const durationCode =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0";
    const alphaCode =
      javascriptGenerator.valueToCode(
        block,
        "ALPHA",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";
    const sizeCode =
      javascriptGenerator.valueToCode(
        block,
        "SIZE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "24";

    const meshVariable = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const textColor = getFieldValue(block, "TEXT_COLOR", "#000000");
    const backgroundColor = getFieldValue(block, "BACKGROUND_COLOR", "#ffffff");

    const mode = block.getFieldValue("MODE") || "";
    const asyncMode = block.getFieldValue("ASYNC");
    const asyncWrapper = asyncMode === "AWAIT" ? "await " : "";

    const safeTextArg = emitSafeTextArg(textCode);

    return `${asyncWrapper}say(${meshVariable}, { text: ${safeTextArg}, duration: ${durationCode}, textColor: ${textColor}, backgroundColor: ${backgroundColor}, alpha: ${alphaCode}, size: ${sizeCode}, mode: ${JSON.stringify(mode)} });\n`;
  };

  javascriptGenerator.forBlock["create_3d_text"] = function (block) {
    const variableName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
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
    const color = getFieldValue(block, "COLOR", '"#FFFFFF"');

    let font = "./fonts/FreeSans_Bold.json";
    if (fontKey === "__fonts_FreeSans_Bold_json")
      font = "./fonts/FreeSans_Bold.json";

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

  javascriptGenerator.forBlock["distance_to"] = function (block) {
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
    const unit = block.getFieldValue("UNIT") || "seconds";
    const code = `getTime("${unit}")`;
    return [code, javascriptGenerator.ORDER_NONE];
  };

  javascriptGenerator.forBlock["ground_level"] = function () {
    const code = "-999999";
    return [code, javascriptGenerator.ORDER_NONE];
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

  javascriptGenerator.forBlock["play_theme"] = function (block) {
    const idVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    const meshNameField = block.getFieldValue("MESH_NAME");
    const meshName = `"${meshNameField}"`;

    const themeName = block.getFieldValue("THEME_NAME");

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

    const code = `${idVar} = ${asyncMode === "AWAIT" ? "await " : ""}playSound(${meshName}, { soundName: "${themeName}", loop: ${loop}, volume: ${volumeCode}, playbackRate: ${speedCode} });\n`;

    return code;
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

  javascriptGenerator.forBlock["forever"] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, "DO");

    const code = `forever(async function(){\n${branch}});\n`;
    return code;
  };

  javascriptGenerator.forBlock["animation_name"] = function (block) {
    const animationName = block.getFieldValue("ANIMATION_NAME");
    return [`"${animationName}"`, javascriptGenerator.ORDER_ATOMIC];
  };

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

  javascriptGenerator.forBlock["stop_all_sounds"] = function (block) {
    // JavaScript code to stop all sounds in a Babylon.js scene
    return "stopAllSounds();\n";
  };

  javascriptGenerator.forBlock["midi_note"] = function (block) {
    const note =
      javascriptGenerator.valueToCode(
        block,
        "NOTE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "60";
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
    const effect = block.getFieldValue("EFFECT");
    const volume =
      javascriptGenerator.valueToCode(
        block,
        "VOLUME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";
    const effectRate =
      javascriptGenerator.valueToCode(
        block,
        "EFFECT_RATE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "5";
    const effectDepth =
      javascriptGenerator.valueToCode(
        block,
        "EFFECT_DEPTH",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.5";
    const attack =
      javascriptGenerator.valueToCode(
        block,
        "ATTACK",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.1";
    const decay =
      javascriptGenerator.valueToCode(
        block,
        "DECAY",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.5";
    const sustain =
      javascriptGenerator.valueToCode(
        block,
        "SUSTAIN",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "0.7";
    const release =
      javascriptGenerator.valueToCode(
        block,
        "RELEASE",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    // Assign the instrument to a variable
    return `${instrumentVar} = createInstrument('${type}', { volume: ${volume}, effect: '${effect}', effectRate: ${effectRate}, effectDepth: ${effectDepth}, attack: ${attack}, decay: ${decay}, sustain: ${sustain}, release: ${release} });\n`;
  };

  javascriptGenerator.forBlock["instrument"] = function (block) {
    const instrumentType = block.getFieldValue("INSTRUMENT_TYPE");

    let instrumentCode;
    switch (instrumentType) {
      case "piano":
        instrumentCode = `createInstrument("square", { attack: 0.1, decay: 0.3, sustain: 0.7, release: 1.0 })`;
        break;
      case "guitar":
        instrumentCode = `createInstrument("sawtooth", { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.9 })`;
        break;
      case "violin":
        instrumentCode = `createInstrument("triangle", { attack: 0.15, decay: 0.5, sustain: 0.8, release: 1.2 })`;
        break;
      default:
        instrumentCode = `createInstrument("sine")`;
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
    const meshNameField = block.getFieldValue("MESH") || "__everywhere__";
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

    const meshDropdownField = meshInput
      ? meshInput.fieldRow.find((field) => field.name === "MESH_NAME")
      : null;

    const meshValue = meshDropdownField
      ? meshDropdownField.getValue()
      : "__everywhere__";

    const meshVariable = `"${meshValue}"`;

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
      console.error("Invalid trigger type for 'when_touches' block:", trigger);
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
      console.error("Invalid trigger type for 'on_collision' block:", trigger);
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

    const doCode = javascriptGenerator.statementToCode(block, "DO").trim();
    const thenCodes = [];

    for (let i = 0; i < block.thenCount_; i++) {
      const thenCode = javascriptGenerator
        .statementToCode(block, "THEN" + i)
        .trim();
      if (thenCode) {
        thenCodes.push(thenCode);
      }
    }

    const allActions = [doCode, ...thenCodes].filter((code) => code);
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

  javascriptGenerator.forBlock["local_variable"] = function (block, generator) {
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
    const event = block.getFieldValue("EVENT"); // "starts" or "ends"
    const statements_do = javascriptGenerator.statementToCode(block, "DO");

    // Pass "true" if event is "ends" for the whenKeyPressed helper function
    return `whenKeyEvent("${key}", async () => {${statements_do}}, ${event === "ends"});\n`;
  };

  javascriptGenerator.forBlock["when_action_event"] = function (block) {
    const action = block.getFieldValue("ACTION");
    const event = block.getFieldValue("EVENT");
    const statements_do = javascriptGenerator.statementToCode(block, "DO");

    return `whenActionEvent("${action}", async () => {${statements_do}}, ${event === "ends"});\n`;
  };

  // JavaScript generator for broadcast_event
  javascriptGenerator.forBlock["broadcast_event"] = function (block) {
    const raw =
      javascriptGenerator.valueToCode(
        block,
        "EVENT_NAME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "undefined";

    const safe = emitSafeIdentifierLiteral(raw, undefined);
    return `broadcastEvent(${safe});\n`;
  };

  // JavaScript generator for on_event
  javascriptGenerator.forBlock["on_event"] = function (block) {
    // Don't force a default; let invalid/empty resolve to undefined
    const raw =
      javascriptGenerator.valueToCode(
        block,
        "EVENT_NAME",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "";

    const safe = emitSafeIdentifierLiteral(raw);

    const statements_do = javascriptGenerator.statementToCode(block, "DO");
    return `onEvent(${safe}, async function() {\n${statements_do}});\n`;
  };

  javascriptGenerator.forBlock["highlight"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const color = getFieldValue(block, "COLOR", '"#FFD700"');
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
    const color = getFieldValue(block, "COLOR", '"#AA336A"');

    return `await tint(${modelName}, { color: ${color} });\n`;
  };

  javascriptGenerator.forBlock["change_color"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const color = getFieldValue(block, "COLOR", '"#ffffff"');

    return `await changeColor(${modelName}, { color: ${color} });\n`;
  };

  javascriptGenerator.forBlock["change_material"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("ID_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const material = block.getFieldValue("MATERIALS");
    const color = getFieldValue(block, "COLOR", '"#ffffff"');

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

  javascriptGenerator.forBlock["control_animation_group"] = function (block) {
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

  javascriptGenerator.forBlock["touching_surface"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return [`isTouchingSurface(${modelName})`, javascriptGenerator.ORDER_NONE];
  };

  javascriptGenerator.forBlock["mesh_exists"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return [`meshExists(${modelName})`, javascriptGenerator.ORDER_NONE];
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

  javascriptGenerator.forBlock["canvas_controls"] = function (block) {
    const controls = block.getFieldValue("CONTROLS") == "TRUE";
    return `canvasControls(${controls});\n`;
  };

  javascriptGenerator.forBlock["action_pressed"] = function (block) {
    const action = block.getFieldValue("ACTION");
    return [`actionPressed("${action}")`, javascriptGenerator.ORDER_NONE];
  };

  javascriptGenerator.forBlock["set_action_key"] = function (block) {
    const action = block.getFieldValue("ACTION");
    const key = block.getFieldValue("KEY");
    return `setActionKey("${action}", ${JSON.stringify(key)});\n`;
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
    const value_to = getFieldValue(block, "TO", 10);
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
      ) || '"#ffffff"';

    const textureSet = block.getFieldValue("TEXTURE_SET");
    const alpha =
      javascriptGenerator.valueToCode(
        block,
        "ALPHA",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    // Always return a standard data object.
    // Logic that uses this block (like set_material) will handle the application.
    const code = `{ 
                color: ${baseColor}, 
                materialName: "${textureSet}", 
                alpha: ${alpha} 
            }`;

    return [code, javascriptGenerator.ORDER_ATOMIC];
  };

  javascriptGenerator.forBlock["set_material"] = function (block) {
    const meshVar = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH"),
      Blockly.Names.NameType.VARIABLE,
    );

    const material =
      javascriptGenerator.valueToCode(
        block,
        "MATERIAL",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "{}";

    const code = `setMaterial(${meshVar}, ${material});\n`;
    return code;
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

  javascriptGenerator.forBlock["procedures_defnoreturn"] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("NAME"),
      Blockly.PROCEDURE_CATEGORY_NAME,
    );
    const args = block.argData_.map((elem) =>
      javascriptGenerator.nameDB_.getName(
        elem.model.name,
        Blockly.Names.NameType.VARIABLE,
      ),
    );
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

  javascriptGenerator.forBlock["procedures_callnoreturn"] = function (block) {
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

  javascriptGenerator.forBlock["procedures_defreturn"] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("NAME"),
      Blockly.PROCEDURE_CATEGORY_NAME,
    );
    const args = block.argData_.map((elem) =>
      javascriptGenerator.nameDB_.getName(
        elem.model.name,
        Blockly.Names.NameType.VARIABLE,
      ),
    );
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

  javascriptGenerator.forBlock["procedures_callreturn"] = function (block) {
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
    clearMeshMaps();
    if (!javascriptGenerator.nameDB_) {
      javascriptGenerator.nameDB_ = new Blockly.Names(reservedWordsWithoutName);
    } else {
      javascriptGenerator.nameDB_.reset();
    }
    javascriptGenerator.nameDB_.setVariableMap(workspace.getVariableMap());
    javascriptGenerator.nameDB_.populateVariables(workspace);
    javascriptGenerator.nameDB_.populateProcedures(workspace);

    const defvars = [];
    const userVariableDefaults = new Map();
    // Add developer variables (not created or named by the user).
    const devVarList = Blockly.Variables.allDeveloperVariables(workspace);
    for (let i = 0; i < devVarList.length; i++) {
      defvars.push(
        javascriptGenerator.nameDB_.getName(
          devVarList[i],
          Blockly.Names.NameType.DEVELOPER_VARIABLE,
        ),
      );
    }

    // Add user variables, but only ones that are being used.
    const variables = Blockly.Variables.allUsedVarModels(workspace);
    for (let i = 0; i < variables.length; i++) {
      const variableModel = variables[i];
      const generatedName = javascriptGenerator.nameDB_.getName(
        variableModel.getId(),
        Blockly.Names.NameType.VARIABLE,
      );
      defvars.push(generatedName);
      userVariableDefaults.set(generatedName, variableModel.name);
    }

    // Declare all of the variables.
    if (defvars.length) {
      let defvarsmesh = defvars.map(function (name) {
        const initialValue = userVariableDefaults.has(name)
          ? userVariableDefaults.get(name)
          : name;
        return `let ${name} = ${JSON.stringify(initialValue)};`;
      });
      javascriptGenerator.definitions_["variables"] =
        `// Made with Flock XR\n` + defvarsmesh.join(" ") + "\n";
    }

    javascriptGenerator.isInitialized = true;
  };

  javascriptGenerator.forBlock["play_rumble_pattern"] = function (block) {
    const pattern = block.getFieldValue("PATTERN");
    return `playRumblePattern("${pattern}");\n`;
  };

  javascriptGenerator.forBlock["controller_rumble"] = function (block) {
    const motor = block.getFieldValue("MOTOR");
    const strength =
      javascriptGenerator.valueToCode(
        block,
        "STRENGTH",
        javascriptGenerator.ORDER_NONE,
      ) || "1";
    const duration =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_NONE,
      ) || "500";

    return `controllerRumble("${motor}", ${strength}, ${duration});\n`;
  };

  javascriptGenerator.forBlock["controller_rumble_pattern"] = function (block) {
    const motor = block.getFieldValue("MOTOR");
    const strength =
      javascriptGenerator.valueToCode(
        block,
        "STRENGTH",
        javascriptGenerator.ORDER_NONE,
      ) || "1";
    const onDuration =
      javascriptGenerator.valueToCode(
        block,
        "ON_DURATION",
        javascriptGenerator.ORDER_NONE,
      ) || "200";
    const offDuration =
      javascriptGenerator.valueToCode(
        block,
        "OFF_DURATION",
        javascriptGenerator.ORDER_NONE,
      ) || "100";
    const repeats =
      javascriptGenerator.valueToCode(
        block,
        "REPEATS",
        javascriptGenerator.ORDER_NONE,
      ) || "3";

    return `controllerRumblePattern("${motor}", ${strength}, ${onDuration}, ${offDuration}, ${repeats});\n`;
  };

  javascriptGenerator.forBlock["camera_control"] = function (block) {
    const key = block.getFieldValue("KEY");
    const action = block.getFieldValue("ACTION");

    return `cameraControl(${JSON.stringify(key)}, "${action}");\n`;
  };

  javascriptGenerator.forBlock["keyword_block"] = function (block) {
    // Since this block is replaced with another block, we return an empty string.
    return "";
  };

  /* DEPRECATED? 
  javascriptGenerator.forBlock["load_object2"] = function (block) {
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

    //const meshId = modelName + "_" + generateUniqueId();
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

  
  
  javascriptGenerator.forBlock["create_ground"] = function (block) {
    const meshId = "ground";
    meshMap[meshId] = block;
    meshBlockIdMap[meshId] = block.id;
    let color =
      javascriptGenerator.valueToCode(
        block,
        "COLOR",
        javascriptGenerator.ORDER_NONE,
      ) || '"#71BC78"';

    const colorBlock = block.getInputTargetBlock("COLOR");

    if (colorBlock && colorBlock.type === "material") {
      // Material blocks already generate a material object; pass it directly to
      // createGround so the material can be applied instead of trying to access
      // a colour property.
      color = javascriptGenerator.valueToCode(
        block,
        "COLOR",
        javascriptGenerator.ORDER_FUNCTION_CALL,
      );
    }

    return `createGround(${color}, "${meshId}");\n`;
  };

  javascriptGenerator.forBlock["create_wall"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#9932CC"');
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
  */
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
    "while (" + argument0 + ") {\n" + branch + `\nawait wait(0);\n` + "}\n"
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
      generator.valueToCode(block, "TIMES", generator.ORDER_ASSIGNMENT) || "0";
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
    generator.valueToCode(block, "FROM", generator.ORDER_ASSIGNMENT) || "0";
  const argument1 =
    generator.valueToCode(block, "TO", generator.ORDER_ASSIGNMENT) || "0";
  const increment =
    generator.valueToCode(block, "BY", generator.ORDER_ASSIGNMENT) || "1";

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
    generator.valueToCode(block, "FROM", generator.ORDER_ASSIGNMENT) || "0";
  const argument1 =
    generator.valueToCode(block, "TO", generator.ORDER_ASSIGNMENT) || "0";
  const increment =
    generator.valueToCode(block, "BY", generator.ORDER_ASSIGNMENT) || "1";

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
    generator.valueToCode(block, "LIST", generator.ORDER_ASSIGNMENT) || "[]";

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

const MODE = { IF: "IF", ELSEIF: "ELSEIF", ELSE: "ELSE" };

javascriptGenerator.forBlock["if_clause"] = function (block, generator) {
  const isClause = (b) => b && b.type === "if_clause";

  const mode = block.getFieldValue("MODE");
  const prev = block.getPreviousBlock();

  // A new IF always starts a new chain, even if it follows another if_clause.
  const isChainTop = !isClause(prev) || mode === MODE.IF;

  // Non-top clauses do not emit code independently.
  if (!isChainTop) return "";

  // Collect this IF plus any following ELSEIF/ELSE clauses,
  // but stop before the next IF (that starts a new chain).
  const chain = [];
  let cur = block;

  while (cur && isClause(cur)) {
    chain.push(cur);

    const next = cur.getNextBlock();
    if (next && isClause(next) && next.getFieldValue("MODE") === MODE.IF) break;

    cur = next;
  }

  let code = "";

  const first = chain[0];
  const firstCond =
    generator.valueToCode(first, "COND", generator.ORDER_NONE) || "false";
  const firstBody = generator.statementToCode(first, "DO");

  code += `if (${firstCond}) {\n${firstBody}}`;

  for (let i = 1; i < chain.length; i++) {
    const clause = chain[i];
    const clauseMode = clause.getFieldValue("MODE");

    if (clauseMode === MODE.ELSEIF) {
      const cond =
        generator.valueToCode(clause, "COND", generator.ORDER_NONE) || "false";
      const body = generator.statementToCode(clause, "DO");
      code += ` else if (${cond}) {\n${body}}`;
      continue;
    }

    if (clauseMode === MODE.ELSE) {
      const body = generator.statementToCode(clause, "DO");
      code += ` else {\n${body}}`;
      break;
    }

    // Defensive: if something weird slips through, stop.
    if (clauseMode === MODE.IF) break;
  }

  return code + "\n";
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

javascriptGenerator.forBlock["lists_getIndex"] = function (block) {
  const mode = block.getFieldValue("MODE") || "GET";
  const where = block.getFieldValue("WHERE") || "FROM_START";
  const listOrder =
    where === "RANDOM"
      ? javascriptGenerator.ORDER_NONE
      : javascriptGenerator.ORDER_MEMBER;
  const list =
    javascriptGenerator.valueToCode(block, "VALUE", listOrder) || "[]";

  switch (where) {
    case "FIRST":
      if (mode === "GET") {
        return [`${list}[0]`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "GET_REMOVE") {
        return [`${list}.shift()`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "REMOVE") {
        return `${list}.shift();\n`;
      }
      break;

    case "LAST":
      if (mode === "GET") {
        return [`${list}.slice(-1)[0]`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "GET_REMOVE") {
        return [`${list}.pop()`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "REMOVE") {
        return `${list}.pop();\n`;
      }
      break;

    case "FROM_START": {
      const at = javascriptGenerator.getAdjusted(block, "AT");
      if (mode === "GET") {
        return [`${list}[${at}]`, javascriptGenerator.ORDER_MEMBER];
      }
      if (mode === "GET_REMOVE") {
        return [
          `${list}.splice(${at}, 1)[0]`,
          javascriptGenerator.ORDER_FUNCTION_CALL,
        ];
      }
      if (mode === "REMOVE") {
        return `${list}.splice(${at}, 1);\n`;
      }
      break;
    }

    case "FROM_END": {
      const at = javascriptGenerator.getAdjusted(block, "AT", 1, true);
      if (mode === "GET") {
        return [
          `${list}.slice(${at})[0]`,
          javascriptGenerator.ORDER_FUNCTION_CALL,
        ];
      }
      if (mode === "GET_REMOVE") {
        return [
          `${list}.splice(${at}, 1)[0]`,
          javascriptGenerator.ORDER_FUNCTION_CALL,
        ];
      }
      if (mode === "REMOVE") {
        return `${list}.splice(${at}, 1);\n`;
      }
      break;
    }

    case "RANDOM": {
      const functionName = javascriptGenerator.provideFunction_(
        "listsGetRandomItem",
        `
function ${javascriptGenerator.FUNCTION_NAME_PLACEHOLDER_}(list, remove) {
  var x = randomInteger(0, list.length - 1);
  if (remove) {
    return list.splice(x, 1)[0];
  } else {
    return list[x];
  }
}
`,
      );
      const code = `${functionName}(${list}, ${mode !== "GET"})`;
      if (mode === "GET" || mode === "GET_REMOVE") {
        return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
      }
      if (mode === "REMOVE") {
        return `${code};\n`;
      }
      break;
    }
  }

  throw Error("Unhandled combination (lists_getIndex).");
};

javascriptGenerator.forBlock["lists_setIndex"] = function (block) {
  function cacheList() {
    if (list.match(/^\w+$/)) {
      return "";
    }

    const listVar = javascriptGenerator.nameDB_.getDistinctName(
      "tmpList",
      Blockly.Names.NameType.VARIABLE,
    );
    const listAssignment = `var ${listVar} = ${list};\n`;
    list = listVar;
    return listAssignment;
  }

  let list =
    javascriptGenerator.valueToCode(
      block,
      "LIST",
      javascriptGenerator.ORDER_MEMBER,
    ) || "[]";
  const mode = block.getFieldValue("MODE") || "GET";
  let where = block.getFieldValue("WHERE") || "FROM_START";
  const value =
    javascriptGenerator.valueToCode(
      block,
      "TO",
      javascriptGenerator.ORDER_ASSIGNMENT,
    ) || "null";

  switch (where) {
    case "FIRST":
      if (mode === "SET") {
        return `${list}[0] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return `${list}.unshift(${value});\n`;
      }
      break;

    case "LAST":
      if (mode === "SET") {
        return cacheList() + `${list}[${list}.length - 1] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return `${list}.push(${value});\n`;
      }
      break;

    case "FROM_START": {
      const index = javascriptGenerator.getAdjusted(block, "AT");
      if (mode === "SET") {
        return `${list}[${index}] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return `${list}.splice(${index}, 0, ${value});\n`;
      }
      break;
    }

    case "FROM_END": {
      const index = javascriptGenerator.getAdjusted(
        block,
        "AT",
        1,
        false,
        javascriptGenerator.ORDER_SUBTRACTION,
      );
      const listCache = cacheList();
      if (mode === "SET") {
        return listCache + `${list}[${list}.length - ${index}] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return (
          listCache +
          `${list}.splice(${list}.length - ${index}, 0, ${value});\n`
        );
      }
      break;
    }

    case "RANDOM": {
      let code = cacheList();
      const xVar = javascriptGenerator.nameDB_.getDistinctName(
        "tmpX",
        Blockly.Names.NameType.VARIABLE,
      );
      code += `var ${xVar} = randomInteger(0, ${list}.length - 1);\n`;
      if (mode === "SET") {
        return code + `${list}[${xVar}] = ${value};\n`;
      }
      if (mode === "INSERT") {
        return code + `${list}.splice(${xVar}, 0, ${value});\n`;
      }
      break;
    }
  }

  throw Error("Unhandled combination (lists_setIndex).");
};

javascriptGenerator.forBlock["lists_add_item"] = function (block) {
  const listName = javascriptGenerator.nameDB_.getName(
    block.getFieldValue("LIST"),
    Blockly.Names.NameType.VARIABLE,
  );
  const value =
    javascriptGenerator.valueToCode(
      block,
      "TO",
      javascriptGenerator.ORDER_ASSIGNMENT,
    ) || '""';

  return `if (!Array.isArray(${listName})) {\n  ${listName} = [];\n}\n${listName}.push(${value});\n`;
};

javascriptGenerator.forBlock["lists_delete_nth"] = function (block) {
  const listName = javascriptGenerator.nameDB_.getName(
    block.getFieldValue("LIST"),
    Blockly.Names.NameType.VARIABLE,
  );
  const index =
    javascriptGenerator.valueToCode(
      block,
      "INDEX",
      javascriptGenerator.ORDER_NONE,
    ) || "0";

  return `if (Array.isArray(${listName})) {
  ${listName}.splice(${index}, 1);
}
`;
};

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
