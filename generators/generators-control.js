import * as Blockly from "blockly";

export function registerControlGenerators(javascriptGenerator) {
  // -------------------------------
  // CONTROL
  // -------------------------------
  // Wait for x seconds
  javascriptGenerator.forBlock["wait_seconds"] = function (block) {
    const duration =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    return `await wait(${duration});\n`;
  };

  // Wait until condition is true
  javascriptGenerator.forBlock["wait_until"] = function (block) {
    const condition =
      javascriptGenerator.valueToCode(
        block,
        "CONDITION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "false"; // Default to false if no condition is connected

    return `await waitUntil(() => ${condition});\n`;
  };

  // Repeat x times
  javascriptGenerator.forBlock["controls_repeat_ext"] = function (
    block,
    generator,
  ) {
    let repeats;
    if (block.getField("TIMES")) {
      repeats = String(Number(block.getFieldValue("TIMES")));
    } else {
      repeats =
        generator.valueToCode(block, "TIMES", generator.ORDER_ASSIGNMENT) ||
        "0";
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

  // Repeat while/until condition
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

  // For each loop with iterator variable
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

  // For each loop iterating over list
  javascriptGenerator.forBlock["controls_forEach"] = function (
    block,
    generator,
  ) {
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

  // Break out of loop
  // ?? Uses blockly standard

  // Local
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

  // Wait x milliseconds
  javascriptGenerator.forBlock["wait"] = function (block) {
    const duration =
      javascriptGenerator.valueToCode(
        block,
        "DURATION",
        javascriptGenerator.ORDER_ATOMIC,
      ) || "1";

    return `await wait(${duration} / 1000);\n`;
  };
}
