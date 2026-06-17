import * as Blockly from "blockly";

export function registerFunctionsGenerators(javascriptGenerator) {
  // -------------------------------
  // FUNCTIONS
  // -------------------------------

  // Function definition, no return --------------------------------
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

  // Function definition with return -------------------------------
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

  // If condition, return ------------------------------------------
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

  // Call function -------------------------------------------------
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
}
