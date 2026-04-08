import * as Blockly from "blockly";
import { getFieldValue } from "./generators-utilities.js";

export function registerSensingGenerators(javascriptGenerator) {
  // -------------------------------
  // SENSING
  // -------------------------------
  // Movement or action control
  javascriptGenerator.forBlock["action_pressed"] = function (block) {
    const action = block.getFieldValue("ACTION");
    return [`actionPressed("${action}")`, javascriptGenerator.ORDER_NONE];
  };

  // Set % key to %
  javascriptGenerator.forBlock["set_action_key"] = function (block) {
    const action = block.getFieldValue("ACTION");
    const key = block.getFieldValue("KEY");
    return `setActionKey("${action}", ${JSON.stringify(key)});\n`;
  };

  // Object exists?
  javascriptGenerator.forBlock["mesh_exists"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return [`meshExists(${modelName})`, javascriptGenerator.ORDER_NONE];
  };

  // Is object touching surface
  javascriptGenerator.forBlock["touching_surface"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MODEL_VAR"),
      Blockly.Names.NameType.VARIABLE,
    );

    return [`isTouchingSurface(${modelName})`, javascriptGenerator.ORDER_NONE];
  };

  // Object touching object
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

  // Get property of object
  javascriptGenerator.forBlock["get_property"] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue("MESH"),
      Blockly.Names.NameType.VARIABLE,
    );
    const propertyName = block.getFieldValue("PROPERTY");

    const code = `getProperty(${modelName}, '${propertyName}')`;
    return [code, javascriptGenerator.ORDER_NONE];
  };

  // Distance from object to object
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

  // Ground level
  javascriptGenerator.forBlock["ground_level"] = function () {
    const code = "-999999";
    return [code, javascriptGenerator.ORDER_NONE];
  };

  // Time in seconds
  javascriptGenerator.forBlock["time"] = function (block) {
    const unit = block.getFieldValue("UNIT") || "seconds";
    const code = `getTime("${unit}")`;
    return [code, javascriptGenerator.ORDER_NONE];
  };

  // Canvas controls
  javascriptGenerator.forBlock["canvas_controls"] = function (block) {
    const controls = block.getFieldValue("CONTROLS") == "TRUE";
    return `canvasControls(${controls});\n`;
  };

  // Button controls
  javascriptGenerator.forBlock["button_controls"] = function (block) {
    const color = getFieldValue(block, "COLOR", '"#ffffff"');
    const control = block.getFieldValue("CONTROL");
    const mode = block.getFieldValue("ENABLED");
    return `buttonControls("${control}", "${mode}", ${color});\n`;
  };

  // When micro:bit event occurs
  javascriptGenerator.forBlock["microbit_input"] = function (block) {
    const event = block.getFieldValue("EVENT");
    const statements_do = javascriptGenerator.statementToCode(block, "DO");

    return `whenKeyEvent("${event}", async () => {${statements_do}});\n`;
  };
}
