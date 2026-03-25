import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { meshMap, meshBlockIdMap } from "./mesh-state.js";

// ---------------------------------
//  Utility functions for generators
// ---------------------------------

export function getFieldValue(block, fieldName, defaultValue) {
  return (
    javascriptGenerator.valueToCode(
      block,
      fieldName,
      javascriptGenerator.ORDER_ATOMIC,
    ) || defaultValue
  );
}

export function getVariableInfo(block, fieldName) {
  const variableId = block.getFieldValue(fieldName);
  const generatedName = javascriptGenerator.nameDB_.getName(
    variableId,
    Blockly.Names.NameType.VARIABLE,
  );
  const variableModel = block.workspace
    ?.getVariableMap?.()
    ?.getVariableById(variableId);
  const userVariableName = variableModel?.name || generatedName;

  return { generatedName, userVariableName };
}

export function getPositionTuple(block) {
  const posX = getFieldValue(block, "X", "0");
  const posY = getFieldValue(block, "Y", "0");
  const posZ = getFieldValue(block, "Z", "0");

  return `[${posX}, ${posY}, ${posZ}]`;
}

export function createMesh(block, meshType, params) {
  const { generatedName: variableName, userVariableName } = getVariableInfo(
    block,
    "ID_VAR",
  );

  const meshId = `${userVariableName}__${block.id}`;

  meshMap[block.id] = block;
  meshBlockIdMap[block.id] = block.id;

  const doCode = block.getInput("DO")
    ? javascriptGenerator.statementToCode(block, "DO") || ""
    : "";

  const options = [...params];

  return `${variableName} = create${meshType}("${meshId}", { ${options.join(", ")} });\n${doCode}`;
}
