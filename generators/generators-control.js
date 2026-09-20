import * as Blockly from 'blockly';
import { SECTION_NAME_TYPE, findOwningSection } from '../blocks/sectionContainment.js';

function budgetYield(generator, label) {
  const timingVar = generator.nameDB_.getDistinctName(
    `${label}_yield`,
    Blockly.Names.DEVELOPER_VARIABLE_TYPE
  );
  const countVar = generator.nameDB_.getDistinctName(
    `${label}_yield_n`,
    Blockly.Names.DEVELOPER_VARIABLE_TYPE
  );
  // Read the clock only every 16th iteration; per-iteration performance.now()
  // dominates a cheap loop body (~40ns vs ~1ns).
  return {
    decl: `let ${timingVar} = performance.now();\nlet ${countVar} = 0;\n`,
    tick:
      `if ((${countVar}++ & 15) === 0 && performance.now() - ${timingVar} > 16) {\n` +
      `  await new Promise(resolve => __flockLoopYield(resolve));\n` +
      `  ${timingVar} = performance.now();\n` +
      `}\n`,
  };
}

export function registerControlGenerators(javascriptGenerator) {
  // -------------------------------
  // CONTROL
  // -------------------------------
  javascriptGenerator.forBlock['section'] = function (block) {
    const ws = block.workspace;
    const ids = block.containedBlockIds_ || [];
    const autoStart = block.getFieldValue('START') === 'TRUE';
    // Mangled, not the raw field text, keeping free-text names out of generated code.
    const fnName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('NAME'),
      SECTION_NAME_TYPE
    );

    const lines = ids
      .map((id) => ws.getBlockById(id))
      .filter((child) => child && child.isEnabled())
      .map((child) => {
        const line = javascriptGenerator.blockToCode(child);
        return Array.isArray(line) ? line[0] : line;
      })
      .join('');

    let code = `async function ${fnName}() {\n${lines}}\n`;
    // Non-autostart sections stay defined but dormant until loaded explicitly.
    // Queued: this is top-level, not nested inside another section.
    if (autoStart) {
      code += `await loadSectionQueued(${fnName});\n`;
    }
    return code;
  };

  // Resolves a section_control block's SECTION field to its target's mangled
  // function name. Null covers a deleted/never-chosen target and "none" alike.
  function targetSectionFnName(block) {
    const targetId = block.getFieldValue('SECTION');
    const target = targetId && block.workspace.getBlockById(targetId);
    if (!target || target.type !== 'section') return null;
    return javascriptGenerator.nameDB_.getName(target.getFieldValue('NAME'), SECTION_NAME_TYPE);
  }

  const SECTION_ACTION_CODE = {
    LOAD: (fnName) => `await loadSection(${fnName});\n`,
    UNLOAD: (fnName) => `unloadSection(${fnName});\n`,
    // Exclusive: unload every other loaded section, then load this one.
    SWITCH: (fnName) => `await switchSection(${fnName});\n`,
  };

  // Anything not a direct child of a section's own body queues instead -
  // see unloadSectionQueued for why unload needs this too.
  const SECTION_ACTION_CODE_QUEUED = {
    LOAD: (fnName) => `await loadSectionQueued(${fnName});\n`,
    UNLOAD: (fnName) => `await unloadSectionQueued(${fnName});\n`,
    SWITCH: (fnName) => `await switchSectionQueued(${fnName});\n`,
  };

  javascriptGenerator.forBlock['section_control'] = function (block) {
    const fnName = targetSectionFnName(block);
    const action = block.getFieldValue('ACTION');
    const owner = findOwningSection(block.workspace, block.id);
    const ownerFnName = owner
      ? javascriptGenerator.nameDB_.getName(owner.getFieldValue('NAME'), SECTION_NAME_TYPE)
      : null;

    if (!fnName) {
      // Switch to "none" means unload everything; Load/Unload have no
      // equivalent for a missing target.
      if (action !== 'SWITCH') return '';
      // Also unloads whichever section this might be nested inside.
      return owner ? 'unloadAllSections();\nreturn;\n' : 'await unloadAllSectionsQueued();\n';
    }

    // A direct child of a section is already sequential with its parent -
    // queueing would deadlock against that same in-progress load.
    const nested = !!owner;
    const table = nested ? SECTION_ACTION_CODE : SECTION_ACTION_CODE_QUEUED;
    let code = (table[action] || table.LOAD)(fnName);

    // A nested self-unload or switch-away unloads this block's own section -
    // stop its body here, or what runs next gets tagged with a swept owner.
    const unloadsOwner =
      nested &&
      ((action === 'UNLOAD' && fnName === ownerFnName) ||
        (action === 'SWITCH' && fnName !== ownerFnName));
    if (unloadsOwner) code += 'return;\n';

    return code;
  };

  // Wait for x seconds
  javascriptGenerator.forBlock['wait_seconds'] = function (block) {
    const duration =
      javascriptGenerator.valueToCode(block, 'DURATION', javascriptGenerator.ORDER_ATOMIC) || '1';

    return `await wait(${duration});\n`;
  };

  // Wait until condition is true
  javascriptGenerator.forBlock['wait_until'] = function (block) {
    const condition =
      javascriptGenerator.valueToCode(block, 'CONDITION', javascriptGenerator.ORDER_ATOMIC) ||
      'false'; // Default to false if no condition is connected

    return `await waitUntil(() => ${condition});\n`;
  };

  // Repeat x times
  javascriptGenerator.forBlock['controls_repeat_ext'] = function (block, generator) {
    let repeats;
    if (block.getField('TIMES')) {
      repeats = String(Number(block.getFieldValue('TIMES')));
    } else {
      repeats = generator.valueToCode(block, 'TIMES', generator.ORDER_ASSIGNMENT) || '0';
    }

    let branch = generator.statementToCode(block, 'DO');

    let code = '';
    const loopVar = generator.nameDB_.getDistinctName('count', Blockly.Names.NameType.VARIABLE);
    let endVar = repeats;

    if (!/^\w+$/.test(repeats) && isNaN(repeats)) {
      endVar = generator.nameDB_.getDistinctName('repeat_end', Blockly.Names.NameType.VARIABLE);
      code += 'let ' + endVar + ' = ' + repeats + ';\n';
    }

    // repeat keeps a small per-iteration pause (unlike for/forEach), at the top
    // of the body so a continue can't skip it.
    code +=
      'for (let ' +
      loopVar +
      ' = 0; ' +
      loopVar +
      ' < ' +
      endVar +
      '; ' +
      loopVar +
      '++) {\n' +
      'await wait(0.005);\n' +
      branch +
      '}\n';

    return code;
  };

  // Repeat while/until condition
  javascriptGenerator.forBlock['controls_whileUntil'] = function (block) {
    const until = block.getFieldValue('MODE') === 'UNTIL';
    let argument0 =
      javascriptGenerator.valueToCode(
        block,
        'BOOL',
        until ? javascriptGenerator.ORDER_LOGICAL_NOT : javascriptGenerator.ORDER_NONE
      ) || 'false';
    let branch = javascriptGenerator.statementToCode(block, 'DO');
    if (until) {
      argument0 = '!' + argument0;
    }
    // Yield a real render frame per iteration (not setTimeout, which spins many
    // times per frame): guarantees exactly one physics/render step before the
    // condition is re-checked, so physics-dependent conditions (e.g. touching)
    // advance reliably without the user adding a manual wait. Still stoppable —
    // rAF yields to the event loop just like a timer.
    return (
      'while (' +
      argument0 +
      ') {\n' +
      branch +
      `\nawait new Promise(resolve => requestAnimationFrame(resolve));\n` +
      '}\n'
    );
  };

  // For each loop with iterator variable
  javascriptGenerator.forBlock['controls_for'] = function (block, generator) {
    const variable0 = generator.getVariableName(block.getFieldValue('VAR'));

    const argument0 = generator.valueToCode(block, 'FROM', generator.ORDER_ASSIGNMENT) || '0';
    const argument1 = generator.valueToCode(block, 'TO', generator.ORDER_ASSIGNMENT) || '0';
    const increment = generator.valueToCode(block, 'BY', generator.ORDER_ASSIGNMENT) || '1';

    const branch = generator.statementToCode(block, 'DO');

    const y = budgetYield(generator, variable0);
    // tick at the top of the body so a `continue` in the body can't skip it.
    return (
      y.decl +
      `for (let ${variable0} = ${argument0}; (${increment} > 0 ? ${variable0} <= ${argument1} : ${variable0} >= ${argument1}); ${variable0} += ${increment}) {\n` +
      y.tick +
      branch +
      '}\n'
    );
  };

  // For each loop iterating over list
  javascriptGenerator.forBlock['controls_forEach'] = function (block, generator) {
    // For each loop.
    const variable0 = generator.getVariableName(block.getFieldValue('VAR'));

    // Use correct ORDER constant from the generator
    const argument0 = generator.valueToCode(block, 'LIST', generator.ORDER_ASSIGNMENT) || '[]';

    let branch = generator.statementToCode(block, 'DO');
    let code = '';
    let listVar = argument0;

    if (!/^\w+$/.test(argument0)) {
      listVar = generator.nameDB_.getDistinctName(
        variable0 + '_list',
        Blockly.Names.NameType.VARIABLE
      );
      code += 'var ' + listVar + ' = ' + argument0 + ';\n';
    }

    const indexVar = generator.nameDB_.getDistinctName(
      variable0 + '_index',
      Blockly.Names.NameType.VARIABLE
    );

    const assignment = generator.INDENT + variable0 + ' = ' + listVar + '[' + indexVar + '];\n';

    const y = budgetYield(generator, variable0 + '_each');
    // tick after the item assignment so a `continue` in the body can't skip it.
    code +=
      y.decl +
      'for (var ' +
      indexVar +
      ' in ' +
      listVar +
      ') {\n' +
      assignment +
      y.tick +
      branch +
      '}\n';

    return code;
  };

  // Break out of loop
  // ?? Uses blockly standard

  // Local
  javascriptGenerator.forBlock['local_variable'] = function (block, generator) {
    // Retrieve the variable selected by the user
    const variable = generator.nameDB_.getName(
      block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME
    );

    // Generate a local 'let' declaration for the selected variable
    const code = `let ${variable};\n`;
    return code;
  };

  // Wait x milliseconds
  javascriptGenerator.forBlock['wait'] = function (block) {
    const duration =
      javascriptGenerator.valueToCode(block, 'DURATION', javascriptGenerator.ORDER_ATOMIC) || '1';

    return `await wait(${duration} / 1000);\n`;
  };
}
