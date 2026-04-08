import { getFieldValue } from "./generators-utilities.js";

export function registerMathGenerators(javascriptGenerator) {
  // -------------------------------
  // MATH
  // -------------------------------

  // Arithmetic operator - uses Blockly default

  // Random integer ----------------------------------------------------
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

  // Random integer with seed -----------------------------------------
  javascriptGenerator.forBlock["random_seeded_int"] = function (block) {
    const value_from = getFieldValue(block, "FROM", 0);
    const value_to = getFieldValue(block, "TO", 10);
    const value_seed = getFieldValue(block, "SEED", 123456);

    const code = `seededRandom(${value_from}, ${value_to}, ${value_seed})`;

    return [code, javascriptGenerator.ORDER_NONE];
  };

  // Integer - uses Blockly default

  // Convert to integer -----------------------------------------------
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

  // The following all use Blockly defaults

  // Constants e.g. Pi
  // Test even, odd, prime etc
  // Round
  // Absolute
  // Trig functions
  // Sum list
  // Remainder
  // Constrain
  // Random fractions
}
