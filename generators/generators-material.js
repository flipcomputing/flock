import * as Blockly from "blockly";
import { getFieldValue } from "./generators-utilities.js";

export function registerMaterialGenerators(javascriptGenerator) {
  // -------------------------------
  // MATERIAL
  // -------------------------------
  // Color object to color list ---------------------------------
  javascriptGenerator.forBlock["change_color"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const color = getFieldValue(block, "COLOR", '"#ffffff"');

    return `await changeColor(${modelName}, { color: ${color} });\n`;
  };

  // Set alpha of object ----------------------------------------
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

  // Tint object ------------------------------------------------
  javascriptGenerator.forBlock["tint"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const color = getFieldValue(block, "COLOR", '"#AA336A"');

    return `await tint(${modelName}, { color: ${color} });\n`;
  };

  // Highlight object -------------------------------------------
  javascriptGenerator.forBlock["highlight"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    const color = getFieldValue(block, "COLOR", '"#FFD700"');
    return `await highlight(${modelName}, { color: ${color} });\n`;
  };

  // Glow object ------------------------------------------------
  javascriptGenerator.forBlock["glow"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );
    return `await glow(${modelName});\n`;
  };

  // Clear effects on object ------------------------------------
  javascriptGenerator.forBlock["clear_effects"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return `await clearEffects(${modelName});\n`;
  };

  // Colour -----------------------------------------------------
  javascriptGenerator.forBlock["colour"] = function (block) {
    const colour = block.getFieldValue("COLOR");
    const code = `"${colour}"`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };

  // Colour list ------------------------------------------------

  // Uses Blockly built in

  // Random colour ----------------------------------------------
  javascriptGenerator.forBlock["random_colour"] = function (block) {
    const code = `randomColour()`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };
  // Hex colour -------------------------------------------------
  javascriptGenerator.forBlock["colour_from_string"] = function (block) {
    const colourValue = block.getFieldValue("COLOR") || "#000000";
    return [`"${colourValue}"`, javascriptGenerator.ORDER_ATOMIC];
  };

  // Set material of object -------------------------------------
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

  // Material ----------------------------------------------------
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

  // Skin colour --------------------------------------------------
  // used within character definition but not as a standalone block
  javascriptGenerator.forBlock["skin_colour"] = function (block) {
    const colour = block.getFieldValue("COLOR");
    const code = `"${colour}"`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };
}
