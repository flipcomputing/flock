import * as Blockly from 'blockly';
import {
  addProcedureInlineOnDrag,
  handleBlockCreateEvent,
  registerBlockHandler,
  getHelpUrlFor,
} from './blocks.js';
import {
  changeParamsUndoably,
  setupProcedureParams,
  rowInputName,
  getParamDefaultShadowState,
} from './procedureParams.js';
import { translate, getTooltip } from '../main/translation.js';
import { flock } from '../flock.js';
import { getMeshesFromBlock, updatePrefabMaterial } from '../ui/blockmesh.js';
import { isProjectLoading } from '../main/projectLoading.js';

export const PREFAB_DEF_TYPE = 'procedures_defprefab';
export const PREFAB_CALL_TYPE = 'procedures_callprefab';
export const MATERIAL_ARG = 'MATERIAL';

const NESTED_REASON = 'PREFAB_INSIDE_PREFAB';
const ADD_MATERIAL_ITEM = 'prefabAddMaterial';
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
  if (isProjectLoading() && !changeEvent.recordUndo) return;
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

function updateNesting(block, changeEvent) {
  if (![Blockly.Events.BLOCK_MOVE, Blockly.Events.FINISHED_LOADING].includes(changeEvent.type)) {
    return;
  }
  if (block.isInFlyout || block.isDeadOrDying() || block.workspace.isDragging?.()) return;
  let nested = false;
  for (let parent = block.getSurroundParent(); parent; parent = parent.getSurroundParent()) {
    nested ||= parent.type === PREFAB_DEF_TYPE;
  }
  block.setWarningText(nested ? translate('prefab_nested_warning') : null, NESTED_REASON);
  const recordUndo = Blockly.Events.getRecordUndo();
  Blockly.Events.setRecordUndo(false);
  try {
    block.setDisabledReason(nested, NESTED_REASON);
  } finally {
    Blockly.Events.setRecordUndo(recordUndo);
  }
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
      setupProcedureParams(this, { fixedParams: { [MATERIAL_ARG]: MATERIAL_SHADOW } });
      addProcedureInlineOnDrag(this);
      for (const [name, labelKey] of POSITION_INPUTS) appendNumberInput(this, name, labelKey);
      appendNumberInput(this, 'ROTATE_Y', 'prefab_rotate_y_label');
      this.addArg_(translate('prefab_material_param'), null, MATERIAL_ARG);

      const saveExtraState = this.saveExtraState;
      this.saveExtraState = function (...args) {
        const state = saveExtraState.apply(this, args);
        if (this.hasMaterial_()) return state;
        return { ...state, params: state?.params ?? [] };
      };
    },

    getProcedureDef: function () {
      return [this.getFieldValue('NAME'), this.argData_.map((arg) => arg.model.name), false];
    },

    argInputNames_: function () {
      return this.argData_.map(({ argId }) => argId);
    },

    hasMaterial_: function () {
      return this.argData_.some(({ argId }) => argId === MATERIAL_ARG);
    },

    addMaterial_: function () {
      if (this.hasMaterial_()) return;
      const names = this.argData_.map((arg) => arg.model.name);
      const base = translate('prefab_material_param');
      let name = base;
      for (let n = 2; names.includes(name); n++) name = base + n;
      this.addArg_(name, null, MATERIAL_ARG);
    },

    layoutInputs_: function () {
      this.getField('WITH')?.setVisible(false);
      const params = this.argData_.filter(({ argId }) => argId !== MATERIAL_ARG);
      const breaksAfterParams = Boolean(params.at(-1)?.rowBreak);
      this.removeInput(PARAMS_ROW, true);
      this.removeInput(TRANSFORM_ROW, true);
      if (this.hasMaterial_()) {
        if (!breaksAfterParams) this.appendEndRowInput(PARAMS_ROW);
        this.appendEndRowInput(TRANSFORM_ROW);
      } else if (!breaksAfterParams) {
        this.appendEndRowInput(TRANSFORM_ROW);
      }
      const names = params.flatMap(({ argId }) => [argId, rowInputName(argId)]);
      names.push(PARAMS_ROW, MATERIAL_ARG, TRANSFORM_ROW, 'X', 'Y', 'Z', 'ROTATE_Y');
      for (const name of names) {
        if (this.getInput(name)) this.moveInputBefore(name, 'STACK');
      }
    },
  };

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
        handleBlockCreateEvent(this, changeEvent, this.getProcedureCall());
        if (changeEvent.type === Blockly.Events.FINISHED_LOADING) this.layoutInputs_();
        updateNesting(this, changeEvent);
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

    hasMaterial_: function () {
      const workspace = this.workspace.isFlyout ? this.workspace.targetWorkspace : this.workspace;
      const definition = workspace && Blockly.Procedures.getDefinition(this.getProcedureCall(), workspace);
      return definition?.type === PREFAB_DEF_TYPE ? definition.hasMaterial_() : true;
    },

    layoutInputs_: function () {
      const hasMaterial = this.hasMaterial_();
      const last = this.arguments_.length - 1;
      const material = hasMaterial ? 'ARG' + last : null;
      this.removeInput('ROW_' + (hasMaterial ? last - 1 : last), true);
      if (!hasMaterial) this.removeInput(PARAMS_ROW, true);
      else if (!this.getInput(PARAMS_ROW)) this.appendEndRowInput(PARAMS_ROW);
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

  const registry = Blockly.ContextMenuRegistry.registry;
  if (!registry.getItem(ADD_MATERIAL_ITEM)) {
    registry.register({
      id: ADD_MATERIAL_ITEM,
      weight: 10,
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
      displayText: () => translate('prefab_add_material_option'),
      preconditionFn: ({ block }) => {
        if (block?.type !== PREFAB_DEF_TYPE || block.isInFlyout || block.hasMaterial_()) {
          return 'hidden';
        }
        return block.isEditable() ? 'enabled' : 'disabled';
      },
      callback: ({ block }) => changeParamsUndoably(block, () => block.addMaterial_()),
    });
  }
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
