import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';

export const UNKNOWN_BLOCK_TYPE = 'unknown_block';
export const UNRECOGNISED_BLOCK_REASON = 'UNRECOGNISED_BLOCK';

export function defineUnknownBlock() {
  Blockly.Blocks[UNKNOWN_BLOCK_TYPE] = {
    init: function () {
      this.original_ = null;
      this.shape_ = 'statement';
      this.inputLayout_ = [];
      this.appendDummyInput('LABEL').appendField(new Blockly.FieldLabel('?'), 'TYPE_NAME');
      this.setColour('#9e9e9e');
      this.setTooltip(() => translate('unknown_block_warning'));
      this.setWarningText(translate('unknown_block_warning'));
      this.setDisabledReason(true, UNRECOGNISED_BLOCK_REASON);
      this.applyShape_();
    },

    saveExtraState: function () {
      return { original: this.original_, shape: this.shape_, inputs: this.inputLayout_ };
    },

    loadExtraState: function (state) {
      this.original_ = state?.original ?? null;
      this.shape_ = state?.shape === 'value' ? 'value' : 'statement';
      this.inputLayout_ = Array.isArray(state?.inputs) ? state.inputs : [];
      this.setFieldValue(String(this.original_?.type ?? '?'), 'TYPE_NAME');
      this.applyShape_();
      for (const { name, type } of this.inputLayout_) {
        if (this.getInput(name)) continue;
        if (type === 'statement') this.appendStatementInput(name);
        else this.appendValueInput(name);
      }
    },

    applyShape_: function () {
      if (this.shape_ === 'value') {
        this.setPreviousStatement(false);
        this.setNextStatement(false);
        this.setOutput(true);
      } else {
        this.setOutput(false);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    },
  };
}

function isKnownType(type) {
  return typeof type === 'string' && Object.hasOwn(Blockly.Blocks, type);
}

function unwrapIfKnown(state) {
  if (state.type !== UNKNOWN_BLOCK_TYPE) return state;
  const original = state.extraState?.original;
  if (!original || !isKnownType(original.type)) return state;
  const restored = { ...original, id: state.id, x: state.x, y: state.y };
  if (state.inputs) restored.inputs = state.inputs;
  if (state.next) restored.next = state.next;
  for (const key of Object.keys(restored)) {
    if (restored[key] === undefined) delete restored[key];
  }
  return restored;
}

export function replaceUnrecognisedBlocks(json) {
  const topBlocks = json?.blocks?.blocks;
  if (!Array.isArray(topBlocks)) return 0;

  let unrecognised = 0;
  let probeWorkspace = null;

  const probe = (state, read) => {
    try {
      probeWorkspace ??= new Blockly.Workspace();
      const { inputs: _inputs, next: _next, id: _id, ...rest } = state;
      const block = Blockly.serialization.blocks.append(rest, probeWorkspace, {
        recordUndo: false,
      });
      return read(block);
    } catch {
      return null;
    } finally {
      probeWorkspace?.clear();
    }
  };

  const shapeOf = (state) =>
    isKnownType(state.type)
      ? (probe(state, (block) => (block.outputConnection ? 'value' : 'statement')) ?? 'statement')
      : 'statement';

  const inputTypeOf = (state, name) =>
    probe(state, (block) =>
      block.getInput(name)?.type === Blockly.inputs.inputTypes.STATEMENT ? 'statement' : 'value'
    ) ?? 'statement';

  const convert = (rawState, slot) => {
    const state = unwrapIfKnown(rawState);
    const known = isKnownType(state.type);
    const inputs = {};
    const layout = [];

    for (const [name, input] of Object.entries(state.inputs ?? {})) {
      const next = {};
      let inputType = null;
      if (input?.shadow) {
        const shadow = unwrapIfKnown(input.shadow);
        if (isKnownType(shadow.type)) next.shadow = convert(shadow, null);
      }
      if (input?.block) {
        const childKnown = isKnownType(unwrapIfKnown(input.block).type);
        if (!known) inputType = shapeOf(unwrapIfKnown(input.block));
        else if (!childKnown) inputType = inputTypeOf(state, name);
        next.block = convert(input.block, inputType);
      } else if (!known) {
        inputType = next.shadow ? shapeOf(next.shadow) : 'value';
      }
      inputs[name] = next;
      if (!known) layout.push({ name, type: inputType });
    }

    const result = { ...state };
    if (state.inputs) result.inputs = inputs;
    if (state.next?.block) result.next = { block: convert(state.next.block, 'statement') };
    if (known) {
      if (state.type === UNKNOWN_BLOCK_TYPE) unrecognised++;
      return result;
    }

    unrecognised++;
    const { id, x, y, inputs: _inputs, next: _next, ...original } = state;
    const placeholder = {
      type: UNKNOWN_BLOCK_TYPE,
      extraState: { original, shape: slot === 'value' ? 'value' : 'statement', inputs: layout },
    };
    if (id !== undefined) placeholder.id = id;
    if (x !== undefined) placeholder.x = x;
    if (y !== undefined) placeholder.y = y;
    if (result.inputs) placeholder.inputs = result.inputs;
    if (result.next) placeholder.next = result.next;
    return placeholder;
  };

  try {
    json.blocks.blocks = topBlocks.map((state) => convert(state, null));
  } finally {
    probeWorkspace?.dispose();
  }
  return unrecognised;
}
