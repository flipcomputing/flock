import * as Blockly from 'blockly';
import {
  addToggleButton,
  nextVariableIndexes,
  handleBlockCreateEvent,
  registerBlockHandler,
  getHelpUrlFor,
} from './blocks.js';
import {
  setupProcedureParams,
  rowInputName,
  getParamDefaultShadowState,
} from './procedureParams.js';
import { translate, getTooltip } from '../main/translation.js';
import { flock } from '../flock.js';
import { getMeshesFromBlock, updatePrefabMaterial } from '../ui/blockmesh.js';

export const PREFAB_DEF_TYPE = 'procedures_defprefab';
export const PREFAB_CALL_TYPE = 'procedures_callprefab';
export const MATERIAL_ARG = 'MATERIAL';

const PARAMS_ROW = 'PARAMS_ROW';
const TRANSFORM_ROW = 'TRANSFORM_ROW';
const NUMBER_SHADOW = { type: 'math_number', fields: { NUM: 0 } };
const MATERIAL_SHADOW = {
  type: 'material',
  inputs: {
    BASE_COLOR: { shadow: { type: 'colour', fields: { COLOR: '#6666cc' } } },
  },
};
const POSITION_INPUTS = [
  ['X', 'prefab_x_label'],
  ['Y', 'prefab_y_label'],
  ['Z', 'prefab_z_label'],
];

function argIndexOf(block, changed) {
  for (let child = changed; child; child = child.getParent()) {
    if (child.getParent() !== block) continue;
    const name = block.inputList.find((input) => input.connection?.targetBlock() === child)?.name;
    const index = block.argInputNames_().indexOf(name);
    return index === -1 ? null : index;
  }
  return null;
}

function updateLive(block, changeEvent) {
  if (changeEvent.type !== Blockly.Events.BLOCK_CHANGE || changeEvent.element !== 'field') return;
  if (window.loadingCode && !changeEvent.recordUndo) return;
  const changed = changeEvent.blockId;
  const index = argIndexOf(block, block.workspace.getBlockById(changed));
  if (index !== null) {
    updatePrefabMaterial(block, index);
    return;
  }
  const edited = [...POSITION_INPUTS.map(([name]) => name), 'ROTATE_Y'].find(
    (name) => block.getInputTargetBlock(name)?.id === changed
  );
  if (!edited) return;
  const read = (name) => Number(block.getInputTargetBlock(name)?.getFieldValue('NUM'));
  const groups = getMeshesFromBlock(block).filter((mesh) => mesh.metadata?.isPrefab);
  if (edited === 'ROTATE_Y') {
    const y = read('ROTATE_Y');
    if (Number.isFinite(y)) groups.forEach((group) => flock.rotateTo(group.name, { y }));
    return;
  }
  const [x, y, z] = ['X', 'Y', 'Z'].map(read);
  if (![x, y, z].every(Number.isFinite)) return;
  groups.forEach((group) => flock.positionAt(group.name, { x, y, z }));
}

function appendNumberInput(block, name, labelKey) {
  block
    .appendValueInput(name)
    .setCheck('Number')
    .appendField(translate(labelKey))
    .connection.setShadowState(NUMBER_SHADOW);
}

