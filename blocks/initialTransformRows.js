import * as Blockly from 'blockly';
import { DISCLOSURE_CLOSED, DO_MUTATOR_MINUS, DO_MUTATOR_PLUS } from './blocks.js';
import { translate } from '../main/translation.js';
import { getMeshFromBlock } from '../ui/blockmesh.js';
import { measureInitialSize } from '../ui/initialTransform.js';
import { FieldPickPosition } from './fieldPickPosition.js';

const AXES = ['X', 'Y', 'Z'];

export const SAME_NUMBER_TYPE = 'same_number';

export class FieldSameNumber extends Blockly.FieldNumber {
  doClassValidation_(newValue) {
    if (newValue === null || newValue === undefined || String(newValue).trim() === '') return '';
    return super.doClassValidation_(newValue);
  }

  getText_() {
    if (this.isBeingEdited_) return super.getText_();
    return this.getValue() === '' ? translate('same_axis_value') : null;
  }
}

export function defineSameNumberBlock() {
  Blockly.Blocks[SAME_NUMBER_TYPE] = {
    init: function () {
      this.appendDummyInput().appendField(new FieldSameNumber(''), 'NUM');
      this.setOutput(true, 'Number');
      this.setStyle('math_blocks');
    },
  };
}

export const positionInputName = (axis) => `POSITION_${axis}`;
export const rotateInputName = (axis) => `ROTATE_${axis}`;
export const sizeInputName = (axis) => `SIZE_${axis}`;

function numberShadow(value) {
  return { type: 'math_number', fields: { NUM: value } };
}

function toggleButton(alt, onClick, size = 24) {
  return new Blockly.FieldImage(DO_MUTATOR_PLUS, size, size, alt, onClick);
}

function appendAxisInputs(block, inputName) {
  for (const axis of AXES) {
    block
      .appendValueInput(inputName(axis))
      .setCheck('Number')
      .appendField(`${axis.toLowerCase()}:`);
  }
}

function splitScaleLabel(block) {
  const scale = block.getInput('SCALE');
  const head = block.appendDummyInput('SCALE_HEAD');
  head.fieldRow = scale.fieldRow.splice(0, scale.fieldRow.length - 1);
  block.moveInputBefore('SCALE_HEAD', 'SCALE');
}

