import * as Blockly from 'blockly';
import { createMinusField } from '@blockly/block-plus-minus/src/field_minus.js';
import { getExtraBlockState } from '@blockly/block-plus-minus/src/serialization_helper.js';
import { translate } from '../main/translation.js';

const PARAM_DEFAULT_SHADOW = { type: 'math_number', fields: { NUM: 0 } };
const CALLER_ROW_PREFIX = 'ROW_';
const PARAM_PILL_HEIGHT = 40;
const PARAM_PILL_X_PADDING = 12;

const rowIcon = (on) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${
      on ? '<rect x="1" y="1" width="22" height="22" rx="5" fill="white" fill-opacity="0.35"/>' : ''
    }<path d="M18 5v6a3 3 0 0 1-3 3H7m3-4-4 4 4 4" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  );

export const rowInputName = (argId) => argId + '_ROW';

function paramAnchor(block) {
  return block.getInput('STACK') ? 'STACK' : 'RETURN';
}

function setNameQuietly(field, name) {
  if (field.getValue() === name) return;
  const validator = field.getValidator();
  field.setValidator(null);
  field.setValue(name);
  field.setValidator(validator);
}

function onRowButton(block, argId) {
  if (block.isInFlyout) return;
  const arg = block.argData_.find((element) => element.argId === argId);
  if (!arg) return;
  Blockly.Events.setGroup(true);
  const oldState = getExtraBlockState(block);
  block.setRowBreak_(argId, !arg.rowBreak);
  Blockly.Procedures.mutateCallers(block);
  const newState = getExtraBlockState(block);
  if (oldState !== newState) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(block, 'mutation', null, oldState, newState));
  }
  Blockly.Events.setGroup(false);
}

function addRowInput(block, argId, on) {
  const name = rowInputName(argId);
  block.removeInput(name, true);
  const input = on ? block.appendEndRowInput(name) : block.appendDummyInput(name);
  input.appendField(
    new Blockly.FieldImage(
      rowIcon(on),
      15,
      15,
      translate(on ? 'function_row_join_alt' : 'function_row_break_alt'),
      () => onRowButton(block, argId)
    ),
    name
  );
  const index = block.inputList.findIndex((candidate) => candidate.name === argId);
  const next = block.inputList[index + 1];
  if (next && next !== input && next.name) block.moveInputBefore(name, next.name);
}

function applyRowBreaks(block, flags) {
  let changed = false;
  block.argData_.forEach((arg, i) => {
    const on = Boolean(flags[i]);
    if (Boolean(arg.rowBreak) !== on) {
      block.setRowBreak_(arg.argId, on);
      changed = true;
    }
  });
  if (changed) Blockly.Procedures.mutateCallers(block);
}

const paramPresses = new WeakMap();

export class ParamNameField extends Blockly.FieldTextInput {
  constructor(name, validator, { editable = true } = {}) {
    super(name, validator);
    if (!editable) {
      this.EDITABLE = false;
      this.SERIALIZABLE = false;
    }
  }

  initView() {
    super.initView();
    this.textElement_.classList.add('blocklyDropdownText');
    this.borderRect_?.classList.add('flockParamPill');
  }

  applyColour() {
    super.applyColour();
    if (!this.borderRect_) return;
    const style = this.getConstants().getBlockStyle('variable_blocks');
    this.borderRect_.style.setProperty('fill', style.colourPrimary, 'important');
    this.borderRect_.style.setProperty('stroke', style.colourTertiary);
  }

  updateSize_() {
    super.updateSize_(PARAM_PILL_X_PADDING);
    if (this.size_.height >= PARAM_PILL_HEIGHT) return;
    this.size_.height = PARAM_PILL_HEIGHT;
    this.positionTextElement_(PARAM_PILL_X_PADDING, this.size_.width - 2 * PARAM_PILL_X_PADDING);
    this.positionBorderRect_();
  }

  positionBorderRect_() {
    super.positionBorderRect_();
    const radius = String(this.size_.height / 2);
    this.borderRect_?.setAttribute('rx', radius);
    this.borderRect_?.setAttribute('ry', radius);
  }

  onMouseDown_(e) {
    super.onMouseDown_(e);
    const gesture = this.getSourceBlock()?.workspace.getGesture(e);
    if (gesture) paramPresses.set(gesture, this);
  }
}

