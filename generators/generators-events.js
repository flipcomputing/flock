import * as Blockly from 'blockly';

export function registerEventsGenerators(javascriptGenerator) {
  // -------------------------------
  // EVENTS
  // -------------------------------
  // Start -----------------------------------------------------
  javascriptGenerator.forBlock['start'] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, 'DO');
    return `(async () => {\n${branch}})();\n`;
  };

  // Forever ---------------------------------------------------
  javascriptGenerator.forBlock['forever'] = function (block) {
    const branch = javascriptGenerator.statementToCode(block, 'DO');

    const code = `forever(async function(){\n${branch}});\n`;
    return code;
  };

  // when % clicked --------------------------------------------
  javascriptGenerator.forBlock['when_clicked'] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('MODEL_VAR'),
      Blockly.Names.NameType.VARIABLE
    );
    const trigger = block.getFieldValue('TRIGGER');
    const mode = block.getFieldValue('MODE') || 'wait';

    const sections = ['DO'];
    for (let i = 0; i < (block.thenCount_ || 0); i++) sections.push('THEN' + i);

    const actionFunctions = sections.map(
      (name) =>
        `async function(${modelName}) {\n${javascriptGenerator.statementToCode(block, name).trim()}\n}`
    );

    // Determine if this is a top-level block (not nested)
    const isTopLevel = !block.getSurroundParent();

    const code =
      `onTrigger(${modelName}, {\n` +
      `  trigger: ${JSON.stringify(trigger)},\n` +
      `  callback: [\n${actionFunctions.join(',\n')}\n],\n` +
      `  mode: ${JSON.stringify(mode)}` +
      (isTopLevel ? `,\n  applyToGroup: true` : '') +
      `\n});\n`;

    return code;
  };

  // on % collision with % -------------------------------------
  javascriptGenerator.forBlock['on_collision'] = function (block) {
    const modelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('MODEL_VAR'),
      Blockly.Names.NameType.VARIABLE,
      true
    );

    const otherModelName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('OTHER_MODEL_VAR'),
      Blockly.Names.NameType.VARIABLE,
      true
    );

    const callbackVar2Name = block.callbackVar2Id
      ? javascriptGenerator.nameDB_.getName(
          block.callbackVar2Id,
          Blockly.Names.NameType.VARIABLE,
          true
        )
      : null;
    const param2 = callbackVar2Name ?? otherModelName;

    const trigger = block.getFieldValue('TRIGGER');
    const doCode = javascriptGenerator.statementToCode(block, 'DO');
    const isTopLevel = !block.getSurroundParent();

    if (trigger === 'OnIntersectionEnterTrigger' || trigger === 'OnIntersectionExitTrigger') {
      const groupLine = isTopLevel
        ? block.callbackVar2Id
          ? ',\n            applyToGroupSelf: true'
          : ',\n            applyToGroupOther: true'
        : '';
      return `onIntersect(${modelName}, ${otherModelName}, {
            trigger: ${JSON.stringify(trigger)},
            callback: async function(${modelName}, ${param2}) {
          ${doCode}
            }${groupLine}
          });\n`;
    } else {
      console.error("Invalid trigger type for 'on_collision' block:", trigger);
      return '';
    }
  };
  // When % action event ----------------------------------------
  javascriptGenerator.forBlock['when_action_event'] = function (block) {
    const action = block.getFieldValue('ACTION');
    const event = block.getFieldValue('EVENT');
    const statements_do = javascriptGenerator.statementToCode(block, 'DO');

    return `whenActionEvent(${JSON.stringify(action)}, async () => {${statements_do}}, ${event === 'released'});\n`;
  };

  // Broadcast event -------------------------------------------
  // Typed names are used exactly as written (trimmed); other inputs are evaluated at run time.
  const eventNameCode = (block) => {
    const input = block.getInputTargetBlock('EVENT_NAME');
    if (input?.type === 'text') return JSON.stringify(input.getFieldValue('TEXT').trim());
    return (
      javascriptGenerator.valueToCode(block, 'EVENT_NAME', javascriptGenerator.ORDER_NONE) ||
      'undefined'
    );
  };

  javascriptGenerator.forBlock['broadcast_event'] = function (block) {
    return `broadcastEvent(${eventNameCode(block)});\n`;
  };

  // On event --------------------------------------------------
  javascriptGenerator.forBlock['on_event'] = function (block) {
    const statements_do = javascriptGenerator.statementToCode(block, 'DO');
    return `onEvent(${eventNameCode(block)}, async function() {\n${statements_do}});\n`;
  };

  javascriptGenerator.forBlock['restart'] = function () {
    return 'restartProject();\n';
  };
}
