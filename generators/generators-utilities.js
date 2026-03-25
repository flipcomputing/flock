import { javascriptGenerator } from "blockly/javascript";

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