function pressedParamGetter(block, e) {
  if (!(e instanceof PointerEvent) || block.isInFlyout) return null;
  const gesture = block.workspace.getGesture(e);
  const field = paramPresses.get(gesture);
  paramPresses.delete(gesture);
  const arg = field && block.argData_.find((element) => element.argId === field.name);
  if (!arg) return null;
  const rect = field.getSvgRoot().getBoundingClientRect();
  const position = Blockly.utils.svgMath.screenToWsCoordinates(
    block.workspace,
    new Blockly.utils.Coordinate(rect.left, rect.top)
  );
  return Blockly.serialization.blocks.append(
    {
      type: 'variables_get',
      fields: { VAR: { id: arg.model.getId() } },
      x: position.x,
      y: position.y,
    },
    block.workspace,
    { recordUndo: true }
  );
}

export function setupProcedureParams(block, { fixedParams = {} } = {}) {
  block.setInputsInline(true);
  const isFixed = (argId) => Object.hasOwn(fixedParams, argId);

  const startDrag = block.startDrag;
  if (startDrag) {
    block.startDrag = function (e) {
      const getter = pressedParamGetter(this, e);
      return getter ? getter.startDrag(e) : startDrag.call(this, e);
    };
  }

  block.addVarInput_ = function (name, argId) {
    const input = this.appendValueInput(argId).setCheck(null);
    if (isFixed(argId)) {
      input.appendField(new ParamNameField(name, null, { editable: false }), argId);
      input.connection.setShadowState(fixedParams[argId]);
      return;
    }
    const nameField = new ParamNameField(name, this.validator_);
    nameField.onFinishEditing_ = this.finishEditing_.bind(nameField);
    nameField.varIdsToDelete_ = [];
    nameField.preEditVarModel_ = null;
    input
      .appendField(createMinusField(Blockly.Msg['ARIA_LABEL_REMOVE_INPUT'], argId))
      .appendField(nameField, argId);
    input.connection.setShadowState(PARAM_DEFAULT_SHADOW);
    addRowInput(this, argId, false);
  };

  const addArg = block.addArg_;
  block.addArg_ = function (...args) {
    addArg.apply(this, args);
    const arg = this.argData_.pop();
    const firstFixed = this.argData_.findIndex((element) => isFixed(element.argId));
    if (!isFixed(arg.argId) && firstFixed >= 0) this.argData_.splice(firstFixed, 0, arg);
    else this.argData_.push(arg);
    if (!isFixed(arg.argId)) this.moveInputBefore(rowInputName(arg.argId), paramAnchor(this));
    this.layoutInputs_?.();
  };

  const removeArg = block.removeArg_;
  block.removeArg_ = function (argId) {
    this.removeInput(rowInputName(argId), true);
    removeArg.call(this, argId);
    this.layoutInputs_?.();
  };

  block.setRowBreak_ = function (argId, on) {
    const arg = this.argData_.find((element) => element.argId === argId);
    if (!arg || isFixed(argId)) return;
    arg.rowBreak = on;
    addRowInput(this, argId, on);
    this.layoutInputs_?.();
  };

  block.updateShape_ = function (names, varIds, argIds) {
    const keep = new Set(argIds.filter(Boolean));
    for (const arg of [...this.argData_]) {
      if (!keep.has(arg.argId)) this.removeArg_(arg.argId);
    }
    this.argData_ = names.map((name, i) => {
      const existing = argIds[i] && this.argData_.find((arg) => arg.argId === argIds[i]);
      if (!existing) {
        const before = new Set(this.argData_);
        this.addArg_(name, varIds[i], argIds[i]);
        return this.argData_.find((arg) => !before.has(arg));
      }
      existing.model = Blockly.Variables.getOrCreateVariablePackage(
        this.workspace,
        varIds[i],
        name,
        ''
      );
      setNameQuietly(this.getField(existing.argId), existing.model.name);
      return existing;
    });
    const anchor = paramAnchor(this);
    for (const { argId } of this.argData_) {
      this.moveInputBefore(argId, anchor);
      if (!isFixed(argId)) this.moveInputBefore(rowInputName(argId), anchor);
    }
    this.layoutInputs_?.();
    Blockly.Procedures.mutateCallers(this);
  };

  block.renameVarById = function (oldId, newId) {
    const arg = this.argData_.find((element) => element.model.getId() === oldId);
    if (!arg) return;
    arg.model = this.workspace.getVariableMap().getVariableById(newId);
    setNameQuietly(this.getField(arg.argId), arg.model.name);
    Blockly.Procedures.mutateCallers(this);
  };

  const saveExtraState = block.saveExtraState;
  block.saveExtraState = function () {
    const state = saveExtraState.call(this);
    state?.params?.forEach((param, i) => {
      if (this.argData_[i]?.rowBreak) param.rowBreak = true;
    });
    return state;
  };

  const loadExtraState = block.loadExtraState;
  block.loadExtraState = function (state) {
    loadExtraState.call(this, state);
    applyRowBreaks(
      this,
      (state?.params ?? []).map((param) => param.rowBreak)
    );
  };

  const mutationToDom = block.mutationToDom;
  block.mutationToDom = function (isForCaller) {
    const container = mutationToDom.call(this, isForCaller);
    const argElements = [...container.childNodes].filter(
      (node) => node.nodeName.toLowerCase() === 'arg'
    );
    argElements.forEach((element, i) => {
      if (this.argData_[i]?.rowBreak) element.setAttribute('rowbreak', 'true');
    });
    return container;
  };

  const domToMutation = block.domToMutation;
  block.domToMutation = function (xmlElement) {
    domToMutation.call(this, xmlElement);
    applyRowBreaks(
      this,
      [...xmlElement.childNodes]
        .filter((node) => node.nodeName.toLowerCase() === 'arg')
        .map((node) => node.getAttribute('rowbreak') === 'true')
    );
  };
}

