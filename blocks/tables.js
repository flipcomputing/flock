import * as Blockly from 'blockly';
import { loops } from 'blockly/blocks';
import { getHelpUrlFor } from './blocks.js';
import { nextVariableName } from './variableNames.js';
import { translate, getTooltip } from '../main/translation.js';

export const TABLE_LOOP_TYPE = 'table_for_each_row';
const TABLE_VARIABLE_TYPE = 'Table';
const TABLE_FIELD = 'field_table_variable';

class FieldTableVariable extends Blockly.FieldVariable {
  static fromJson(options) {
    return super.fromJson({
      ...options,
      variableTypes: [TABLE_VARIABLE_TYPE],
      defaultType: TABLE_VARIABLE_TYPE,
    });
  }

  loadState(state) {
    if (state && typeof state === 'object' && !state.type) {
      const variableMap = this.getSourceBlock()?.workspace.getVariableMap();
      const untyped =
        (state.id && variableMap?.getVariableById(state.id)) ||
        (state.name && variableMap?.getVariable(state.name, ''));
      if (untyped?.getType() === '') variableMap.changeVariableType(untyped, TABLE_VARIABLE_TYPE);
      state = { ...state, type: TABLE_VARIABLE_TYPE };
    }
    super.loadState(state);
  }

  getOptions(useCache) {
    const name = this.getText();
    const labels = {
      [Blockly.FieldVariable.ADD_VARIABLE_ID]: translate('new_table_decision'),
      [Blockly.RENAME_VARIABLE_ID]: translate('rename_table_option').replace('%1', name),
      [Blockly.DELETE_VARIABLE_ID]: translate('delete_table_option').replace('%1', name),
    };
    return super.getOptions(useCache).map(([label, id]) => [labels[id] ?? label, id]);
  }

  onItemSelected_(menu, menuItem) {
    const workspace = this.getSourceBlock().workspace;
    if (menuItem.getValue() !== Blockly.FieldVariable.ADD_VARIABLE_ID) {
      withTableMessages(() => super.onItemSelected_(menu, menuItem));
      return;
    }
    withTableMessages(() =>
      Blockly.Variables.createVariableButtonHandler(
        workspace,
        (name) => {
          const variable =
            name && workspace.getVariableMap().getVariable(name, TABLE_VARIABLE_TYPE);
          if (variable) this.setValue(variable.getId());
        },
        TABLE_VARIABLE_TYPE
      )
    );
  }
}

function withTableMessages(action) {
  const messages = {
    NEW_VARIABLE_TITLE: translate('new_table_title'),
    RENAME_VARIABLE_TITLE: translate('rename_table_title'),
    DELETE_VARIABLE_CONFIRMATION: translate('delete_table_confirmation'),
  };
  const saved = Object.fromEntries(Object.keys(messages).map((key) => [key, Blockly.Msg[key]]));
  Object.assign(Blockly.Msg, messages);
  try {
    action();
  } finally {
    Object.assign(Blockly.Msg, saved);
  }
}

Blockly.fieldRegistry.register(TABLE_FIELD, FieldTableVariable);

const tableField = (name = 'TABLE') => ({ type: TABLE_FIELD, name, variable: 'table1' });

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
      { type: TABLE_FIELD, name: 'VAR', variable: nextVariableName(block, 'table') },
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

  defineTableBlock(
    'table_delete_row',
    () => ({
      args0: [
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            [translate('table_delete_row_option'), 'ROW'],
            [translate('table_delete_all_rows_option'), 'ALL'],
          ],
        },
        { type: 'input_dummy', name: 'MODE_ROW' },
        { type: 'input_value', name: 'ROW', check: 'Number' },
        tableField(),
      ],
      previousStatement: null,
      nextStatement: null,
    }),
    function () {
      const showRow = (mode) => this.getInput('ROW').setVisible(mode !== 'ALL');
      this.getField('MODE').setValidator((mode) => {
        showRow(mode);
        return mode;
      });
    }
  );

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
