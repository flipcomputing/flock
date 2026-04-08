import * as Blockly from "blockly";
import { emitSafeIdentifierLiteral } from "./generators-utilities.js";

export function registerEventsGenerators(javascriptGenerator) {
  // -------------------------------
  // EVENTS
  // -------------------------------
  // Start -----------------------------------------------------
  javascriptGenerator.forBlock["start"] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, "DO");
    return `(async () => {\n${branch}})();\n`;
  };

  // Forever ---------------------------------------------------
  javascriptGenerator.forBlock["forever"] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, "DO");

    const code = `forever(async function(){\n${branch}});\n`;
    return code;
  };

  // when % clicked --------------------------------------------
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

  // on % collision with % -------------------------------------
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
  // When % action event ----------------------------------------
  javascriptGenerator.forBlock["when_action_event"] = function (block) {
    const action = block.getFieldValue("ACTION");
    const event = block.getFieldValue("EVENT");
    const statements_do = javascriptGenerator.statementToCode(block, "DO");

    return `whenActionEvent("${action}", async () => {${statements_do}}, ${event === "ends"});\n`;
  };

  // Broadcast event -------------------------------------------
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

  // On event --------------------------------------------------
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
}