function canBeShadow(block) {
  return block.getDescendants(false).every(
    (descendant) =>
      !descendant.type.startsWith('procedures_call') &&
      descendant.inputList.every((input) =>
        input.fieldRow.every((field) => !(field instanceof Blockly.FieldVariable))
      )
  );
}

function toShadowState(state) {
  const { next: _next, ...shadow } = state;
  if (shadow.inputs) {
    shadow.inputs = Object.fromEntries(
      Object.entries(shadow.inputs).map(([name, input]) => {
        const source = input.block ?? input.shadow;
        return [name, source ? { shadow: toShadowState(source) } : {}];
      })
    );
  }
  return shadow;
}

export function getParamDefaultShadowState(defBlock, argId) {
  const target = defBlock.getInput(argId)?.connection?.targetBlock();
  if (!target || !canBeShadow(target)) return null;
  const state = Blockly.serialization.blocks.save(target, {
    addCoordinates: false,
    addNextBlocks: false,
    saveIds: false,
  });
  return state ? toShadowState(state) : null;
}

function findDefinition(caller) {
  const workspace = caller.workspace.targetWorkspace ?? caller.workspace;
  const definition = Blockly.Procedures.getDefinition(caller.getProcedureCall(), workspace);
  return definition?.argData_ ? definition : null;
}

function fillNewArgShadows(caller, definition, previousCount) {
  if (window.loadingCode || !definition) return;
  for (let i = previousCount; i < definition.argData_.length; i++) {
    const connection = caller.getInput('ARG' + i)?.connection;
    if (!connection || connection.targetBlock()) continue;
    const shadowState = getParamDefaultShadowState(definition, definition.argData_[i].argId);
    if (shadowState) connection.setShadowState(shadowState);
  }
}

function syncCallerRows(caller, definition) {
  for (const input of [...caller.inputList]) {
    if (input.name.startsWith(CALLER_ROW_PREFIX)) caller.removeInput(input.name);
    else if (input.name.startsWith('ARG')) input.setAlign(Blockly.inputs.Align.LEFT);
  }
  definition?.argData_.forEach((arg, i) => {
    const next = 'ARG' + (i + 1);
    if (!arg.rowBreak || !caller.getInput(next)) return;
    caller.appendEndRowInput(CALLER_ROW_PREFIX + i);
    caller.moveInputBefore(CALLER_ROW_PREFIX + i, next);
  });
}

export function setupCaller(blockType) {
  const blockDefinition = Blockly.Blocks[blockType];
  const init = blockDefinition.init;
  blockDefinition.init = function () {
    init.call(this);
    this.setInputsInline(true);
  };
  for (const method of ['domToMutation', 'loadExtraState']) {
    const original = blockDefinition[method];
    blockDefinition[method] = function (...args) {
      const previousCount = this.arguments_?.length ?? 0;
      original.apply(this, args);
      const definition = findDefinition(this);
      fillNewArgShadows(this, definition, previousCount);
      syncCallerRows(this, definition);
    };
  }
}

setupCaller('procedures_callnoreturn');
setupCaller('procedures_callreturn');
