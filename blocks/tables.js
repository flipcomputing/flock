import * as Blockly from 'blockly';
import { loops } from 'blockly/blocks';
import { getHelpUrlFor } from './blocks.js';
import { nextVariableName } from './variableNames.js';
import { translate, getTooltip } from '../main/translation.js';

export const TABLE_LOOP_TYPE = 'table_for_each_row';

const tableField = (name = 'TABLE') => ({ type: 'field_variable', name, variable: 'table1' });

function defineTableBlock(type, json, setup) {
  Blockly.Blocks[type] = {
    init: function () {
      this.jsonInit({
        type,
        message0: translate(type),
        inputsInline: true,
        tooltip: getTooltip(type),
        ...json(this),
      });
      this.setHelpUrl(getHelpUrlFor(type));
      this.setStyle('list_blocks');
      setup?.call(this);
    },
  };
}

export function defineTableBlocks() {
  loops.loopTypes.add(TABLE_LOOP_TYPE);

  defineTableBlock('table_create', (block) => ({
    args0: [
      { type: 'field_variable', name: 'VAR', variable: nextVariableName(block, 'table') },
      { type: 'input_value', name: 'COLUMNS', check: 'Array' },
    ],
    previousStatement: null,
    nextStatement: null,
  }));

  defineTableBlock('table_add_row', () => ({
    args0: [tableField(), { type: 'input_value', name: 'VALUES', check: 'Array' }],
    previousStatement: null,
    nextStatement: null,
  }));

  defineTableBlock('table_get_value', () => ({
    args0: [
      tableField(),
      { type: 'input_value', name: 'ROW', check: 'Number' },
      { type: 'input_value', name: 'COLUMN', check: 'String' },
    ],
    output: null,
  }));

  defineTableBlock('table_set_value', () => ({
    args0: [
      tableField(),
      { type: 'input_value', name: 'ROW', check: 'Number' },
      { type: 'input_value', name: 'COLUMN', check: 'String' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
  }));

  defineTableBlock('table_get_column', () => ({
    args0: [{ type: 'input_value', name: 'COLUMN', check: 'String' }, tableField()],
    output: 'Array',
  }));

  defineTableBlock('table_get_row', () => ({
    args0: [{ type: 'input_value', name: 'ROW', check: 'Number' }, tableField()],
    output: null,
  }));

  defineTableBlock('table_row_count', () => ({
    args0: [tableField()],
    output: 'Number',
  }));

  defineTableBlock(
    TABLE_LOOP_TYPE,
    () => ({
      message1: '%1',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'row' },
        { type: 'field_variable', name: 'INDEX', variable: 'count' },
        tableField(),
      ],
      args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
    }),
    function () {
      this.getField('VAR').defaultVariableName = 'row';
      this.getField('INDEX').defaultVariableName = 'count';
      this.setOnChange(function () {
        if (this.isInFlyout) return;
        const same = this.getFieldValue('VAR') === this.getFieldValue('INDEX');
        this.setWarningText(
          same ? translate('table_loop_same_variable') : null,
          'table_loop_same_variable'
        );
      });
    }
  );

  defineTableBlock('table_row_value', () => ({
    args0: [
      { type: 'input_value', name: 'COLUMN', check: 'String' },
      { type: 'input_value', name: 'ROW' },
    ],
    output: null,
  }));
}
