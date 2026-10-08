import * as Blockly from 'blockly';
import { DO_MUTATOR_MINUS, DO_MUTATOR_PLUS } from './blocks.js';
import { translate } from '../main/translation.js';
import { getMeshFromBlock } from '../ui/blockmesh.js';
import { measureInitialSize } from '../ui/initialTransform.js';

const AXES = ['X', 'Y', 'Z'];

export const rotateInputName = (axis) => `ROTATE_${axis}`;
export const sizeInputName = (axis) => `SIZE_${axis}`;

function numberShadow(value) {
  return { type: 'math_number', fields: { NUM: value } };
}

function toggleButton(alt, onClick) {
  return new Blockly.FieldImage(DO_MUTATOR_PLUS, 24, 24, alt, onClick);
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

export function addInitialTransformRows(block, { resize = false } = {}) {
  block.rotateShown_ = false;
  block.resizeShown_ = false;
  block.hasResizeRow_ = resize;

  block.appendEndRowInput('TRANSFORM_ROW');
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
    .appendField(toggleButton('toggle do block', () => block.toggleDoBlock()), 'DO_BUTTON');
  block.hasOptionsRow_ = true;

  block.syncInitialTransformRows_ = function () {
    const open = this.optionsOpen_;
    this.getInput('DO_TOGGLE').setVisible(open);
    this.getInput('TRANSFORM_ROW').setVisible(open);
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
    if (block.rendered) {
      block.render();
      block.bumpNeighbours();
    }
    Blockly.Events.fire(
      new Blockly.Events.BlockChange(block, 'mutation', null, oldState, mutationText())
    );
  };

  const ensureShadow = (inputName, value) => {
    const connection = block.getInput(inputName).connection;
    if (!connection.targetBlock()) connection.setShadowState(numberShadow(value));
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
    if (this.rotateShown_) container.setAttribute('rotate', 'true');
    if (this.resizeShown_) container.setAttribute('resize', 'true');
    return container;
  };
  block.domToMutation = function (xmlElement) {
    doDomToMutation.call(this, xmlElement);
    this.rotateShown_ = xmlElement.getAttribute('rotate') === 'true';
    this.resizeShown_ = this.hasResizeRow_ && xmlElement.getAttribute('resize') === 'true';
    this.syncInitialTransformRows_();
  };

  block.syncInitialTransformRows_();
}