export function definePrefabBlocks() {
  Blockly.Blocks[PREFAB_DEF_TYPE] = {
    callType_: PREFAB_CALL_TYPE,

    init: function () {
      this.jsonInit({
        message0: translate('procedures_defprefab'),
        args0: [
          { type: 'field_input', name: 'NAME', text: '' },
          { type: 'input_dummy', name: 'TOP' },
        ],
        message1: '%{BKY_PROCEDURES_DEFNORETURN_DO} %1',
        args1: [{ type: 'input_statement', name: 'STACK' }],
        style: 'procedure_blocks',
        tooltip: getTooltip(PREFAB_DEF_TYPE),
        extensions: ['procedure_context_menu', 'procedure_rename', 'procedure_vars'],
        mutator: 'procedure_def_mutator',
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.getInput('TOP')
        .appendField(translate('prefab_preview_label'))
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'PREVIEW');
      setupProcedureParams(this, { fixedParams: { [MATERIAL_ARG]: MATERIAL_SHADOW } });
      addToggleButton(this);
      this.appendEndRowInput(TRANSFORM_ROW);
      for (const [name, labelKey] of POSITION_INPUTS) appendNumberInput(this, name, labelKey);
      appendNumberInput(this, 'ROTATE_Y', 'prefab_rotate_y_label');
      this.addArg_(translate('prefab_material_param'), null, MATERIAL_ARG);
      this.getInput('TOP').removeField('WITH', true);
      registerBlockHandler(this, (changeEvent) => updateLive(this, changeEvent));
    },

    getProcedureDef: function () {
      return [this.getFieldValue('NAME'), this.argData_.map((arg) => arg.model.name), false];
    },

    argInputNames_: function () {
      return this.argData_.map(({ argId }) => argId);
    },

    layoutInputs_: function () {
      const params = this.argData_.filter(({ argId }) => argId !== MATERIAL_ARG);
      this.removeInput(PARAMS_ROW, true);
      if (!params.at(-1)?.rowBreak) this.appendEndRowInput(PARAMS_ROW);
      const names = params.flatMap(({ argId }) => [argId, rowInputName(argId)]);
      names.push(PARAMS_ROW, MATERIAL_ARG, TRANSFORM_ROW, 'X', 'Y', 'Z', 'ROTATE_Y');
      for (const name of names) {
        if (this.getInput(name)) this.moveInputBefore(name, 'STACK');
      }
    },
  };
  Blockly.Extensions.apply('custom_procedure_ui_extension', Blockly.Blocks[PREFAB_DEF_TYPE]);

  const callBase = Blockly.Blocks['procedures_callnoreturn'];
  Blockly.Blocks[PREFAB_CALL_TYPE] = {
    ...callBase,
    defType_: PREFAB_DEF_TYPE,

    init: function () {
      this.appendDummyInput('TOPROW')
        .appendField(translate('procedures_callprefab'))
        .appendField('', 'NAME')
        .appendField(new Blockly.FieldVariable(translate('prefab_variable')), 'ID_VAR');
      this.appendEndRowInput(PARAMS_ROW);
      this.appendEndRowInput(TRANSFORM_ROW);
      this.appendDummyInput('PICK').appendField(
        Blockly.fieldRegistry.fromJson({ type: 'field_pick_position' }),
        'PICK_POSITION'
      );
      for (const [name, labelKey] of POSITION_INPUTS) appendNumberInput(this, name, labelKey);
      appendNumberInput(this, 'ROTATE_Y', 'prefab_rotate_y_label');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('procedure_blocks');
      this.setTooltip(getTooltip(PREFAB_CALL_TYPE));
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.arguments_ = [];
      this.argumentVarModels_ = [];
      this.quarkConnections_ = {};
      this.quarkIds_ = null;

      registerBlockHandler(this, (changeEvent) => {
        handleBlockCreateEvent(this, changeEvent, this.getProcedureCall(), nextVariableIndexes);
        updateLive(this, changeEvent);
      });
    },

    getVarModels: function () {
      const variable = this.getField('ID_VAR').getVariable();
      return variable ? [...this.argumentVarModels_, variable] : this.argumentVarModels_;
    },

    argInputNames_: function () {
      return this.arguments_.map((_, i) => 'ARG' + i);
    },

    renameProcedure: function (oldName, newName) {
      if (Blockly.Names.equals(oldName, this.getProcedureCall())) {
        this.setFieldValue(newName, 'NAME');
      }
    },

    updateShape_: function () {
      callBase.updateShape_.call(this);
      this.getInput('TOPROW').removeField('WITH', true);
      this.layoutInputs_();
    },

    domToMutation: function (xmlElement) {
      callBase.domToMutation.call(this, xmlElement);
      this.layoutInputs_();
    },

    loadExtraState: function (state) {
      callBase.loadExtraState.call(this, state);
      this.layoutInputs_();
    },

    layoutInputs_: function () {
      const last = this.arguments_.length - 1;
      const material = 'ARG' + last;
      this.removeInput('ROW_' + (last - 1), true);
      const params = this.inputList
        .map((input) => input.name)
        .filter((name) => /^(ARG|ROW_)\d+$/.test(name) && name !== material);
      for (const name of [
        ...params,
        PARAMS_ROW,
        material,
        TRANSFORM_ROW,
        'PICK',
        'X',
        'Y',
        'Z',
        'ROTATE_Y',
      ]) {
        if (this.getInput(name)) this.moveInputBefore(name, null);
      }
    },
  };
}

const CALLER_DEFAULT_INPUTS = ['X', 'Y', 'Z', 'ROTATE_Y'];

export function prefabFlyoutItems(workspace, nextName) {
  const callers = workspace
    .getBlocksByType(PREFAB_DEF_TYPE, false)
    .map((definition) => {
      const [name, params] = definition.getProcedureDef();
      const inputs = {};
      for (const input of CALLER_DEFAULT_INPUTS) {
        const shadow = getParamDefaultShadowState(definition, input);
        if (shadow) inputs[input] = { shadow };
      }
      return {
        kind: 'block',
        type: PREFAB_CALL_TYPE,
        extraState: { name, params },
        fields: { ID_VAR: { name: nextName(name) } },
        inputs,
      };
    })
    .sort((a, b) =>
      a.extraState.name.localeCompare(b.extraState.name, undefined, { sensitivity: 'base' })
    );
  return {
    definition: {
      kind: 'block',
      type: PREFAB_DEF_TYPE,
      gap: 24,
      fields: { NAME: translate('prefab_default_name') },
    },
    callers,
  };
}
