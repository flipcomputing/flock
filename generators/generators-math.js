import { getFieldValue } from './generators-utilities.js';

export function registerMathGenerators(javascriptGenerator) {
  // -------------------------------
  // MATH
  // -------------------------------

  // Arithmetic operator - uses Blockly default

  // Random integer ----------------------------------------------------
  javascriptGenerator.forBlock['math_random_int'] = function (block) {
    const from =
      javascriptGenerator.valueToCode(block, 'FROM', javascriptGenerator.ORDER_NONE) || '0';
    const to = javascriptGenerator.valueToCode(block, 'TO', javascriptGenerator.ORDER_NONE) || '0';
    const code = 'randomInteger(' + from + ', ' + to + ')';
    return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
  };

  // Random integer with seed -----------------------------------------
  javascriptGenerator.forBlock['random_seeded_int'] = function (block) {
    const value_from = getFieldValue(block, 'FROM', 0);
    const value_to = getFieldValue(block, 'TO', 10);
    const value_seed = getFieldValue(block, 'SEED', 123456);

    const code = `seededRandom(${value_from}, ${value_to}, ${value_seed})`;

    return [code, javascriptGenerator.ORDER_NONE];
  };

  // Vector -------------------------------------------------------------
  javascriptGenerator.forBlock['vector'] = function (block) {
    const x = getFieldValue(block, 'X', 0);
    const y = getFieldValue(block, 'Y', 0);
    const z = getFieldValue(block, 'Z', 0);

    return [`createVector3(${x}, ${y}, ${z})`, javascriptGenerator.ORDER_FUNCTION_CALL];
  };

  // Integer - uses Blockly default

  // Convert to integer -----------------------------------------------
  javascriptGenerator.forBlock['to_number'] = function (block) {
    const string =
      javascriptGenerator.valueToCode(block, 'STRING', javascriptGenerator.ORDER_NONE) || "''";
    const field = block.getFieldValue('TYPE');
    const types = [
      'INT',
      'TEXT',
      'BOOLEAN',
      'BINARY',
      'HEX',
      'MONEY',
      'DATE',
      'TIME',
      'DATETIME',
      'COLOUR',
    ];
    const type = types.includes(field) ? field : 'FLOAT';
    return [`toNumber(${string}, '${type}')`, javascriptGenerator.ORDER_FUNCTION_CALL];
  };

  javascriptGenerator.forBlock['convert_using'] = function (block) {
    const code = (name) =>
      javascriptGenerator.valueToCode(block, name, javascriptGenerator.ORDER_NONE) || "''";
    const pairs = [];
    for (let i = 0; i < (block.pairCount_ ?? 0); i++) {
      pairs.push(`[${code(`FROM${i}`)}, ${code(`TO${i}`)}]`);
    }
    const op = block.getFieldValue('OP');
    const compare = ['NEQ', 'LT', 'LTE', 'GT', 'GTE'].includes(op) ? `, '${op}'` : '';
    return [
      `convertUsing(${code('VALUE')}, [${pairs.join(', ')}], ${code('OTHERWISE')}${compare})`,
      javascriptGenerator.ORDER_FUNCTION_CALL,
    ];
  };

  javascriptGenerator.forBlock['convert_range'] = function (block) {
    const args = ['VALUE', 'FROM_LOW', 'FROM_HIGH', 'TO_LOW', 'TO_HIGH'].map(
      (name) => javascriptGenerator.valueToCode(block, name, javascriptGenerator.ORDER_NONE) || '0'
    );
    return [`convertRange(${args.join(', ')})`, javascriptGenerator.ORDER_FUNCTION_CALL];
  };

  // Min and max of a list: spread instead of Blockly's `.apply`, which the sandbox refuses
  const blocklyOnList = javascriptGenerator.forBlock['math_on_list'];
  javascriptGenerator.forBlock['math_on_list'] = function (block, generator) {
    const fn = { MIN: 'Math.min', MAX: 'Math.max' }[block.getFieldValue('OP')];
    if (!fn) return blocklyOnList.call(this, block, generator);
    const list = generator.valueToCode(block, 'LIST', generator.ORDER_COMMA) || '[]';
    return [`${fn}(...${list})`, generator.ORDER_FUNCTION_CALL];
  };

  // The following all use Blockly defaults

  // Constants e.g. Pi
  // Test even, odd, prime etc
  // Round
  // Absolute
  // Trig functions
  // Sum, average and the rest of the list maths
  // Remainder
  // Constrain
  // Random fractions
}
