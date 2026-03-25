import * as Blockly from "blockly";

export function registerDataGenerators(javascriptGenerator) {
  // -------------------------------
  // VARIABLES
  // -------------------------------

  // All Blockly standard implementation

  // Set variable to number
  // Set variable to string
  // Change variable value by number
  // Variable
  // -------------------------------
  // LISTS
  // -------------------------------

  // The following use Blockly standard implementation

  // Set list to variable
  // Set list to numeric list
  // Set list to text list
  // Set list to colour list

  // Add string to list ---------------------------------------------
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

  // Delete from list -----------------------------------------------
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

  // The following use Blockly standard implementation

  // Create empty list
  // Triple list
  // Create list with item repeated x times
  // Length of list
  // Is list empty?
  // Find item in list

  // Get index of item in list ------------------------------------
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

  // Set index of item in list --------------------------------------
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

  // The following use Blockly standard implementation

  // Set index x in list to value
  // Get sub list by index
  // Explode text into list
  // Sort list
}