export function addInitialTransformRows(block, { resize = false, position = false } = {}) {
  block.positionShown_ = false;
  block.rotateShown_ = false;
  block.resizeShown_ = false;
  block.hasPositionRow_ = position;
  block.hasResizeRow_ = resize;

  block.appendEndRowInput('TRANSFORM_ROW');
  if (position) {
    block
      .appendDummyInput('POSITION_TOGGLE')
      .appendField(translate('initial_position_label'))
      .appendField(new FieldPickPosition(), 'PICK_POSITION')
      .appendField(
        toggleButton('toggle position', () => block.togglePosition()),
        'POSITION_BUTTON'
      );
    appendAxisInputs(block, positionInputName);
    block.appendEndRowInput('POSITION_ROW');
  }
  block
    .appendDummyInput('ROTATE_TOGGLE')
    .appendField(translate('initial_rotation_label'))
    .appendField(
      toggleButton('toggle rotate', () => block.toggleRotate()),
      'ROTATE_BUTTON'
    );
  appendAxisInputs(block, rotateInputName);

  if (resize) {
    if (block.getInput('SCALE')) splitScaleLabel(block);
    block
      .appendDummyInput('RESIZE_TOGGLE')
      .appendField(translate('initial_size_label'))
      .appendField(
        toggleButton('toggle resize', () => block.toggleResize()),
        'RESIZE_BUTTON'
      );
    appendAxisInputs(block, sizeInputName);
  }

  block
    .appendDummyInput('DO_TOGGLE')
    .setAlign(Blockly.inputs.Align.RIGHT)
    .appendField(
      new Blockly.FieldImage(DISCLOSURE_CLOSED, 30, 30, 'show first', () => block.toggleDoBlock()),
      'DO_BUTTON'
    );
  block.hasOptionsRow_ = true;
  block.optionsHaveCode_ = function () {
    return this.positionShown_ || this.rotateShown_ || this.resizeShown_;
  };

  block.syncInitialTransformRows_ = function () {
    const open = this.optionsOpen_;
    this.getInput('DO_TOGGLE').setVisible(open);
    this.getInput('TRANSFORM_ROW').setVisible(open);
    if (this.hasPositionRow_) {
      this.getInput('POSITION_TOGGLE').setVisible(open);
      this.getInput('POSITION_ROW').setVisible(open);
      for (const axis of AXES) {
        this.getInput(positionInputName(axis)).setVisible(open && this.positionShown_);
      }
      this.getField('POSITION_BUTTON').setValue(
        this.positionShown_ ? DO_MUTATOR_MINUS : DO_MUTATOR_PLUS
      );
    }
    this.getInput('ROTATE_TOGGLE').setVisible(open);
    for (const axis of AXES) {
      this.getInput(rotateInputName(axis)).setVisible(open && this.rotateShown_);
    }
    this.getField('ROTATE_BUTTON').setValue(this.rotateShown_ ? DO_MUTATOR_MINUS : DO_MUTATOR_PLUS);
    if (!this.hasResizeRow_) return;
    this.getInput('RESIZE_TOGGLE').setVisible(open);
    for (const axis of AXES) {
      this.getInput(sizeInputName(axis)).setVisible(open && this.resizeShown_);
    }
    this.getInput('SCALE')?.setVisible(!this.resizeShown_);
    this.getField('RESIZE_BUTTON').setValue(this.resizeShown_ ? DO_MUTATOR_MINUS : DO_MUTATOR_PLUS);
  };

  const mutationText = () => Blockly.Xml.domToText(block.mutationToDom());

  const changeRows = (change) => {
    const oldState = mutationText();
    change();
    block.syncInitialTransformRows_();
    block.syncDisclosureIcons_?.();
    if (block.rendered) {
      block.render();
      block.bumpNeighbours();
    }
    Blockly.Events.fire(
      new Blockly.Events.BlockChange(block, 'mutation', null, oldState, mutationText())
    );
  };

  const ensureShadow = (inputName, value, shadow = numberShadow(value)) => {
    const connection = block.getInput(inputName).connection;
    if (!connection.targetBlock()) connection.setShadowState(shadow);
  };

  block.setPositionShown = function (show) {
    if (!this.hasPositionRow_ || this.positionShown_ === show) return;
    changeRows(() => {
      if (show) {
        for (const axis of AXES) {
          ensureShadow(positionInputName(axis), '', { type: SAME_NUMBER_TYPE, fields: { NUM: '' } });
        }
      }
      this.positionShown_ = show;
    });
  };

  block.togglePosition = function () {
    this.setPositionShown(!this.positionShown_);
  };

  block.setRotateShown = function (show) {
    if (this.rotateShown_ === show) return;
    changeRows(() => {
      if (show) for (const axis of AXES) ensureShadow(rotateInputName(axis), 0);
      this.rotateShown_ = show;
    });
  };

  block.toggleRotate = function () {
    this.setRotateShown(!this.rotateShown_);
  };

  block.setResizeShown = function (show, size = null) {
    if (!this.hasResizeRow_ || this.resizeShown_ === show) return;
    changeRows(() => {
      if (show) {
        const measured = size ?? measureInitialSize(getMeshFromBlock(this));
        for (const axis of AXES) {
          const value = measured?.[axis.toLowerCase()] ?? 1;
          ensureShadow(sizeInputName(axis), Math.round(value * 10) / 10);
        }
      }
      this.resizeShown_ = show;
    });
  };

  block.toggleResize = function () {
    this.setResizeShown(!this.resizeShown_);
  };

  block.syncOptionsRow_ = block.syncInitialTransformRows_;

  const doMutationToDom = block.mutationToDom;
  const doDomToMutation = block.domToMutation;
  block.mutationToDom = function () {
    const container = doMutationToDom.call(this);
    if (this.positionShown_) container.setAttribute('position', 'true');
    if (this.rotateShown_) container.setAttribute('rotate', 'true');
    if (this.resizeShown_) container.setAttribute('resize', 'true');
    return container;
  };
  block.domToMutation = function (xmlElement) {
    this.positionShown_ = this.hasPositionRow_ && xmlElement.getAttribute('position') === 'true';
    this.rotateShown_ = xmlElement.getAttribute('rotate') === 'true';
    this.resizeShown_ = this.hasResizeRow_ && xmlElement.getAttribute('resize') === 'true';
    doDomToMutation.call(this, xmlElement);
  };

  block.syncInitialTransformRows_();
  block.syncDisclosureIcons_?.();
}
