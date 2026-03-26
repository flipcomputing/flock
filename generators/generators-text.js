import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap, generateUniqueId } from "./mesh-state.js";
import {
  getFieldValue,
  sanitizeForCode,
  emitSafeTextArg,
  getVariableInfo,
} from "./generators-utilities.js";

export function registerTextGenerators(javascriptGenerator) {
  // -------------------------------
  // TEXT
  // -------------------------------
  // Print --------------------------------------------------
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

  // Say ----------------------------------------------------
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

  // UI Text ------------------------------------------------
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

  // UI Button ----------------------------------------------
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

  // UI Input -----------------------------------------------
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

  // UI Slider ----------------------------------------------
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

  // String -------------------------------------------------
  // Uses Blockly default

  // Comment ------------------------------------------------
  javascriptGenerator.forBlock["comment"] = function (block) {
    /**
     * comment block -> single-line JS comment.
     * Sanitizes the displayed text so it cannot break out of comment context.
     */
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
  // Describe -----------------------------------------------
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

  // Add 3D text --------------------------------------------
  javascriptGenerator.forBlock["create_3d_text"] = function (block) {
    const { generatedName: variableName, userVariableName } = getVariableInfo(
      block,
      "ID_VAR",
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

    const meshId = `${userVariableName}__${block.id}`;
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;

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

  // -------------------------------
  // STRINGS
  // -------------------------------

  // All use Blockly defaults

  // Concatenate --------------------------------------------
  // Append text --------------------------------------------
  // Length of string ---------------------------------------
  // Empty string? ------------------------------------------
  // Find needle in haystack --------------------------------
  // Find letter at position x ------------------------------
  // Substring ----------------------------------------------
  // Case format --------------------------------------------
  // Trim ---------------------------------------------------
  // Count substring occurrences in string ------------------
  // Replace substring in string ----------------------------
  // Reverse string -----------------------------------------
}
